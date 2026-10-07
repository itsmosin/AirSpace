import "server-only";
import { PublicKey } from "@solana/web3.js";
import {
  deriveAttestationPda,
  fetchAttestation,
  issueKycAttestation,
  issueOwnerAttestation,
  loadSasConfig as loadSasConfigFile,
  ownerNoncePda,
  type SasConfig,
  type SasContext,
} from "@airspace/sas";
import { SERVER_ENV } from "@/lib/server/env";
import { loadRegistrar } from "@/lib/server/registrar";
import { PROGRAM_ID } from "@/lib/airspace/pdas";

// Server-side adapter around `@airspace/sas` (packages/sas). The registrar keypair signs every
// attestation; addresses of the credential + schemas come from keys/sas-config.json.

export type { SasConfig, SasContext };

export class SasUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SasUnavailableError";
  }
}

export function loadSasConfig(): SasConfig | null {
  try {
    const inline = process.env.SAS_CONFIG_JSON;
    if (inline && inline.trim()) return JSON.parse(inline) as SasConfig;
    return loadSasConfigFile(SERVER_ENV.sasConfigPath);
  } catch {
    return null;
  }
}

export function getSasContext(): { ctx: SasContext; config: SasConfig } {
  const registrar = loadRegistrar();
  if (!registrar) throw new SasUnavailableError(`Registrar keypair not found at ${SERVER_ENV.registrarKeypairPath} (set REGISTRAR_KEYPAIR_PATH).`);
  const config = loadSasConfig();
  if (!config) throw new SasUnavailableError(`SAS config not found at ${SERVER_ENV.sasConfigPath}. Run \`bun scripts/setup-sas.ts\` first.`);
  return { ctx: { rpcUrl: SERVER_ENV.rpcUrl, registrar }, config };
}

export async function issueKyc(wallet: PublicKey, level: number) {
  const { ctx, config } = getSasContext();
  const res = await issueKycAttestation(ctx, config, { wallet, level });
  return { attestation: res.attestation.toBase58(), txSignature: res.txSignature, alreadyExisted: res.alreadyExisted };
}

export async function issueOwner(wallet: PublicKey, bbl: string) {
  const { ctx, config } = getSasContext();
  const res = await issueOwnerAttestation(ctx, config, { wallet, bbl });
  return { attestation: res.attestation.toBase58(), txSignature: res.txSignature, alreadyExisted: res.alreadyExisted };
}

export function expectedKycPda(config: SasConfig, wallet: PublicKey) {
  return deriveAttestationPda(new PublicKey(config.credential), new PublicKey(config.kycSchema), wallet);
}

export function expectedOwnerPda(config: SasConfig, wallet: PublicKey, bbl: string) {
  return deriveAttestationPda(new PublicKey(config.credential), new PublicKey(config.ownerSchema), ownerNoncePda(PROGRAM_ID, wallet, bbl));
}

export async function readAttestation(pda: PublicKey) {
  return fetchAttestation(SERVER_ENV.rpcUrl, pda);
}
