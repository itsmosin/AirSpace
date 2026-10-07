// The Anchor IDL for the AirSpace program.
//
// `src/idl/airspace.json` is produced by `scripts/sync-idl.mjs` (runs before `dev`/`build`):
// it prefers the real IDL emitted by `anchor build` at `packages/shared/idl/airspace.json`
// and falls back to `src/idl/airspace.provisional.json`, which mirrors docs/INTERFACES.md section 1.
import type { Idl } from "@coral-xyz/anchor";
import rawIdl from "@/idl/airspace.json";
import { PUBLIC_ENV } from "@/lib/env";

export const AIRSPACE_IDL: Idl = { ...(rawIdl as unknown as Idl), address: PUBLIC_ENV.programId };
export const IDL_IS_PROVISIONAL = /provisional/i.test(String((rawIdl as { metadata?: { description?: string } }).metadata?.description ?? ""));
