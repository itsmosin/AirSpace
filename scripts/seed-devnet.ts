/**
 * Seed devnet with demo parcels: PLUTO → manual Allow verdict → owner attestation (deployer) →
 * mint_parcel → list_parcel at est_value_usd. Skips BBLs whose Parcel already exists.
 *
 *   bun scripts/seed-devnet.ts [--bbls 1008300001,1000160001,...] [--dry-run] [--no-list]
 *
 * Requires: program deployed, initialize_registry + create_collection done, set-attestation-config run.
 */
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { BOROUGH_CODE, MPL_CORE_PROGRAM_ID, type PlutoLot } from '@airspace/shared';
import { issueOwnerAttestation, loadSasConfig } from '@airspace/sas';
import { PATHS, RPC_URL, explorerAddress, explorerTx, fail, fmtUsd, loadKeypair, parseArgs } from './lib/env';
import { accountsOf, airspaceProgram, pda } from './lib/program';
import { computeVerdict, describeVerdict, fetchPlutoRow, recordManualVerdict } from './lib/verdict';

/** Manhattan lots that resolve in PLUTO and carry unused FAR under the §4 formula. */
export const DEFAULT_BBLS = [
  '1008300001', // 816 Avenue of the Americas (Chelsea / NoMad)
  '1000160001', // 22 Battery Place (Pier A; individual landmark → warning flag demo)
  '1008090069', // 144 West 34th Street (Herald Square, C6-6)
  '1005650021', // 842 Broadway (Union Square, C6-4)
  '1007150059', // 442 West 18th Street (West Chelsea, C6-3)
];

const METADATA_BASE = 'https://airspace-nyc.vercel.app/api/metadata';
const MPL_CORE = new PublicKey(MPL_CORE_PROGRAM_ID);

/** "144 WEST 34 STREET" → "144 West 34th Street" */
export function prettyAddress(raw: string): string {
  const small = new Set(['of', 'the', 'and']);
  const ordinal = (n: number) => `${n}${[11, 12, 13].includes(n % 100) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
  return raw
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => {
      if (i > 0 && /^\d+$/.test(w)) return ordinal(Number(w));
      if (i > 0 && small.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

export function buildMintArgs(lot: PlutoLot) {
  const address = prettyAddress(lot.address).slice(0, 96);
  return {
    address,
    borough: BOROUGH_CODE[lot.borough],
    latE6: Math.round(lot.lat * 1e6),
    lngE6: Math.round(lot.lng * 1e6),
    lotAreaSqft: Math.round(lot.lotAreaSqft),
    builtAreaSqft: Math.round(lot.builtAreaSqft),
    maxFarBps: Math.round(lot.maxFar * 10_000),
    zoning: lot.zoning.slice(0, 16),
    name: `Air Rights · ${address}`,
    uri: `${METADATA_BASE}/${lot.bbl}`,
  };
}

const args = parseArgs();
const dryRun = Boolean(args['dry-run']);
const list = !args['no-list'];
const bbls = args.bbls ? String(args.bbls).split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_BBLS;
for (const b of bbls) if (!/^\d{10}$/.test(b)) fail(`bad bbl ${b}`);

console.log(`${dryRun ? 'DRY RUN — ' : ''}seeding ${bbls.length} parcel(s): ${bbls.join(', ')}\n`);

// Phase 1: off-chain math for every lot (always runs, even in dry-run).
const plans = [];
for (const bbl of bbls) {
  const v = computeVerdict(await fetchPlutoRow(bbl), 'allow');
  const mint = buildMintArgs(v.lot);
  console.log(`── ${bbl}  ${mint.name}`);
  console.log(describeVerdict(v));
  console.log(`  mint args ${JSON.stringify({ ...mint, name: undefined, uri: undefined })}`);
  console.log(`  uri       ${mint.uri}`);
  console.log(`  listing   ${fmtUsd(v.lot.estValueUsd)} (${v.lot.estValueUsd * 100} cents)${v.lot.estValueUsd === 0 ? '  ← zero: will mint but cannot list' : ''}`);
  plans.push({ bbl, v, mint });
}
if (dryRun) {
  console.log('\ndry run: nothing sent');
  process.exit(0);
}

// Phase 2: on-chain.
const deployer = loadKeypair(PATHS.deployerKeypair);
const registrar = loadKeypair(PATHS.registrarKeypair);
const cfg = loadSasConfig(PATHS.sasConfig);
const asOwner = airspaceProgram(deployer);
const asRegistrar = airspaceProgram(registrar);
const registryPda = pda.registry();
const registry = (await accountsOf(asOwner).registry.fetchNullable(registryPda)) as
  | { collection: PublicKey; ownerCredential: PublicKey; ownerSchema: PublicKey }
  | null;
if (!registry) fail('registry not initialized');
if (registry.collection.equals(PublicKey.default)) fail('registry.collection is unset; run create_collection first');
if (!registry.ownerCredential.equals(new PublicKey(cfg.credential)) || !registry.ownerSchema.equals(new PublicKey(cfg.ownerSchema))) {
  fail('registry attestation config does not match keys/sas-config.json; run set-attestation-config.ts');
}

for (const { bbl, v, mint } of plans) {
  console.log(`\n── ${bbl}  ${mint.name}`);
  const parcel = pda.parcel(bbl);
  const existing = (await accountsOf(asOwner).parcel.fetchNullable(parcel)) as { coreAsset: PublicKey; status: number } | null;
  if (existing) {
    console.log(`  parcel exists (${existing.status === 1 ? 'listed' : 'minted'}), asset ${existing.coreAsset.toBase58()} — skipping`);
    continue;
  }

  const verdict = await recordManualVerdict(asRegistrar, registrar, v);
  console.log(`  verdict Allow      ${explorerTx(verdict.recordSig)}`);

  const att = await issueOwnerAttestation({ rpcUrl: RPC_URL, registrar }, cfg, { wallet: deployer.publicKey, bbl });
  console.log(`  owner attestation  ${att.attestation.toBase58()}${att.alreadyExisted ? ' (existing)' : ' ' + explorerTx(att.txSignature)}`);

  const asset = Keypair.generate();
  const mintSig = await asOwner.methods
    .mintParcel(mint)
    .accountsPartial({
      owner: deployer.publicKey,
      registry: registryPda,
      verdict: verdict.verdict,
      ownerAttestation: att.attestation,
      parcel,
      asset: asset.publicKey,
      collection: registry.collection,
      mplCoreProgram: MPL_CORE,
      systemProgram: SystemProgram.programId,
    })
    .signers([asset])
    .rpc();
  console.log(`  mint_parcel        ${explorerTx(mintSig)}`);
  console.log(`  asset              ${explorerAddress(asset.publicKey)}`);

  if (!list) continue;
  if (v.lot.estValueUsd === 0) {
    console.log('  list_parcel        skipped (est_value_usd is 0)');
    continue;
  }
  const listSig = await asOwner.methods
    .listParcel(new BN(v.lot.estValueUsd).muln(100))
    .accountsPartial({
      seller: deployer.publicKey,
      registry: registryPda,
      parcel,
      listing: pda.listing(parcel),
      asset: asset.publicKey,
      collection: registry.collection,
      escrow: pda.escrow(),
      mplCoreProgram: MPL_CORE,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log(`  list_parcel        ${fmtUsd(v.lot.estValueUsd)}  ${explorerTx(listSig)}`);
}
console.log('\ndone');
