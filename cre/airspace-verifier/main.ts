// AirSpace verifier — Chainlink CRE workflow.
//
// Verifies that an NYC parcel (BBL) has transferable, unused development rights,
// audits the submission with an LLM, and records a signed verdict on the AirSpace
// Solana program through the keystone forwarder.
//
//   Handler 0 (HTTP trigger)  { bbl, submitted? }   -> verify one parcel
//   Handler 1 (cron, 5 min)   GET /api/verify/pending -> verify up to N parcels
//
// Both handlers run inside a TEE (`handlerInTee`). PLUTO fetch, Anthropic call
// and the verdict logic execute in the enclave with the API key released by the
// Vault DON; only the derived verdict crosses back (`usingTheDons()`) for the
// signed report and the Solana write.
import {
	bytesToBase64,
	CronCapability,
	getNetwork,
	handlerInTee,
	HTTPCapability,
	HTTPClient,
	ok,
	Runner,
	type Runtime,
	type SolanaAccountMeta,
	SolanaClient,
	SolanaTxStatus,
	solanaAccountMeta,
	type TeeRuntime,
	text,
} from '@chainlink/cre-sdk'
import { getBase58Decoder } from '@solana/codecs'
import { PublicKey } from '@solana/web3.js'
import { z } from 'zod'
import { AirspaceReceiver, VERDICT_STATUS, type VerdictReport } from '../bindings/AirspaceReceiver'
import { FLAGS, normalizePluto, PLUTO_SELECT, type PlutoLot } from './pluto'
import { sha256, toHex } from './sha256'

// ─── Config ─────────────────────────────────────────────────────────────────

const base58Address = z.string().refine(
	(v) => {
		try {
			new PublicKey(v)
			return true
		} catch {
			return false
		}
	},
	{ message: 'invalid base58 Solana address' },
)

const configSchema = z.object({
	// Web app base URL; the cron handler polls `${webBaseUrl}/api/verify/pending`
	webBaseUrl: z.string(),
	// Anthropic Messages endpoint or the local mock (cre/mock-llm)
	llmUrl: z.string(),
	llmModel: z.string(),
	// Secret id resolved via secrets.yaml -> env var
	llmSecretId: z.string(),
	plutoUrl: z.string(),
	// 6-field CRE cron expression
	pendingSchedule: z.string(),
	maxPendingPerRun: z.number().int().positive(),
	solana: z.object({
		chainSelectorName: z.string(),
		programId: base58Address,
		forwarderProgramId: base58Address,
		forwarderState: base58Address,
	}),
})

type Config = z.infer<typeof configSchema>

// ─── Trigger payloads ───────────────────────────────────────────────────────

const submittedSchema = z.object({
	address: z.string().optional(),
	ownerName: z.string().optional(),
	lotAreaSqft: z.number().optional(),
	builtAreaSqft: z.number().optional(),
})

const verifyRequestSchema = z.object({
	bbl: z.string().regex(/^\d{10}$/, 'bbl must be a 10-digit string'),
	submitted: submittedSchema.optional(),
})

type VerifyRequest = z.infer<typeof verifyRequestSchema>

// Shape of the HTTP trigger payload delivered to the handler (raw JSON bytes).
type HttpTriggerPayload = { input: Uint8Array }

const pendingSchema = z.object({
	pending: z.array(z.object({ bbl: z.string().regex(/^\d{10}$/) })),
})

// ─── LLM audit ──────────────────────────────────────────────────────────────

type LlmAudit = {
	recommendation: 'allow' | 'deny' | 'review'
	confidence: number
	flags: { dataMismatch: boolean; ownerMismatch: boolean }
	valueAdjustmentPct: number
	reasoning: string
}

const SYSTEM_PROMPT =
	'You audit NYC air-rights (unused floor-area / TDR) listings for a marketplace. ' +
	'You receive the official PLUTO record for a tax lot, the figures the owner submitted, and the computed unused floor area. ' +
	'Check that the submitted numbers are consistent with PLUTO (a difference over 10% is a data mismatch), ' +
	'whether the submitted owner name clearly differs from the PLUTO owner, and whether the unused floor area is credible and transferable. ' +
	'Respond with ONLY a JSON object (no prose, no code fences) with exactly these keys: ' +
	'"recommendation" ("allow" | "deny" | "review"), "confidence" (number 0..1), ' +
	'"flags" ({"dataMismatch": boolean, "ownerMismatch": boolean}), ' +
	'"valueAdjustmentPct" (integer -20..20, your adjustment to the comparables-based estimate), ' +
	'"reasoning" (string, at most 60 words).'

const buildAuditPrompt = (lot: PlutoLot, submitted: VerifyRequest['submitted']): string => {
	// Compact JSON on purpose: keys/values are stable and machine-checkable.
	const facts = {
		bbl: lot.bbl,
		pluto: {
			address: lot.address,
			borough: lot.borough,
			zipcode: lot.zipcode,
			ownerName: lot.ownerName,
			zoning: lot.zoning,
			specialDistrict: lot.specialDistrict,
			landmark: lot.landmark,
			historicDistrict: lot.historicDistrict,
			lotAreaSqft: lot.lotAreaSqft,
			builtAreaSqft: lot.builtAreaSqft,
			residFar: lot.residFar,
			commFar: lot.commFar,
			facilFar: lot.facilFar,
			maxFar: lot.maxFar,
			numFloors: lot.numFloors,
			yearBuilt: lot.yearBuilt,
		},
		submitted: submitted ?? {},
		computed: {
			unusedSqft: lot.unusedSqft,
			pricePerSqft: lot.pricePerSqft,
			baseEstValueUsd: lot.estValueUsd,
		},
	}
	return `Audit this air-rights submission and reply with the JSON object only.\n${JSON.stringify(facts)}`
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Extracts and normalises the audit JSON from the model's text (tolerates fences / prose). */
const parseAudit = (textOut: string): LlmAudit | null => {
	const cleaned = textOut.replace(/```(?:json)?/gi, '').trim()
	const start = cleaned.indexOf('{')
	const end = cleaned.lastIndexOf('}')
	if (start < 0 || end <= start) return null
	let raw: Record<string, unknown>
	try {
		raw = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>
	} catch {
		return null
	}
	const rec = String(raw.recommendation ?? '').toLowerCase()
	const recommendation: LlmAudit['recommendation'] =
		rec === 'allow' || rec === 'deny' ? rec : 'review'
	const confidenceNum = Number(raw.confidence)
	const confidence = Number.isFinite(confidenceNum) ? clamp(confidenceNum, 0, 1) : 0
	const flagsRaw = (raw.flags && typeof raw.flags === 'object' ? raw.flags : {}) as Record<string, unknown>
	const adjNum = Number(raw.valueAdjustmentPct)
	return {
		recommendation,
		confidence: Math.round(confidence * 10000) / 10000,
		flags: {
			dataMismatch: flagsRaw.dataMismatch === true || flagsRaw.dataMismatch === 'true',
			ownerMismatch: flagsRaw.ownerMismatch === true || flagsRaw.ownerMismatch === 'true',
		},
		valueAdjustmentPct: Number.isFinite(adjNum) ? clamp(Math.round(adjNum), -20, 20) : 0,
		reasoning: typeof raw.reasoning === 'string' ? raw.reasoning.slice(0, 600) : '',
	}
}

/** Canonical JSON (fixed key order) — this exact string is what gets hashed on-chain. */
const canonicalAuditJson = (a: LlmAudit): string =>
	JSON.stringify({
		recommendation: a.recommendation,
		confidence: a.confidence,
		flags: { dataMismatch: a.flags.dataMismatch, ownerMismatch: a.flags.ownerMismatch },
		valueAdjustmentPct: a.valueAdjustmentPct,
		reasoning: a.reasoning,
	})

// ─── Enclave pipeline (PLUTO → compute → LLM → verdict) ─────────────────────

type VerifyOutcome = {
	bbl: string
	status: number
	confidenceBps: number
	flags: number
	unusedSqft: bigint
	estValueUsd: bigint
	reportHash: Uint8Array
	audit: LlmAudit
	lot: Pick<PlutoLot, 'address' | 'borough' | 'zoning' | 'lotAreaSqft' | 'builtAreaSqft' | 'maxFar'>
}

const fetchPluto = (runtime: TeeRuntime<Config>, http: HTTPClient, bbl: string): PlutoLot => {
	const url = `${runtime.config.plutoUrl}?bbl=${bbl}&$select=${encodeURIComponent(PLUTO_SELECT)}`
	const resp = http
		.sendRequest(runtime, {
			url,
			method: 'GET',
			multiHeaders: { Accept: { values: ['application/json'] } },
			timeout: '30s',
		})
		.result()
	if (!ok(resp)) throw new Error(`PLUTO request failed: HTTP ${resp.statusCode}`)
	const rows = JSON.parse(text(resp)) as unknown
	if (!Array.isArray(rows) || rows.length === 0) throw new Error(`PLUTO has no record for bbl ${bbl}`)
	const lot = normalizePluto(rows[0] as Record<string, unknown>)
	if (lot.bbl !== bbl) throw new Error(`PLUTO returned bbl ${lot.bbl}, expected ${bbl}`)
	return lot
}

const runLlmAudit = (
	runtime: TeeRuntime<Config>,
	http: HTTPClient,
	apiKey: string,
	lot: PlutoLot,
	submitted: VerifyRequest['submitted'],
): LlmAudit => {
	const body = JSON.stringify({
		model: runtime.config.llmModel,
		max_tokens: 600,
		system: SYSTEM_PROMPT,
		messages: [{ role: 'user', content: buildAuditPrompt(lot, submitted) }],
	})
	const resp = http
		.sendRequest(runtime, {
			url: runtime.config.llmUrl,
			method: 'POST',
			multiHeaders: {
				'content-type': { values: ['application/json'] },
				'x-api-key': { values: [apiKey] },
				'anthropic-version': { values: ['2023-06-01'] },
			},
			body: bytesToBase64(new TextEncoder().encode(body)),
			timeout: '90s',
			cacheSettings: { store: false },
		})
		.result()
	if (!ok(resp)) throw new Error(`LLM request failed: HTTP ${resp.statusCode} ${text(resp).slice(0, 300)}`)

	const parsed = JSON.parse(text(resp)) as { content?: Array<{ type?: string; text?: string }> }
	const textOut = (parsed.content ?? []).find((c) => c.type === 'text' && typeof c.text === 'string')?.text ?? ''
	const audit = parseAudit(textOut)
	if (audit) return audit

	// Fail closed: an unparseable audit becomes a low-confidence "review".
	runtime.log('LLM output was not a parseable audit JSON; treating as review with zero confidence')
	return {
		recommendation: 'review',
		confidence: 0,
		flags: { dataMismatch: false, ownerMismatch: false },
		valueAdjustmentPct: 0,
		reasoning: 'Model output could not be parsed as the required JSON object.',
	}
}

const verifyInEnclave = (runtime: TeeRuntime<Config>, request: VerifyRequest): VerifyOutcome => {
	const http = new HTTPClient()
	const { bbl, submitted } = request

	// 1. Official record
	const lot = fetchPluto(runtime, http, bbl)
	runtime.log(
		`PLUTO ${bbl}: "${lot.address}" ${lot.borough} zoning=${lot.zoning || '-'} lot=${lot.lotAreaSqft} built=${lot.builtAreaSqft} ` +
			`maxFAR=${lot.maxFar} unusedSqft=${lot.unusedSqft} base=$${lot.estValueUsd} ` +
			`landmark=${lot.landmark ? 'yes' : 'no'} histDist=${lot.historicDistrict ? 'yes' : 'no'} special=${lot.specialDistrict || '-'}`,
	)

	// 2. Confidential LLM audit (secret released into the enclave at use time)
	const apiKey = runtime.getSecret({ id: runtime.config.llmSecretId }).result().value
	const audit = runLlmAudit(runtime, http, apiKey, lot, submitted)
	runtime.log(
		`LLM audit ${bbl}: recommendation=${audit.recommendation} confidence=${audit.confidence} ` +
			`dataMismatch=${audit.flags.dataMismatch} ownerMismatch=${audit.flags.ownerMismatch} adj=${audit.valueAdjustmentPct}%`,
	)

	// 3. Flags + verdict rule
	const confidenceBps = Math.round(audit.confidence * 10000)
	let flags = 0
	if (lot.landmark) flags |= FLAGS.LANDMARK
	if (lot.historicDistrict) flags |= FLAGS.HISTORIC_DISTRICT
	if (lot.unusedSqft <= 0) flags |= FLAGS.NO_UNUSED_FAR
	if (audit.flags.dataMismatch) flags |= FLAGS.DATA_MISMATCH
	if (confidenceBps < 7000) flags |= FLAGS.LOW_CONFIDENCE
	if (lot.specialDistrict) flags |= FLAGS.SPECIAL_DISTRICT
	if (audit.flags.ownerMismatch) flags |= FLAGS.OWNER_MISMATCH

	let status: number
	if (flags & (FLAGS.NO_UNUSED_FAR | FLAGS.DATA_MISMATCH)) status = VERDICT_STATUS.DENY
	else if (flags & FLAGS.LOW_CONFIDENCE || audit.recommendation !== 'allow') status = VERDICT_STATUS.REVIEW
	else status = VERDICT_STATUS.ALLOW

	// 4. Value estimate (comparables ± LLM adjustment) and report hash
	const estValueUsd = BigInt(Math.max(0, Math.round(lot.estValueUsd * (1 + audit.valueAdjustmentPct / 100))))
	const reportHash = sha256(canonicalAuditJson(audit))

	runtime.log(
		`Verdict ${bbl}: status=${status} (${['Pending', 'Allow', 'Deny', 'Review'][status]}) ` +
			`confidenceBps=${confidenceBps} flags=${flags} unusedSqft=${lot.unusedSqft} estValueUsd=${estValueUsd} reportHash=${toHex(reportHash)}`,
	)

	return {
		bbl,
		status,
		confidenceBps,
		flags,
		unusedSqft: BigInt(lot.unusedSqft),
		estValueUsd,
		reportHash,
		audit,
		lot: {
			address: lot.address,
			borough: lot.borough,
			zoning: lot.zoning,
			lotAreaSqft: lot.lotAreaSqft,
			builtAreaSqft: lot.builtAreaSqft,
			maxFar: lot.maxFar,
		},
	}
}

// ─── DON side: signed report + Solana write ─────────────────────────────────

const utf8 = (s: string) => new TextEncoder().encode(s)

const derivePdas = (solana: Config['solana'], bbl: string) => {
	const programId = new PublicKey(solana.programId)
	const forwarderState = new PublicKey(solana.forwarderState)
	const [forwarderAuthority] = PublicKey.findProgramAddressSync(
		[utf8('forwarder'), forwarderState.toBytes(), programId.toBytes()],
		new PublicKey(solana.forwarderProgramId),
	)
	const [registry] = PublicKey.findProgramAddressSync([utf8('registry')], programId)
	const [verdict] = PublicKey.findProgramAddressSync([utf8('verdict'), utf8(bbl)], programId)
	return {
		forwarderAuthority: forwarderAuthority.toBase58(),
		registry: registry.toBase58(),
		verdict: verdict.toBase58(),
	}
}

const resolveNetwork = (solana: Config['solana']) => {
	const network = getNetwork({
		chainFamily: 'solana',
		chainSelectorName: solana.chainSelectorName,
		isTestnet: true,
	})
	if (!network) throw new Error(`unknown Solana chain selector name: ${solana.chainSelectorName}`)
	return network
}

type WriteResult = { txSignature: string; explorerUrl: string; verdictPda: string }

const writeVerdict = (runtime: Runtime<Config>, outcome: VerifyOutcome): WriteResult => {
	const solana = runtime.config.solana
	const network = resolveNetwork(solana)
	const pdas = derivePdas(solana, outcome.bbl)

	// keystone-forwarder account layout; order is hashed into the report (see bindings).
	const accounts: SolanaAccountMeta[] = [
		solanaAccountMeta(solana.forwarderState, true),
		solanaAccountMeta(pdas.forwarderAuthority),
		solanaAccountMeta(pdas.registry),
		solanaAccountMeta(pdas.verdict, true),
	]

	const report: VerdictReport = {
		bbl: outcome.bbl,
		status: outcome.status,
		confidenceBps: outcome.confidenceBps,
		flags: outcome.flags,
		unusedSqft: outcome.unusedSqft,
		estValueUsd: outcome.estValueUsd,
		reportHash: outcome.reportHash,
	}

	runtime.log(
		`Writing VerdictReport ${outcome.bbl} to ${solana.programId} via forwarder ${solana.forwarderProgramId} ` +
			`(state=${solana.forwarderState} authority=${pdas.forwarderAuthority} registry=${pdas.registry} verdict=${pdas.verdict})`,
	)

	const receiver = new AirspaceReceiver(new SolanaClient(network.chainSelector.selector), solana.programId)
	const resp = receiver.writeVerdictReport(runtime, report, accounts)

	if (resp.txStatus !== SolanaTxStatus.SUCCESS) {
		throw new Error(`Solana write failed: ${resp.errorMessage || `txStatus=${resp.txStatus}`}`)
	}

	const txSignature = resp.txSignature ? getBase58Decoder().decode(resp.txSignature) : ''
	const explorerUrl = txSignature ? `https://explorer.solana.com/tx/${txSignature}?cluster=devnet` : ''
	runtime.log(`Verdict ${outcome.bbl} recorded on Solana devnet tx=${txSignature || '(no signature returned)'}`)
	return { txSignature, explorerUrl, verdictPda: pdas.verdict }
}

const toResult = (outcome: VerifyOutcome, write: WriteResult) => ({
	bbl: outcome.bbl,
	status: outcome.status,
	confidenceBps: outcome.confidenceBps,
	flags: outcome.flags,
	unusedSqft: outcome.unusedSqft.toString(),
	estValueUsd: outcome.estValueUsd.toString(),
	txSignature: write.txSignature,
	explorerUrl: write.explorerUrl,
	verdictPda: write.verdictPda,
	reportHash: toHex(outcome.reportHash),
	audit: outcome.audit,
	parcel: outcome.lot,
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const onHttpTrigger = (runtime: TeeRuntime<Config>, payload: HttpTriggerPayload): string => {
	if (!payload.input || payload.input.length === 0) throw new Error('HTTP trigger payload is empty')
	const request = verifyRequestSchema.parse(JSON.parse(new TextDecoder().decode(payload.input)))
	runtime.log(`Verify request for bbl=${request.bbl} submitted=${JSON.stringify(request.submitted ?? {})}`)

	// Everything above the crossover runs in the enclave.
	const outcome = verifyInEnclave(runtime, request)

	// Only the derived verdict crosses to the DON.
	const don = runtime.usingTheDons()
	const write = writeVerdict(don, outcome)
	return JSON.stringify(toResult(outcome, write))
}

const onPendingCron = (runtime: TeeRuntime<Config>): string => {
	const http = new HTTPClient()
	const url = `${runtime.config.webBaseUrl}/api/verify/pending`
	const resp = http.sendRequest(runtime, { url, method: 'GET', timeout: '15s' }).result()
	if (!ok(resp)) throw new Error(`pending queue request failed: HTTP ${resp.statusCode}`)
	const pending = pendingSchema.parse(JSON.parse(text(resp))).pending
	const batch = pending.slice(0, runtime.config.maxPendingPerRun)
	runtime.log(`Pending verifications: ${pending.length}, processing ${batch.length} (max ${runtime.config.maxPendingPerRun})`)

	if (batch.length === 0) return JSON.stringify({ processed: 0, results: [] })

	const outcomes: Array<{ bbl: string; outcome?: VerifyOutcome; error?: string }> = []
	for (const { bbl } of batch) {
		try {
			outcomes.push({ bbl, outcome: verifyInEnclave(runtime, { bbl }) })
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			runtime.log(`Verification failed for ${bbl}: ${message}`)
			outcomes.push({ bbl, error: message })
		}
	}

	const don = runtime.usingTheDons()
	const results = outcomes.map(({ bbl, outcome, error }) => {
		if (!outcome) return { bbl, error }
		try {
			return toResult(outcome, writeVerdict(don, outcome))
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			runtime.log(`Solana write failed for ${bbl}: ${message}`)
			return { ...toResult(outcome, { txSignature: '', explorerUrl: '', verdictPda: '' }), error: message }
		}
	})
	return JSON.stringify({ processed: results.length, results })
}

const initWorkflow = (config: Config) => {
	const httpTrigger = new HTTPCapability()
	const cron = new CronCapability()
	return [
		// Handler 0: on-demand verification (web app -> `cre workflow simulate --http-payload`)
		handlerInTee(httpTrigger.trigger({}), onHttpTrigger, {}),
		// Handler 1: sweep the pending queue
		handlerInTee(cron.trigger({ schedule: config.pendingSchedule }), onPendingCron, {}),
	]
}

export async function main() {
	const runner = await Runner.newRunner<Config>({ configSchema })
	await runner.run(initWorkflow)
}

main()
