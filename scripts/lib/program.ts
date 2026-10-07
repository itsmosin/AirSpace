/** Anchor client for the `airspace` program plus its PDAs. */
import { existsSync, readFileSync } from 'node:fs';
import { type AccountClient, AnchorProvider, Program, Wallet, type Idl } from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import { AIRSPACE_PROGRAM_ID, SEEDS } from '@airspace/shared';
import { PATHS, connection, fail } from './env';

export const PROGRAM_ID = new PublicKey(AIRSPACE_PROGRAM_ID);

export function loadIdl(): Idl {
  if (!existsSync(PATHS.idl)) {
    fail(`program IDL not found at ${PATHS.idl}\n       build + copy it first:  bun run program:build  (from the repo root)`);
  }
  const idl = JSON.parse(readFileSync(PATHS.idl, 'utf8')) as Idl & { address?: string };
  if (idl.address && idl.address !== AIRSPACE_PROGRAM_ID) {
    fail(`IDL address ${idl.address} does not match AIRSPACE_PROGRAM_ID ${AIRSPACE_PROGRAM_ID}`);
  }
  return idl;
}

/** Program handle whose default signer/payer is `signer`. */
export function airspaceProgram(signer: Keypair): Program {
  const provider = new AnchorProvider(connection(), new Wallet(signer), { commitment: 'confirmed' });
  return new Program(loadIdl(), provider);
}

const seed = (s: string) => Buffer.from(s, 'utf8');
export const pda = {
  registry: (): PublicKey => PublicKey.findProgramAddressSync([seed(SEEDS.registry)], PROGRAM_ID)[0],
  verdict: (bbl: string): PublicKey => PublicKey.findProgramAddressSync([seed(SEEDS.verdict), seed(bbl)], PROGRAM_ID)[0],
  parcel: (bbl: string): PublicKey => PublicKey.findProgramAddressSync([seed(SEEDS.parcel), seed(bbl)], PROGRAM_ID)[0],
  listing: (parcel: PublicKey): PublicKey => PublicKey.findProgramAddressSync([seed(SEEDS.listing), parcel.toBuffer()], PROGRAM_ID)[0],
  escrow: (): PublicKey => PublicKey.findProgramAddressSync([seed(SEEDS.escrow)], PROGRAM_ID)[0],
};

/** Anchor error name from a thrown rpc() error, if any. */
export function anchorErrorName(e: unknown): string | undefined {
  const err = e as { error?: { errorCode?: { code?: string } }; message?: string };
  return err?.error?.errorCode?.code ?? /Error Code: (\w+)/.exec(err?.message ?? '')?.[1];
}

/** Account clients by name; the untyped `Program<Idl>` namespace does not know our account names. */
export const accountsOf = (program: Program): Record<'registry' | 'verdict' | 'parcel' | 'listing', AccountClient> =>
  program.account as unknown as Record<'registry' | 'verdict' | 'parcel' | 'listing', AccountClient>;
