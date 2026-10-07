import { PublicKey } from "@solana/web3.js";
import { SAS_PROGRAM_ID, SEEDS } from "@airspace/shared";
import { PUBLIC_ENV } from "@/lib/env";

export const PROGRAM_ID = new PublicKey(PUBLIC_ENV.programId);
export const SAS_PROGRAM = new PublicKey(SAS_PROGRAM_ID);

const utf8 = (s: string) => Buffer.from(s, "utf8");

export function registryPda(programId: PublicKey = PROGRAM_ID) {
  return PublicKey.findProgramAddressSync([utf8(SEEDS.registry)], programId)[0];
}
export function verdictPda(bbl: string, programId: PublicKey = PROGRAM_ID) {
  return PublicKey.findProgramAddressSync([utf8(SEEDS.verdict), utf8(bbl)], programId)[0];
}
export function parcelPda(bbl: string, programId: PublicKey = PROGRAM_ID) {
  return PublicKey.findProgramAddressSync([utf8(SEEDS.parcel), utf8(bbl)], programId)[0];
}
export function listingPda(parcel: PublicKey, programId: PublicKey = PROGRAM_ID) {
  return PublicKey.findProgramAddressSync([utf8(SEEDS.listing), parcel.toBuffer()], programId)[0];
}
export function escrowPda(programId: PublicKey = PROGRAM_ID) {
  return PublicKey.findProgramAddressSync([utf8(SEEDS.escrow)], programId)[0];
}
/** Nonce used for the owner attestation of (wallet, bbl). */
export function ownerNoncePda(wallet: PublicKey, bbl: string, programId: PublicKey = PROGRAM_ID) {
  return PublicKey.findProgramAddressSync([utf8(SEEDS.ownerNonce), wallet.toBuffer(), utf8(bbl)], programId)[0];
}
/** SAS attestation PDA: ["attestation", credential, schema, nonce] under the SAS program. */
export function attestationPda(credential: PublicKey, schema: PublicKey, nonce: PublicKey) {
  return PublicKey.findProgramAddressSync([utf8("attestation"), credential.toBuffer(), schema.toBuffer(), nonce.toBuffer()], SAS_PROGRAM)[0];
}
