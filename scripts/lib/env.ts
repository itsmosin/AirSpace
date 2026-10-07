/** Paths, keypairs, RPC and CLI plumbing shared by every script. */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Connection, Keypair, type PublicKey } from '@solana/web3.js';
import { DEVNET_RPC } from '@airspace/shared';

export const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const RPC_URL = process.env.SOLANA_RPC_URL ?? DEVNET_RPC;

export const PATHS = {
  registrarKeypair: process.env.REGISTRAR_KEYPAIR_PATH ?? resolve(REPO_ROOT, 'keys/registrar-keypair.json'),
  deployerKeypair: process.env.DEPLOYER_KEYPAIR_PATH ?? resolve(homedir(), '.config/solana/airspace-deployer.json'),
  sasConfig: process.env.SAS_CONFIG_PATH ?? resolve(REPO_ROOT, 'keys/sas-config.json'),
  idl: resolve(REPO_ROOT, 'packages/shared/idl/airspace.json'),
};

export function loadKeypair(path: string): Keypair {
  if (!existsSync(path)) fail(`keypair not found: ${path}`);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, 'utf8'))));
}

export const connection = (): Connection => new Connection(RPC_URL, 'confirmed');

const cluster = RPC_URL.includes('devnet') ? 'devnet' : RPC_URL.includes('mainnet') ? 'mainnet-beta' : `custom&customUrl=${encodeURIComponent(RPC_URL)}`;
export const explorerAddress = (k: PublicKey | string): string => `https://explorer.solana.com/address/${k.toString()}?cluster=${cluster}`;
export const explorerTx = (sig: string): string => `https://explorer.solana.com/tx/${sig}?cluster=${cluster}`;

export function fail(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

/** Minimal `--key value` / `--flag` parser. */
export function parseArgs(argv: string[] = process.argv.slice(2)): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else out[key] = true;
  }
  return out;
}

export const fmtUsd = (n: number | bigint): string => `$${Number(n).toLocaleString('en-US')}`;
export const fmtSqft = (n: number | bigint): string => `${Number(n).toLocaleString('en-US')} sqft`;
