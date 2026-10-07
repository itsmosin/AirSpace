/**
 * Create the AirSpace SAS credential + schemas on devnet (idempotent) and write keys/sas-config.json.
 *
 *   bun scripts/setup-sas.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { PublicKey } from '@solana/web3.js';
import {
  CREDENTIAL_NAME,
  KYC_SCHEMA,
  OWNER_SCHEMA,
  deriveCredentialPda,
  deriveSchemaPda,
  setupRegistrarSas,
} from '@airspace/sas';
import { PATHS, RPC_URL, connection, explorerAddress, explorerTx, fail, loadKeypair } from './lib/env';
import { fetchCredential, fetchSchema } from './lib/sas-inspect';

const registrar = loadKeypair(PATHS.registrarKeypair);
const conn = connection();

console.log(`rpc        ${RPC_URL}`);
console.log(`registrar  ${registrar.publicKey.toBase58()}  (${(await conn.getBalance(registrar.publicKey)) / 1e9} SOL)`);

const expected = {
  credential: deriveCredentialPda(registrar.publicKey, CREDENTIAL_NAME),
};
console.log(`\ncredential "${CREDENTIAL_NAME}" → ${expected.credential.toBase58()}`);
console.log(`schema ${OWNER_SCHEMA.name} v${OWNER_SCHEMA.version} → ${deriveSchemaPda(expected.credential, OWNER_SCHEMA.name, OWNER_SCHEMA.version).toBase58()}`);
console.log(`schema ${KYC_SCHEMA.name} v${KYC_SCHEMA.version} → ${deriveSchemaPda(expected.credential, KYC_SCHEMA.name, KYC_SCHEMA.version).toBase58()}`);

const result = await setupRegistrarSas({ rpcUrl: RPC_URL, registrar });
console.log(result.txs.length ? `\nsent ${result.txs.length} transaction(s):` : '\nnothing to create (all accounts already exist)');
for (const sig of result.txs) console.log(`  ${explorerTx(sig)}`);

// Verify by reading the accounts back.
console.log('\nverifying on-chain accounts');
const cred = await fetchCredential(conn, new PublicKey(result.credential));
if (!cred.authority.equals(registrar.publicKey)) fail('credential authority is not the registrar');
if (!cred.authorizedSigners.some((s) => s.equals(registrar.publicKey))) fail('registrar is not an authorized signer');
if (cred.name !== CREDENTIAL_NAME) fail(`credential name mismatch: ${cred.name}`);
console.log(`  credential  name="${cred.name}" authority=${cred.authority.toBase58()} signers=[${cred.authorizedSigners.map((s) => s.toBase58()).join(', ')}]`);

for (const [key, def] of [['ownerSchema', OWNER_SCHEMA], ['kycSchema', KYC_SCHEMA]] as const) {
  const s = await fetchSchema(conn, new PublicKey(result[key]));
  const sameLayout = s.layout.length === def.layout.length && s.layout.every((b, i) => b === def.layout[i]);
  const sameNames = s.fieldNames.join(',') === def.fieldNames.join(',');
  if (!s.credential.equals(new PublicKey(result.credential))) fail(`${def.name}: wrong credential`);
  if (!sameLayout || !sameNames || s.version !== def.version || s.isPaused) {
    fail(`${def.name}: on-chain schema differs from the package definition: ${JSON.stringify(s)}`);
  }
  console.log(`  ${key.padEnd(11)} name=${s.name} v${s.version} layout=[${s.layout.join(',')}] fields=[${s.fieldNames.join(',')}] paused=${s.isPaused}`);
}

const config = {
  credential: result.credential,
  ownerSchema: result.ownerSchema,
  kycSchema: result.kycSchema,
  registrar: registrar.publicKey.toBase58(),
  credentialName: CREDENTIAL_NAME,
  cluster: 'devnet',
};
mkdirSync(dirname(PATHS.sasConfig), { recursive: true });
writeFileSync(PATHS.sasConfig, JSON.stringify(config, null, 2) + '\n');
console.log(`\nwrote ${PATHS.sasConfig}`);

console.log('\nexplorer');
console.log(`  credential    ${explorerAddress(result.credential)}`);
console.log(`  owner schema  ${explorerAddress(result.ownerSchema)}`);
console.log(`  kyc schema    ${explorerAddress(result.kycSchema)}`);
console.log(`\nregistrar balance now ${(await conn.getBalance(registrar.publicKey)) / 1e9} SOL`);
