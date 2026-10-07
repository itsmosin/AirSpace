import { AnchorProvider, Program, type Idl, type Provider } from "@coral-xyz/anchor";
import type { Connection } from "@solana/web3.js";
import { AIRSPACE_IDL } from "./idl";

export type AirspaceProgram = Program<Idl>;

/** Program bound to a signing provider (wallet adapter in the browser, Keypair wallet on the server). */
export function getProgram(provider: Provider): AirspaceProgram {
  return new Program(AIRSPACE_IDL, provider);
}

/** Read-only program for decoding accounts and building instructions without a wallet. */
export function getReadonlyProgram(connection: Connection): AirspaceProgram {
  const provider: Provider = { connection };
  return new Program(AIRSPACE_IDL, provider);
}

export function makeProvider(connection: Connection, wallet: AnchorProvider["wallet"]) {
  return new AnchorProvider(connection, wallet, { commitment: "confirmed", preflightCommitment: "confirmed" });
}
