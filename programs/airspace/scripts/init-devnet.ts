/**
 * Devnet bootstrap for the AirSpace program (idempotent).
 *
 *   bun run scripts/init-devnet.ts
 *
 * 1. initialize_registry (skipped if the registry PDA already exists)
 * 2. set_forwarder to the configured forwarder if the registry holds a different one
 * 3. create_collection (skipped if registry.collection is already set)
 *
 * Env overrides: RPC_URL, DEPLOYER_KEYPAIR, FORWARDER_PROGRAM.
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import idl from "../target/idl/airspace.json";
import type { Airspace } from "../target/types/airspace";

const RPC_URL = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const DEPLOYER_KEYPAIR =
  process.env.DEPLOYER_KEYPAIR ?? join(homedir(), ".config/solana/airspace-deployer.json");

const REGISTRAR = new PublicKey("ExgRPqMrP59Zo27oFziZi2dP9RAU7BdRrazDUQreCjG8");
const TREASURY = new PublicKey("8qxj2favgzZBpZrnUdDf17woAyfWhqrLC89bmMcRAjid");
// Chainlink CRE simulator mock forwarder on devnet (demo path). The production DON
// forwarder is CXsKEJcs25TQEYU2e5jZ8QTPE3ffMLZhH6BWHrdcCCB5; switch with set_forwarder.
const FORWARDER_PROGRAM = new PublicKey(
  process.env.FORWARDER_PROGRAM ?? "7kuEAA3mSC1Tz8gQjnvH7bKFda9xSPRRin9SZbH49cNK"
);
const FEE_BPS = 100;
const MAX_PRICE_AGE_SECS = 3600;
const COLLECTION_NAME = "AirSpace NYC Air Rights";
const COLLECTION_URI = "https://airspace-nyc.vercel.app/api/metadata/collection";
const MPL_CORE = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");

const explorer = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;

async function main() {
  const deployer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(DEPLOYER_KEYPAIR, "utf8")))
  );
  const connection = new Connection(RPC_URL, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(deployer), {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);
  const program = new Program(idl as Airspace, provider);

  const [registryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("registry")],
    program.programId
  );
  console.log(`program    ${program.programId.toBase58()}`);
  console.log(`admin      ${deployer.publicKey.toBase58()}`);
  console.log(`registry   ${registryPda.toBase58()}`);
  console.log(`balance    ${(await connection.getBalance(deployer.publicKey)) / 1e9} SOL`);

  let registry = await program.account.registry.fetchNullable(registryPda);
  if (registry) {
    console.log("registry already initialized; skipping initialize_registry");
  } else {
    const sig = await program.methods
      .initializeRegistry(REGISTRAR, TREASURY, FORWARDER_PROGRAM, FEE_BPS, MAX_PRICE_AGE_SECS)
      .accountsPartial({
        admin: deployer.publicKey,
        registry: registryPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`initialize_registry  ${explorer(sig)}`);
    registry = await program.account.registry.fetch(registryPda);
  }

  if (!registry.forwarderProgram.equals(FORWARDER_PROGRAM)) {
    const sig = await program.methods
      .setForwarder(FORWARDER_PROGRAM)
      .accountsPartial({ admin: deployer.publicKey, registry: registryPda })
      .rpc();
    console.log(`set_forwarder -> ${FORWARDER_PROGRAM.toBase58()}  ${explorer(sig)}`);
    registry = await program.account.registry.fetch(registryPda);
  } else {
    console.log(`forwarder  ${registry.forwarderProgram.toBase58()} (unchanged)`);
  }

  if (!registry.collection.equals(PublicKey.default)) {
    console.log(`collection ${registry.collection.toBase58()} (already created)`);
  } else {
    const collection = Keypair.generate();
    const sig = await program.methods
      .createCollection(COLLECTION_NAME, COLLECTION_URI)
      .accountsPartial({
        admin: deployer.publicKey,
        registry: registryPda,
        collection: collection.publicKey,
        mplCoreProgram: MPL_CORE,
        systemProgram: SystemProgram.programId,
      })
      .signers([collection])
      .rpc();
    console.log(`create_collection    ${explorer(sig)}`);
    console.log(`collection ${collection.publicKey.toBase58()}`);
  }

  registry = await program.account.registry.fetch(registryPda);
  console.log("\nregistry state:");
  console.log(`  registrar        ${registry.registrar.toBase58()}`);
  console.log(`  treasury         ${registry.treasury.toBase58()}`);
  console.log(`  forwarderProgram ${registry.forwarderProgram.toBase58()}`);
  console.log(`  collection       ${registry.collection.toBase58()}`);
  console.log(`  feeBps           ${registry.feeBps}`);
  console.log(`  maxPriceAgeSecs  ${registry.maxPriceAgeSecs}`);
  console.log(`  parcelCount      ${registry.parcelCount.toString()}`);
  console.log(`balance    ${(await connection.getBalance(deployer.publicKey)) / 1e9} SOL`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
