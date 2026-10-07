/**
 * Store the SAS credential/schema pubkeys in the Registry (`set_attestation_config`, admin = deployer).
 *
 *   bun scripts/set-attestation-config.ts
 */
import { PublicKey } from '@solana/web3.js';
import { loadSasConfig } from '@airspace/sas';
import { PATHS, explorerAddress, explorerTx, fail, loadKeypair } from './lib/env';
import { accountsOf, airspaceProgram, pda } from './lib/program';

const deployer = loadKeypair(PATHS.deployerKeypair);
const cfg = loadSasConfig(PATHS.sasConfig);
const program = airspaceProgram(deployer);
const registry = pda.registry();

const before = (await accountsOf(program).registry.fetchNullable(registry)) as { admin: PublicKey } | null;
if (!before) fail(`registry ${registry.toBase58()} not initialized; run initialize_registry first`);
if (!before.admin.equals(deployer.publicKey)) fail(`registry admin is ${before.admin.toBase58()}, not the deployer`);

const credential = new PublicKey(cfg.credential);
const ownerSchema = new PublicKey(cfg.ownerSchema);
const kycSchema = new PublicKey(cfg.kycSchema);
console.log(`registry        ${registry.toBase58()}`);
console.log(`owner_credential ${credential.toBase58()}`);
console.log(`owner_schema     ${ownerSchema.toBase58()}`);
console.log(`kyc_credential   ${credential.toBase58()}`);
console.log(`kyc_schema       ${kycSchema.toBase58()}`);

const sig = await program.methods
  .setAttestationConfig(credential, ownerSchema, credential, kycSchema)
  .accountsPartial({ admin: deployer.publicKey, registry })
  .rpc();
console.log(`\ntx ${explorerTx(sig)}`);

const after = (await accountsOf(program).registry.fetch(registry)) as {
  ownerCredential: PublicKey; ownerSchema: PublicKey; kycCredential: PublicKey; kycSchema: PublicKey;
};
const ok =
  after.ownerCredential.equals(credential) && after.ownerSchema.equals(ownerSchema) &&
  after.kycCredential.equals(credential) && after.kycSchema.equals(kycSchema);
if (!ok) fail('registry attestation config does not match after the update');
console.log(`registry updated: ${explorerAddress(registry)}`);
