/** Devnet purchase test: fund a fresh buyer, issue a KYC attestation, buy a listed parcel. Usage: bun run buy-test.ts --bbl 1008300001 */
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { MPL_CORE_PROGRAM_ID, PYTH_SOL_USD_PRICE_ACCOUNT } from '@airspace/shared';
import { deriveAttestationPda, issueKycAttestation, loadSasConfig } from '@airspace/sas';
import { PATHS, RPC_URL, connection, explorerAddress, explorerTx, fail, loadKeypair, parseArgs } from './lib/env';
import { accountsOf, airspaceProgram, anchorErrorName, pda } from './lib/program';

const args = parseArgs();
const bbl = typeof args.bbl === 'string' ? args.bbl : fail('--bbl required');
const deployer = loadKeypair(PATHS.deployerKeypair);
const registrar = loadKeypair(PATHS.registrarKeypair);
const sas = loadSasConfig(PATHS.sasConfig);
const conn = connection();
const buyer = Keypair.generate();
console.log(`buyer ${buyer.publicKey.toBase58()}`);

// 1. fund buyer
const fund = await sendAndConfirmTransaction(conn, new Transaction().add(
  SystemProgram.transfer({ fromPubkey: deployer.publicKey, toPubkey: buyer.publicKey, lamports: 0.35 * LAMPORTS_PER_SOL })), [deployer]);
console.log(`funded 0.35 SOL      ${explorerTx(fund)}`);

const program = airspaceProgram(buyer);
const acc = accountsOf(program);
const parcelPda = pda.parcel(bbl);
const parcel = (await acc.parcel.fetch(parcelPda)) as { owner: PublicKey; coreAsset: PublicKey; status: number };
const listing = (await acc.listing.fetch(pda.listing(parcelPda))) as { seller: PublicKey; priceUsdCents: { toString(): string } };
const registry = (await acc.registry.fetch(pda.registry())) as { collection: PublicKey; treasury: PublicKey; kycCredential: PublicKey; kycSchema: PublicKey };
console.log(`listing price $${Number(listing.priceUsdCents.toString()) / 100} seller ${listing.seller.toBase58()}`);

const MPL_CORE = new PublicKey(MPL_CORE_PROGRAM_ID);
const common = {
  buyer: buyer.publicKey, registry: pda.registry(), parcel: parcelPda, listing: pda.listing(parcelPda), seller: listing.seller,
  treasury: registry.treasury, priceUpdate: new PublicKey(PYTH_SOL_USD_PRICE_ACCOUNT), asset: parcel.coreAsset,
  collection: registry.collection, escrow: pda.escrow(), mplCoreProgram: MPL_CORE, systemProgram: SystemProgram.programId,
};

// 2. negative: buy without KYC must fail
const kycPda = deriveAttestationPda(registry.kycCredential, registry.kycSchema, buyer.publicKey);
try {
  await program.methods.buyParcel().accountsPartial({ ...common, buyerAttestation: kycPda }).rpc();
  fail('buy without KYC unexpectedly succeeded');
} catch (e) {
  console.log(`buy without KYC rejected: ${anchorErrorName(e) ?? (e as Error).message.slice(0, 80)}`);
}

// 3. KYC attestation from the registrar
const kyc = await issueKycAttestation({ rpcUrl: RPC_URL, registrar }, sas, { wallet: buyer.publicKey, level: 1 });
console.log(`kyc attestation      ${kyc.attestation.toBase58()} ${explorerTx(kyc.txSignature)}`);

// 4. buy
const before = await conn.getBalance(listing.seller);
const sig = await program.methods.buyParcel().accountsPartial({ ...common, buyerAttestation: kyc.attestation }).rpc();
const after = await conn.getBalance(listing.seller);
console.log(`buy_parcel           ${explorerTx(sig)}`);
console.log(`seller received      ${((after - before) / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
const p2 = (await acc.parcel.fetch(parcelPda)) as { owner: PublicKey; status: number };
console.log(`new owner            ${p2.owner.toBase58()} (buyer? ${p2.owner.equals(buyer.publicKey)}) status=${p2.status}`);
console.log(`asset                ${explorerAddress(parcel.coreAsset)}`);
