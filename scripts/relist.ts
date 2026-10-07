/** Cancel an active listing (if any) and relist a parcel at a new USD price. Usage: bun run relist.ts --bbl 1008300001 --usd 25 [--owner deployer|<keypair path>] */
import { BN } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { MPL_CORE_PROGRAM_ID } from '@airspace/shared';
import { PATHS, explorerTx, fail, loadKeypair, parseArgs } from './lib/env';
import { accountsOf, airspaceProgram, pda } from './lib/program';

const args = parseArgs();
const bbl = typeof args.bbl === 'string' ? args.bbl : fail('--bbl required');
const usd = Number(args.usd);
if (!(usd > 0)) fail('--usd <price in dollars> required');
const ownerPath = typeof args.owner === 'string' && args.owner !== 'deployer' ? args.owner : PATHS.deployerKeypair;
const owner = loadKeypair(ownerPath);
const program = airspaceProgram(owner);
const acc = accountsOf(program);
const MPL_CORE = new PublicKey(MPL_CORE_PROGRAM_ID);

const parcelPda = pda.parcel(bbl);
const parcel = (await acc.parcel.fetch(parcelPda)) as { owner: PublicKey; coreAsset: PublicKey; status: number };
if (!parcel.owner.equals(owner.publicKey)) fail(`parcel owner is ${parcel.owner.toBase58()}, not ${owner.publicKey.toBase58()}`);
const registry = (await acc.registry.fetch(pda.registry())) as { collection: PublicKey };
const common = { parcel: parcelPda, listing: pda.listing(parcelPda), asset: parcel.coreAsset, collection: registry.collection, escrow: pda.escrow(), mplCoreProgram: MPL_CORE, systemProgram: SystemProgram.programId };

if (parcel.status === 1) {
  const sig = await program.methods.cancelListing().accountsPartial({ seller: owner.publicKey, ...common }).rpc();
  console.log(`cancel_listing ${bbl}: ${explorerTx(sig)}`);
}
const sig = await program.methods
  .listParcel(new BN(Math.round(usd * 100)))
  .accountsPartial({ seller: owner.publicKey, registry: pda.registry(), ...common })
  .rpc();
console.log(`list_parcel ${bbl} at $${usd.toLocaleString()}: ${explorerTx(sig)}`);
