import "server-only";
import fs from "node:fs";
import { Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import { getProgram } from "@/lib/airspace/program";
import { getServerConnection } from "./connection";
import { SERVER_ENV } from "./env";

/** Minimal Anchor wallet backed by a Keypair (server only). */
export class KeypairWallet {
  constructor(readonly payer: Keypair) {}
  get publicKey(): PublicKey {
    return this.payer.publicKey;
  }
  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if (tx instanceof VersionedTransaction) tx.sign([this.payer]);
    else tx.partialSign(this.payer);
    return tx;
  }
  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    for (const tx of txs) await this.signTransaction(tx);
    return txs;
  }
}

export function loadKeypair(filePath: string): Keypair {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

export function loadRegistrar(): Keypair | null {
  try {
    return loadKeypair(SERVER_ENV.registrarKeypairPath);
  } catch {
    return null;
  }
}

export function registrarProgram() {
  const registrar = loadRegistrar();
  if (!registrar) throw new Error(`Registrar keypair not found at ${SERVER_ENV.registrarKeypairPath} (set REGISTRAR_KEYPAIR_PATH)`);
  const connection = getServerConnection();
  const provider = new AnchorProvider(connection, new KeypairWallet(registrar), { commitment: "confirmed" });
  return { registrar, provider, program: getProgram(provider) };
}
