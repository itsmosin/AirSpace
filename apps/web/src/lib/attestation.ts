// Client-side reads of Solana Attestation Service accounts (layout per docs/INTERFACES.md section 5).
import { PublicKey, type Connection } from "@solana/web3.js";
import { SAS_PROGRAM, attestationPda, ownerNoncePda } from "@/lib/airspace/pdas";

export type AttestationInfo = {
  pda: string;
  nonce: string;
  credential: string;
  schema: string;
  data: Uint8Array;
  signer: string;
  expiry: number;
  expired: boolean;
};

export function parseAttestation(pda: PublicKey, raw: Uint8Array): AttestationInfo {
  const buf = Buffer.from(raw);
  const nonce = new PublicKey(buf.subarray(1, 33));
  const credential = new PublicKey(buf.subarray(33, 65));
  const schema = new PublicKey(buf.subarray(65, 97));
  const len = buf.readUInt32LE(97);
  const data = buf.subarray(101, 101 + len);
  let o = 101 + len;
  const signer = new PublicKey(buf.subarray(o, o + 32)); o += 32;
  const expiry = Number(buf.readBigInt64LE(o));
  const now = Math.floor(Date.now() / 1000);
  return {
    pda: pda.toBase58(), nonce: nonce.toBase58(), credential: credential.toBase58(), schema: schema.toBase58(),
    data: new Uint8Array(data), signer: signer.toBase58(), expiry, expired: expiry !== 0 && expiry <= now,
  };
}

export async function fetchAttestationInfo(connection: Connection, pda: PublicKey): Promise<AttestationInfo | null> {
  const info = await connection.getAccountInfo(pda);
  if (!info || !info.owner.equals(SAS_PROGRAM)) return null;
  try {
    return parseAttestation(pda, info.data);
  } catch {
    return null;
  }
}

export function kycAttestationPda(credential: PublicKey, schema: PublicKey, wallet: PublicKey) {
  return attestationPda(credential, schema, wallet);
}

export function ownerAttestationPda(credential: PublicKey, schema: PublicKey, wallet: PublicKey, bbl: string, programId?: PublicKey) {
  return attestationPda(credential, schema, ownerNoncePda(wallet, bbl, programId));
}

export function kycLevel(a: AttestationInfo | null) {
  return a && a.data.length > 0 ? a.data[0] : 0;
}
