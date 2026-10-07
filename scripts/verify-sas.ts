/**
 * Round-trip test: issue a KYC attestation and an owner attestation for a wallet, read them
 * back and assert the bytes, nonces and PDAs. Idempotent (re-running reports alreadyExisted).
 *
 *   bun scripts/verify-sas.ts [--wallet <pubkey>] [--bbl 1008350041]
 */
import { strict as assert } from 'node:assert';
import { Keypair, PublicKey } from '@solana/web3.js';
import { AIRSPACE_PROGRAM_ID } from '@airspace/shared';
import {
  deriveAttestationPda,
  fetchAttestation,
  issueKycAttestation,
  issueOwnerAttestation,
  loadSasConfig,
  ownerNoncePda,
} from '@airspace/sas';
import { PATHS, RPC_URL, connection, explorerAddress, explorerTx, loadKeypair, parseArgs } from './lib/env';

const args = parseArgs();
const registrar = loadKeypair(PATHS.registrarKeypair);
const cfg = loadSasConfig(PATHS.sasConfig);
const ctx = { rpcUrl: RPC_URL, registrar };
const wallet = args.wallet ? new PublicKey(String(args.wallet)) : loadKeypair(PATHS.deployerKeypair).publicKey;
const bbl = String(args.bbl ?? '1008350041');
const now = Math.floor(Date.now() / 1000);
const conn = connection();

console.log(`wallet ${wallet.toBase58()}  bbl ${bbl}`);
console.log(`registrar balance before ${(await conn.getBalance(registrar.publicKey)) / 1e9} SOL`);

// --- KYC -------------------------------------------------------------------
const kyc = await issueKycAttestation(ctx, cfg, { wallet });
console.log(`\nkyc attestation ${kyc.attestation.toBase58()} ${kyc.alreadyExisted ? '(already existed)' : explorerTx(kyc.txSignature)}`);
const kycOnChain = await fetchAttestation(RPC_URL, kyc.attestation);
assert.ok(kycOnChain, 'kyc attestation not found');
assert.deepEqual(Array.from(kycOnChain.data), [1], 'kyc data must be [1]');
assert.ok(kycOnChain.nonce.equals(wallet), 'kyc nonce must be the wallet');
assert.ok(kycOnChain.credential.equals(new PublicKey(cfg.credential)), 'kyc credential');
assert.ok(kycOnChain.schema.equals(new PublicKey(cfg.kycSchema)), 'kyc schema');
assert.ok(kycOnChain.signer.equals(registrar.publicKey), 'kyc signer must be the registrar');
assert.ok(kycOnChain.expiry > BigInt(now), 'kyc expiry must be in the future');
assert.ok(
  deriveAttestationPda(new PublicKey(cfg.credential), new PublicKey(cfg.kycSchema), wallet).equals(kyc.attestation),
  'deriveAttestationPda(kyc) mismatch',
);
console.log(`  data=[${Array.from(kycOnChain.data)}] nonce=wallet signer=registrar expiry=${new Date(Number(kycOnChain.expiry) * 1000).toISOString()}  OK`);

// --- Owner -----------------------------------------------------------------
const owner = await issueOwnerAttestation(ctx, cfg, { wallet, bbl });
console.log(`\nowner attestation ${owner.attestation.toBase58()} ${owner.alreadyExisted ? '(already existed)' : explorerTx(owner.txSignature)}`);
const ownerOnChain = await fetchAttestation(RPC_URL, owner.attestation);
assert.ok(ownerOnChain, 'owner attestation not found');
const expectedData = Buffer.concat([Buffer.from([bbl.length, 0, 0, 0]), Buffer.from(bbl, 'utf8')]); // u32 LE len + utf8
assert.deepEqual(Array.from(ownerOnChain.data), Array.from(expectedData), 'owner data must be Borsh String(bbl)');
const nonce = ownerNoncePda(new PublicKey(AIRSPACE_PROGRAM_ID), wallet, bbl);
assert.ok(ownerOnChain.nonce.equals(nonce), 'owner nonce must be ownerNoncePda');
assert.ok(ownerOnChain.credential.equals(new PublicKey(cfg.credential)), 'owner credential');
assert.ok(ownerOnChain.schema.equals(new PublicKey(cfg.ownerSchema)), 'owner schema');
assert.ok(ownerOnChain.signer.equals(registrar.publicKey), 'owner signer must be the registrar');
assert.ok(ownerOnChain.expiry > BigInt(now), 'owner expiry must be in the future');
assert.ok(
  deriveAttestationPda(new PublicKey(cfg.credential), new PublicKey(cfg.ownerSchema), nonce).equals(owner.attestation),
  'deriveAttestationPda(owner) mismatch',
);
console.log(`  data=[${Array.from(ownerOnChain.data)}] = u32le(${bbl.length}) + "${bbl}"  nonce=${nonce.toBase58()}  OK`);

// --- Negative: a missing account reads as null ------------------------------
assert.equal(await fetchAttestation(RPC_URL, Keypair.generate().publicKey), null, 'missing attestation must be null');

console.log('\nall assertions passed');
console.log(`  kyc    ${explorerAddress(kyc.attestation)}`);
console.log(`  owner  ${explorerAddress(owner.attestation)}`);
console.log(`registrar balance after ${(await conn.getBalance(registrar.publicKey)) / 1e9} SOL`);
