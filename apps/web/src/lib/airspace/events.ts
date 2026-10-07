import { BorshCoder, EventParser } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { AIRSPACE_IDL } from "./idl";

export type ParsedEvent = { name: string; data: Record<string, unknown> };

let coder: BorshCoder | null = null;
export function getCoder() {
  if (!coder) coder = new BorshCoder(AIRSPACE_IDL);
  return coder;
}

/** Parse Anchor events (`emit!`) from transaction log messages. */
export function parseEventsFromLogs(programId: PublicKey, logs: string[]): ParsedEvent[] {
  const parser = new EventParser(programId, getCoder());
  const out: ParsedEvent[] = [];
  try {
    for (const ev of parser.parseLogs(logs, false)) out.push({ name: ev.name, data: ev.data as Record<string, unknown> });
  } catch {
    // tolerate malformed logs
  }
  return out;
}

/** Decode an instruction name from its raw data (8-byte discriminator). */
export function decodeInstructionName(data: Buffer): string | null {
  try {
    const ix = getCoder().instruction.decode(data);
    return ix?.name ?? null;
  } catch {
    return null;
  }
}

export function toCamel(s: string) {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** Convert BN/PublicKey/byte arrays in event data into JSON-friendly values. */
export function plainEventData(data: Record<string, unknown>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v instanceof PublicKey) out[k] = v.toBase58();
    else if (typeof v === "object" && v !== null && "toString" in v && typeof (v as { toNumber?: unknown }).toNumber === "function") out[k] = (v as { toString: () => string }).toString();
    else if (Array.isArray(v)) out[k] = Buffer.from(v as number[]).toString("hex");
    else if (typeof v === "string" || typeof v === "number") out[k] = v;
    else out[k] = String(v);
  }
  return out;
}
