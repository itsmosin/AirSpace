/** Open (or re-open) a pending verdict so the CRE verifier can fill it. Usage: bun run open-verdict.ts --bbl 1011310016 */
import { SystemProgram } from '@solana/web3.js';
import { PATHS, explorerTx, fail, loadKeypair, parseArgs } from './lib/env';
import { airspaceProgram, anchorErrorName, pda } from './lib/program';

const args = parseArgs();
const bbl = typeof args.bbl === 'string' ? args.bbl : fail('--bbl <10 digits> is required');
if (!/^\d{10}$/.test(bbl)) fail('bbl must be 10 digits');
const registrar = loadKeypair(PATHS.registrarKeypair);
const program = airspaceProgram(registrar);
try {
  const sig = await program.methods
    .openVerdict(bbl)
    .accountsPartial({ payer: registrar.publicKey, verdict: pda.verdict(bbl), parcel: pda.parcel(bbl), systemProgram: SystemProgram.programId })
    .rpc();
  console.log(`open_verdict ${bbl}: ${explorerTx(sig)}`);
} catch (e) {
  if (anchorErrorName(e) === 'VerdictLocked') console.log(`verdict ${bbl} is locked (already minted)`);
  else throw e;
}
