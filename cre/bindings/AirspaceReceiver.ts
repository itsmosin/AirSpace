// TypeScript bindings for the AirSpace Solana program as seen from a CRE workflow.
//
// Two things live here:
//   1. `verdictReportCodec` — the Borsh layout of the `VerdictReport` payload the
//      keystone forwarder hands to `on_report` (byte-exact with the on-chain struct).
//   2. `AirspaceReceiver` — writes a VerdictReport through `SolanaClient.writeReport`
//      and reads back a `Verdict` account (Anchor discriminator + Borsh fields).
//
// Regenerate with `cre generate-bindings solana --language typescript` once the
// program IDL is final; the hand-written shape below mirrors that generator's output.
import {
	bytesToBase64,
	bytesToHex,
	calculateAccountsHash,
	consensusIdenticalAggregation,
	encodeForwarderReport,
	HTTPClient,
	type HTTPSendRequester,
	ok,
	prepareSolanaReportRequest,
	type Runtime,
	type SolanaAccountMeta,
	type SolanaClient,
	type SolanaComputeConfig,
	solanaAccountMetasToJson,
	solanaAddressToBytes,
	text,
} from '@chainlink/cre-sdk'
import {
	addCodecSizePrefix,
	fixCodecSize,
	getBytesCodec,
	getI64Codec,
	getStructCodec,
	getU16Codec,
	getU32Codec,
	getU64Codec,
	getU8Codec,
	getUtf8Codec,
} from '@solana/codecs'
import { PublicKey } from '@solana/web3.js'

export const AIRSPACE_PROGRAM_ID = '5PNnqSxWCktbS7pUtt5MXCuQEVfztjYuLpvVvbB3oxeZ'
export const SOLANA_DEVNET_RPC = 'https://api.devnet.solana.com'

// Minimal base64 decoder (the WASM runtime has no atob / Buffer guarantee).
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const base64ToBytes = (b64: string): Uint8Array => {
	const clean = b64.replace(/[^A-Za-z0-9+/]/g, '')
	const out: number[] = []
	let bits = 0
	let acc = 0
	for (const ch of clean) {
		acc = (acc << 6) | B64.indexOf(ch)
		bits += 6
		if (bits >= 8) {
			bits -= 8
			out.push((acc >> bits) & 0xff)
		}
	}
	return Uint8Array.from(out)
}

/** What each node observes when reading an account over JSON-RPC (identical consensus). */
type AccountSnapshot = { exists: boolean; dataBase64: string }

/** Anchor instruction discriminator: sha256("global:on_report")[0..8] */
export const ON_REPORT_DISCRIMINATOR = new Uint8Array([214, 173, 18, 221, 173, 148, 151, 208])
/** Anchor account discriminator: sha256("account:Verdict")[0..8] */
export const ACCOUNT_VERDICT_DISCRIMINATOR = new Uint8Array([169, 1, 171, 69, 24, 106, 66, 193])
/** Anchor account discriminator: sha256("account:Registry")[0..8] */
export const ACCOUNT_REGISTRY_DISCRIMINATOR = new Uint8Array([47, 174, 110, 246, 184, 182, 252, 218])

export const VERDICT_STATUS = { PENDING: 0, ALLOW: 1, DENY: 2, REVIEW: 3 } as const
export const VERDICT_SOURCE = { MANUAL: 0, CRE: 1 } as const

// ---------------------------------------------------------------------------
// VerdictReport — the report payload written by the CRE workflow
// ---------------------------------------------------------------------------

export type VerdictReport = {
	/** 10-digit NYC Borough-Block-Lot */
	bbl: string
	/** 1 Allow, 2 Deny, 3 Review */
	status: number
	/** 0..10000 */
	confidenceBps: number
	/** bitmask, see VERDICT_FLAGS */
	flags: number
	unusedSqft: bigint
	/** whole dollars */
	estValueUsd: bigint
	/** sha256 of the canonical LLM JSON report */
	reportHash: Uint8Array
}

// Borsh: bbl (u32 LE len + utf8), status u8, confidence_bps u16, flags u32,
// unused_sqft u64, est_value_usd u64, report_hash [u8; 32]
export const verdictReportCodec = getStructCodec([
	['bbl', addCodecSizePrefix(getUtf8Codec(), getU32Codec())],
	['status', getU8Codec()],
	['confidenceBps', getU16Codec()],
	['flags', getU32Codec()],
	['unusedSqft', getU64Codec()],
	['estValueUsd', getU64Codec()],
	['reportHash', fixCodecSize(getBytesCodec(), 32)],
])

export const encodeVerdictReport = (report: VerdictReport): Uint8Array => {
	if (report.reportHash.length !== 32) {
		throw new Error(`reportHash must be 32 bytes, got ${report.reportHash.length}`)
	}
	return new Uint8Array(verdictReportCodec.encode(report))
}

export const decodeVerdictReport = (data: Uint8Array): VerdictReport =>
	verdictReportCodec.decode(data) as VerdictReport

// ---------------------------------------------------------------------------
// Verdict account — what lives on-chain at PDA ["verdict", bbl]
// ---------------------------------------------------------------------------

export type VerdictAccount = {
	bbl: string
	status: number
	confidenceBps: number
	flags: number
	unusedSqft: bigint
	estValueUsd: bigint
	reportHash: Uint8Array
	source: number
	requester: Uint8Array
	requestedAt: bigint
	recordedAt: bigint
	bump: number
}

export const verdictAccountCodec = getStructCodec([
	['bbl', addCodecSizePrefix(getUtf8Codec(), getU32Codec())],
	['status', getU8Codec()],
	['confidenceBps', getU16Codec()],
	['flags', getU32Codec()],
	['unusedSqft', getU64Codec()],
	['estValueUsd', getU64Codec()],
	['reportHash', fixCodecSize(getBytesCodec(), 32)],
	['source', getU8Codec()],
	['requester', fixCodecSize(getBytesCodec(), 32)],
	['requestedAt', getI64Codec()],
	['recordedAt', getI64Codec()],
	['bump', getU8Codec()],
])

const DISCRIMINATOR_SIZE = 8

const expectDiscriminator = (label: string, expected: Uint8Array, data: Uint8Array): Uint8Array => {
	if (data.length < DISCRIMINATOR_SIZE) {
		throw new Error(`${label}: data too short for discriminator (${data.length} bytes)`)
	}
	for (let i = 0; i < DISCRIMINATOR_SIZE; i++) {
		if (data[i] !== expected[i]) throw new Error(`${label}: discriminator mismatch`)
	}
	return data.subarray(DISCRIMINATOR_SIZE)
}

/** Decodes raw Verdict account data (with its 8-byte Anchor discriminator). */
export const decodeVerdictAccount = (data: Uint8Array): VerdictAccount =>
	verdictAccountCodec.decode(
		expectDiscriminator('account Verdict', ACCOUNT_VERDICT_DISCRIMINATOR, data),
	) as VerdictAccount

// ---------------------------------------------------------------------------
// Receiver client
// ---------------------------------------------------------------------------

// The capability rejects an omitted computeConfig, so always send one.
const DEFAULT_COMPUTE_CONFIG: SolanaComputeConfig = { computeLimit: 300_000 }

export class AirspaceReceiver {
	readonly programId: Uint8Array

	constructor(
		private readonly client: SolanaClient,
		programId: string | Uint8Array = AIRSPACE_PROGRAM_ID,
	) {
		this.programId = typeof programId === 'string' ? solanaAddressToBytes(programId) : programId
	}

	/**
	 * Signs a Borsh-encoded `VerdictReport` as a CRE report and delivers it to the
	 * program's `on_report` instruction through the keystone forwarder.
	 *
	 * `remainingAccounts` must be, in order (the full list is hashed into the report
	 * and verified on-chain; the forwarder strips [0] and [1] before the CPI):
	 *   [0] forwarderState      (writable)
	 *   [1] forwarderAuthority  PDA ["forwarder", forwarderState, airspaceProgramId] under the forwarder program
	 *   [2] registry PDA        ["registry"]            (readonly)
	 *   [3] verdict PDA         ["verdict", bbl bytes]  (writable, must already exist)
	 */
	writeVerdictReport(
		runtime: Runtime<unknown>,
		report: VerdictReport,
		remainingAccounts: SolanaAccountMeta[],
		computeConfig?: SolanaComputeConfig,
	) {
		const payload = encodeVerdictReport(report)

		const signed = runtime
			.report(
				prepareSolanaReportRequest(
					encodeForwarderReport({
						accountHash: calculateAccountsHash(remainingAccounts),
						payload,
					}),
				),
			)
			.result()

		return this.client
			.writeReport(runtime, {
				remainingAccounts: solanaAccountMetasToJson(remainingAccounts),
				receiver: bytesToHex(this.programId),
				computeConfig: computeConfig ?? DEFAULT_COMPUTE_CONFIG,
				report: signed,
			})
			.result()
	}

	/**
	 * Reads the Verdict account at `verdictPda` and decodes it (Anchor discriminator
	 * + Borsh fields). The SDK's Solana capability only exposes `writeReport`, so the
	 * read goes through the HTTP capability against the cluster's JSON-RPC
	 * `getAccountInfo` (base64, confirmed) and is agreed by identical consensus.
	 *
	 * `exists` is false when the account has no lamports / does not exist yet
	 * (the web app must call `open_verdict` before a verdict can be written).
	 */
	readVerdict(
		runtime: Runtime<unknown>,
		verdictPda: string | Uint8Array,
		rpcUrl: string = SOLANA_DEVNET_RPC,
	): { exists: boolean; account: VerdictAccount | null } {
		const address =
			typeof verdictPda === 'string' ? verdictPda : new PublicKey(verdictPda).toBase58()

		const fetchAccount = (sender: HTTPSendRequester, url: string, pda: string): AccountSnapshot => {
			const body = JSON.stringify({
				jsonrpc: '2.0',
				id: 1,
				method: 'getAccountInfo',
				params: [pda, { encoding: 'base64', commitment: 'confirmed' }],
			})
			const resp = sender
				.sendRequest({
					url,
					method: 'POST',
					multiHeaders: { 'content-type': { values: ['application/json'] } },
					body: bytesToBase64(new TextEncoder().encode(body)),
					cacheSettings: { store: false },
				})
				.result()
			if (!ok(resp)) throw new Error(`getAccountInfo failed: HTTP ${resp.statusCode}`)
			const parsed = JSON.parse(text(resp)) as {
				result?: { value?: { lamports?: number; data?: [string, string] } | null }
				error?: { message?: string }
			}
			if (parsed.error) throw new Error(`getAccountInfo error: ${parsed.error.message ?? 'unknown'}`)
			const value = parsed.result?.value
			if (!value || !(value.lamports && value.lamports > 0)) return { exists: false, dataBase64: '' }
			return { exists: true, dataBase64: value.data?.[0] ?? '' }
		}

		const snapshot = new HTTPClient()
			.sendRequest(runtime, fetchAccount, consensusIdenticalAggregation<AccountSnapshot>())(rpcUrl, address)
			.result()

		if (!snapshot.exists) return { exists: false, account: null }
		if (!snapshot.dataBase64) return { exists: true, account: null }
		return { exists: true, account: decodeVerdictAccount(base64ToBytes(snapshot.dataBase64)) }
	}
}
