/** PLUTO fetch → verdict math (INTERFACES §4) → on-chain manual verdict. */
import { createHash } from 'node:crypto';
import { BN, type Program } from '@coral-xyz/anchor';
import { type Keypair, type PublicKey, SystemProgram } from '@solana/web3.js';
import { FLAGS, PLUTO_SELECT, PLUTO_URL, normalizePluto, type PlutoLot, type VerdictStatus } from '@airspace/shared';
import { accountsOf, anchorErrorName, pda } from './program';

export type VerdictOverride = 'allow' | 'deny' | 'review';
export const STATUS_CODE: Record<VerdictOverride, 1 | 2 | 3> = { allow: 1, deny: 2, review: 3 };
export const STATUS_NAME: Record<number, string> = { 0: 'Pending', 1: 'Allow', 2: 'Deny', 3: 'Review' };

/** Manual verdicts are registrar-reviewed; no LLM is involved, so confidence is full. */
export const MANUAL_CONFIDENCE_BPS = 10_000;

export type ComputedVerdict = {
  bbl: string;
  lot: PlutoLot;
  rawRow: Record<string, unknown>;
  /** What the §4 rule says on its own. */
  ruleStatus: 1 | 2 | 3;
  /** What will be written (override wins). */
  status: 1 | 2 | 3;
  confidenceBps: number;
  flags: number;
  flagNames: string[];
  reportHash: Uint8Array;
};

/** Fetch one PLUTO row by BBL. Throws when the lot is unknown. */
export async function fetchPlutoRow(bbl: string): Promise<Record<string, unknown>> {
  if (!/^\d{10}$/.test(bbl)) throw new Error(`BBL must be 10 digits, got "${bbl}"`);
  const url = `${PLUTO_URL}?bbl=${bbl}&$select=${encodeURIComponent(PLUTO_SELECT)}`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`PLUTO ${res.status} for bbl ${bbl}`);
  const rows = (await res.json()) as Record<string, unknown>[];
  if (!rows.length) throw new Error(`PLUTO has no row for bbl ${bbl}`);
  return rows[0];
}

export function computeVerdict(rawRow: Record<string, unknown>, override?: VerdictOverride): ComputedVerdict {
  const lot = normalizePluto(rawRow);
  let flags = 0;
  if (lot.landmark) flags |= FLAGS.LANDMARK;
  if (lot.historicDistrict) flags |= FLAGS.HISTORIC_DISTRICT;
  if (lot.unusedSqft <= 0) flags |= FLAGS.NO_UNUSED_FAR;
  if (lot.specialDistrict) flags |= FLAGS.SPECIAL_DISTRICT;
  const confidenceBps = MANUAL_CONFIDENCE_BPS;
  if (confidenceBps < 7000) flags |= FLAGS.LOW_CONFIDENCE;

  const ruleStatus: 1 | 2 | 3 =
    flags & (FLAGS.NO_UNUSED_FAR | FLAGS.DATA_MISMATCH) ? 2 : flags & FLAGS.LOW_CONFIDENCE ? 3 : 1;
  const status = override ? STATUS_CODE[override] : ruleStatus;

  // report_hash = sha256 of the PLUTO row JSON (the "report" behind a manual verdict).
  const reportHash = new Uint8Array(createHash('sha256').update(JSON.stringify(rawRow)).digest());
  const flagNames = Object.entries(FLAGS).filter(([, bit]) => flags & bit).map(([name]) => name);
  return { bbl: lot.bbl, lot, rawRow, ruleStatus, status, confidenceBps, flags, flagNames, reportHash };
}

export function describeVerdict(v: ComputedVerdict): string {
  const l = v.lot;
  return [
    `  ${l.address} (${l.borough} ${l.zipcode})  zoning ${l.zoning}${l.specialDistrict ? ` / ${l.specialDistrict}` : ''}`,
    `  lot ${l.lotAreaSqft.toLocaleString()} sqft, built ${l.builtAreaSqft.toLocaleString()} sqft, max FAR ${l.maxFar}` +
      ` → unused ${l.unusedSqft.toLocaleString()} sqft ≈ $${l.estValueUsd.toLocaleString()}`,
    `  flags ${v.flags} [${v.flagNames.join(', ') || 'none'}]  rule → ${STATUS_NAME[v.ruleStatus]}` +
      (v.status !== v.ruleStatus ? `  (registrar override → ${STATUS_NAME[v.status]})` : ''),
    `  report_hash ${Buffer.from(v.reportHash).toString('hex')}`,
  ].join('\n');
}

export type OnChainVerdict = { bbl: string; status: VerdictStatus; unusedSqft: bigint; estValueUsd: bigint; source: number };

export async function fetchVerdict(program: Program, bbl: string): Promise<OnChainVerdict | null> {
  const acc = (await accountsOf(program).verdict.fetchNullable(pda.verdict(bbl))) as
    | { bbl: string; status: number; unusedSqft: BN; estValueUsd: BN; source: number }
    | null;
  if (!acc) return null;
  return {
    bbl: acc.bbl,
    status: acc.status as VerdictStatus,
    unusedSqft: BigInt(acc.unusedSqft.toString()),
    estValueUsd: BigInt(acc.estValueUsd.toString()),
    source: acc.source,
  };
}

/**
 * `open_verdict` (idempotent; a locked Allow+Parcel verdict is reported, not fatal) followed by
 * `record_verdict_manual`. `program` must be bound to the registrar keypair.
 */
export async function recordManualVerdict(
  program: Program,
  registrar: Keypair,
  v: ComputedVerdict,
): Promise<{ verdict: PublicKey; openSig?: string; recordSig: string }> {
  const verdict = pda.verdict(v.bbl);
  let openSig: string | undefined;
  try {
    openSig = await program.methods
      .openVerdict(v.bbl)
      .accountsPartial({ payer: registrar.publicKey, verdict, systemProgram: SystemProgram.programId })
      .rpc();
  } catch (e) {
    if (anchorErrorName(e) !== 'VerdictLocked') throw e;
    console.log(`  open_verdict: verdict for ${v.bbl} is locked (Allow + parcel minted); leaving as is`);
  }
  const recordSig = await program.methods
    .recordVerdictManual(
      v.status,
      v.confidenceBps,
      v.flags,
      new BN(v.lot.unusedSqft),
      new BN(v.lot.estValueUsd),
      Array.from(v.reportHash),
    )
    .accountsPartial({ registrar: registrar.publicKey, registry: pda.registry(), verdict })
    .rpc();
  return { verdict, openSig, recordSig };
}
