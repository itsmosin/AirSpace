import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import {
  ComputeBudgetProgram,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  getCreateAttestationInstruction,
  getCreateCredentialInstruction,
  getCreateSchemaInstruction,
  SchemaDataType,
} from "@solana/attestation";
import {
  address,
  createNoopSigner,
  isSignerRole,
  isWritableRole,
  type Instruction,
} from "@solana/kit";
import { createHash } from "crypto";
import { expect } from "chai";
import { Airspace } from "../target/types/airspace";

// ---------------------------------------------------------------------------
// Fixed identifiers (docs/INTERFACES.md section 0)
// ---------------------------------------------------------------------------
const MPL_CORE = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");
const SAS = new PublicKey("22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG");
const PYTH_RECEIVER = new PublicKey("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ");
const PYTH_SOL_USD = new PublicKey("7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE");
const FORWARDER_PROGRAM = new PublicKey("CXsKEJcs25TQEYU2e5jZ8QTPE3ffMLZhH6BWHrdcCCB5");
const FORWARDER_STATE = new PublicKey("8QoomCQyPSkJ8WopJbX9B4HyvrFzziwvJdU8hZE6DCr9");

const BBL = "1008350041";
const BBL_2 = "3000010001";
const FEE_BPS = 100;
const MAX_PRICE_AGE = 10_000_000; // cloned price is stale relative to a fresh validator
const PRICE_USD_CENTS = 10_000n; // $100.00
const CREDENTIAL_NAME = "AirSpace Registrar";
const OWNER_SCHEMA = "airspace_owner_v1";
const KYC_SCHEMA = "airspace_kyc_v1";

const MINT_ARGS = {
  address: "350 Fifth Ave, New York, NY 10118",
  borough: 1,
  latE6: 40_748_400,
  lngE6: -73_985_700,
  lotAreaSqft: 91_351,
  builtAreaSqft: 2_158_000,
  maxFarBps: 150_000,
  zoning: "C5-3",
  name: "Air Rights - 350 Fifth Ave",
  uri: `https://airspace-nyc.vercel.app/api/metadata/${BBL}`,
};
const VERDICT = {
  confidenceBps: 9_100,
  flags: 1 | 32,
  unusedSqft: new BN(200_000),
  estValueUsd: new BN(70_000_000),
  reportHash: Array.from(createHash("sha256").update("airspace-report").digest()),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const utf8 = (s: string) => Buffer.from(s, "utf8");

function pda(seeds: (Buffer | Uint8Array)[], programId: PublicKey) {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

function toWeb3(ix: Instruction): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(ix.programAddress),
    keys: (ix.accounts ?? []).map((a) => ({
      pubkey: new PublicKey(a.address),
      isSigner: isSignerRole(a.role),
      isWritable: isWritableRole(a.role),
    })),
    data: Buffer.from(ix.data ?? new Uint8Array()),
  });
}

function borshString(s: string): Uint8Array {
  const bytes = utf8(s);
  const out = Buffer.alloc(4 + bytes.length);
  out.writeUInt32LE(bytes.length, 0);
  bytes.copy(out, 4);
  return new Uint8Array(out);
}

/** VerdictReport Borsh encoding (docs/INTERFACES.md section 3). */
function encodeVerdictReport(r: {
  bbl: string;
  status: number;
  confidenceBps: number;
  flags: number;
  unusedSqft: bigint;
  estValueUsd: bigint;
  reportHash: Uint8Array;
}): Buffer {
  const bbl = utf8(r.bbl);
  const buf = Buffer.alloc(4 + bbl.length + 1 + 2 + 4 + 8 + 8 + 32);
  let o = 0;
  buf.writeUInt32LE(bbl.length, o); o += 4;
  bbl.copy(buf, o); o += bbl.length;
  buf.writeUInt8(r.status, o); o += 1;
  buf.writeUInt16LE(r.confidenceBps, o); o += 2;
  buf.writeUInt32LE(r.flags, o); o += 4;
  buf.writeBigUInt64LE(r.unusedSqft, o); o += 8;
  buf.writeBigUInt64LE(r.estValueUsd, o); o += 8;
  Buffer.from(r.reportHash).copy(buf, o);
  return buf;
}

/** PriceUpdateV2 parsing mirroring programs/airspace/src/pyth.rs. */
function parsePriceUpdate(data: Buffer) {
  const tag = data[40];
  const off = tag === 0 ? 42 : 41;
  return {
    feedId: data.subarray(off, off + 32).toString("hex"),
    price: data.readBigInt64LE(off + 32),
    exponent: data.readInt32LE(off + 48),
    publishTime: data.readBigInt64LE(off + 52),
  };
}

function usdCentsToLamports(cents: bigint, price: bigint, exponent: number): bigint {
  const scale = 10n ** BigInt(Math.abs(exponent));
  return exponent <= 0
    ? (cents * 1_000_000_000n * scale) / (100n * price)
    : (cents * 1_000_000_000n) / (100n * price * scale);
}

async function expectError(p: Promise<unknown>, code: string) {
  try {
    await p;
  } catch (e: any) {
    const name = e?.error?.errorCode?.code;
    const logs: string[] = e?.logs ?? e?.error?.logs ?? [];
    if (name === code || logs.some((l) => l.includes(`Error Code: ${code}`))) return;
    throw new Error(`expected ${code}, got ${name ?? e?.message ?? e}\n${logs.join("\n")}`);
  }
  throw new Error(`expected ${code} but the transaction succeeded`);
}

// ---------------------------------------------------------------------------
describe("airspace", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Airspace as Program<Airspace>;
  const connection = provider.connection;
  const admin = provider.wallet.publicKey;

  const registrar = Keypair.generate();
  const seller = Keypair.generate();
  const buyer = Keypair.generate();
  const treasury = Keypair.generate();
  const collection = Keypair.generate();
  const asset = Keypair.generate();

  // Program PDAs
  const registryPda = pda([utf8("registry")], program.programId);
  const escrowPda = pda([utf8("escrow")], program.programId);
  const verdictPda = pda([utf8("verdict"), utf8(BBL)], program.programId);
  const parcelPda = pda([utf8("parcel"), utf8(BBL)], program.programId);
  const listingPda = pda([utf8("listing"), parcelPda.toBuffer()], program.programId);
  const ownerNonce = (wallet: PublicKey, bbl: string) =>
    pda([utf8("owner-nonce"), wallet.toBuffer(), utf8(bbl)], program.programId);

  // SAS PDAs
  const credentialPda = pda([utf8("credential"), registrar.publicKey.toBuffer(), utf8(CREDENTIAL_NAME)], SAS);
  const ownerSchemaPda = pda([utf8("schema"), credentialPda.toBuffer(), utf8(OWNER_SCHEMA), Buffer.from([1])], SAS);
  const kycSchemaPda = pda([utf8("schema"), credentialPda.toBuffer(), utf8(KYC_SCHEMA), Buffer.from([1])], SAS);
  const attestationPda = (schema: PublicKey, nonce: PublicKey) =>
    pda([utf8("attestation"), credentialPda.toBuffer(), schema.toBuffer(), nonce.toBuffer()], SAS);
  const sellerOwnerAttestation = attestationPda(ownerSchemaPda, ownerNonce(seller.publicKey, BBL));
  const buyerOwnerAttestation = attestationPda(ownerSchemaPda, ownerNonce(buyer.publicKey, BBL));
  const buyerKycAttestation = attestationPda(kycSchemaPda, buyer.publicKey);

  const registrarSigner = createNoopSigner(address(registrar.publicKey.toBase58()));
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60);

  async function send(ixs: TransactionInstruction[], signers: Keypair[]) {
    const tx = new Transaction().add(...ixs);
    return provider.sendAndConfirm(tx, signers);
  }

  async function airdrop(to: PublicKey, sol: number) {
    const sig = await connection.requestAirdrop(to, sol * LAMPORTS_PER_SOL);
    const bh = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: sig, ...bh });
  }

  async function coreAssetOwner(key: PublicKey): Promise<PublicKey> {
    const info = await connection.getAccountInfo(key);
    expect(info, "core asset account").to.not.be.null;
    expect(info!.owner.toBase58()).to.eq(MPL_CORE.toBase58());
    return new PublicKey(info!.data.subarray(1, 33));
  }

  async function issueAttestation(schema: PublicKey, nonce: PublicKey, data: Uint8Array) {
    const ix = getCreateAttestationInstruction({
      payer: registrarSigner,
      authority: registrarSigner,
      credential: address(credentialPda.toBase58()),
      schema: address(schema.toBase58()),
      attestation: address(attestationPda(schema, nonce).toBase58()),
      nonce: address(nonce.toBase58()),
      data,
      expiry,
    });
    await send([toWeb3(ix)], [registrar]);
  }

  const mintParcelTx = (owner: Keypair, ownerAttestation: PublicKey, assetKp: Keypair) =>
    program.methods
      .mintParcel(MINT_ARGS)
      .accountsPartial({
        owner: owner.publicKey,
        registry: registryPda,
        verdict: verdictPda,
        ownerAttestation,
        parcel: parcelPda,
        asset: assetKp.publicKey,
        collection: collection.publicKey,
        mplCoreProgram: MPL_CORE,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 })])
      .signers([owner, assetKp])
      .rpc();

  const listParcelTx = (price: bigint) =>
    program.methods
      .listParcel(new BN(price.toString()))
      .accountsPartial({
        seller: seller.publicKey,
        registry: registryPda,
        parcel: parcelPda,
        listing: listingPda,
        asset: asset.publicKey,
        collection: collection.publicKey,
        escrow: escrowPda,
        mplCoreProgram: MPL_CORE,
        systemProgram: SystemProgram.programId,
      })
      .signers([seller])
      .rpc();

  const buyParcelTx = (who: Keypair, attestation: PublicKey) =>
    program.methods
      .buyParcel()
      .accountsPartial({
        buyer: who.publicKey,
        registry: registryPda,
        parcel: parcelPda,
        listing: listingPda,
        seller: seller.publicKey,
        treasury: treasury.publicKey,
        buyerAttestation: attestation,
        priceUpdate: PYTH_SOL_USD,
        asset: asset.publicKey,
        collection: collection.publicKey,
        escrow: escrowPda,
        mplCoreProgram: MPL_CORE,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 })])
      .signers([who])
      .rpc();

  before(async () => {
    await Promise.all([
      airdrop(registrar.publicKey, 5),
      airdrop(seller.publicKey, 5),
      airdrop(buyer.publicKey, 10),
      airdrop(treasury.publicKey, 1),
    ]);
    for (const [label, key] of [
      ["Metaplex Core", MPL_CORE],
      ["SAS", SAS],
      ["Pyth receiver", PYTH_RECEIVER],
      ["Pyth SOL/USD", PYTH_SOL_USD],
    ] as const) {
      const info = await connection.getAccountInfo(key);
      expect(info, `${label} must be cloned from devnet`).to.not.be.null;
    }
  });

  // ---- registry -----------------------------------------------------------
  it("initializes the registry", async () => {
    await program.methods
      .initializeRegistry(registrar.publicKey, treasury.publicKey, FORWARDER_PROGRAM, FEE_BPS, MAX_PRICE_AGE)
      .accountsPartial({ admin, registry: registryPda, systemProgram: SystemProgram.programId })
      .rpc();
    const registry = await program.account.registry.fetch(registryPda);
    expect(registry.admin.toBase58()).to.eq(admin.toBase58());
    expect(registry.registrar.toBase58()).to.eq(registrar.publicKey.toBase58());
    expect(registry.treasury.toBase58()).to.eq(treasury.publicKey.toBase58());
    expect(registry.forwarderProgram.toBase58()).to.eq(FORWARDER_PROGRAM.toBase58());
    expect(registry.feeBps).to.eq(FEE_BPS);
    expect(registry.maxPriceAgeSecs).to.eq(MAX_PRICE_AGE);
    expect(registry.parcelCount.toNumber()).to.eq(0);
    expect(registry.collection.equals(PublicKey.default)).to.be.true;
  });

  it("rejects set_attestation_config from a non-admin", async () => {
    await expectError(
      program.methods
        .setAttestationConfig(credentialPda, ownerSchemaPda, credentialPda, kycSchemaPda)
        .accountsPartial({ admin: seller.publicKey, registry: registryPda })
        .signers([seller])
        .rpc(),
      "Unauthorized"
    );
  });

  it("set_forwarder is admin-only and updates the registry", async () => {
    const MOCK_FORWARDER = new PublicKey("7kuEAA3mSC1Tz8gQjnvH7bKFda9xSPRRin9SZbH49cNK");
    await expectError(
      program.methods
        .setForwarder(MOCK_FORWARDER)
        .accountsPartial({ admin: seller.publicKey, registry: registryPda })
        .signers([seller])
        .rpc(),
      "Unauthorized"
    );
    await program.methods.setForwarder(MOCK_FORWARDER).accountsPartial({ admin, registry: registryPda }).rpc();
    expect((await program.account.registry.fetch(registryPda)).forwarderProgram.toBase58()).to.eq(MOCK_FORWARDER.toBase58());
    await program.methods.setForwarder(FORWARDER_PROGRAM).accountsPartial({ admin, registry: registryPda }).rpc();
    expect((await program.account.registry.fetch(registryPda)).forwarderProgram.toBase58()).to.eq(FORWARDER_PROGRAM.toBase58());
  });

  it("creates the SAS credential and schemas, then stores the attestation config", async () => {
    const credentialIx = getCreateCredentialInstruction({
      payer: registrarSigner,
      authority: registrarSigner,
      credential: address(credentialPda.toBase58()),
      name: CREDENTIAL_NAME,
      signers: [address(registrar.publicKey.toBase58())],
    });
    const ownerSchemaIx = getCreateSchemaInstruction({
      payer: registrarSigner,
      authority: registrarSigner,
      credential: address(credentialPda.toBase58()),
      schema: address(ownerSchemaPda.toBase58()),
      name: OWNER_SCHEMA,
      description: "AirSpace verified owner of a NYC BBL",
      layout: new Uint8Array([SchemaDataType.String]),
      fieldNames: ["bbl"],
    });
    const kycSchemaIx = getCreateSchemaInstruction({
      payer: registrarSigner,
      authority: registrarSigner,
      credential: address(credentialPda.toBase58()),
      schema: address(kycSchemaPda.toBase58()),
      name: KYC_SCHEMA,
      description: "AirSpace KYC level",
      layout: new Uint8Array([SchemaDataType.U8]),
      fieldNames: ["level"],
    });
    await send([toWeb3(credentialIx), toWeb3(ownerSchemaIx), toWeb3(kycSchemaIx)], [registrar]);

    for (const key of [credentialPda, ownerSchemaPda, kycSchemaPda]) {
      const info = await connection.getAccountInfo(key);
      expect(info?.owner.toBase58()).to.eq(SAS.toBase58());
    }

    await program.methods
      .setAttestationConfig(credentialPda, ownerSchemaPda, credentialPda, kycSchemaPda)
      .accountsPartial({ admin, registry: registryPda })
      .rpc();
    const registry = await program.account.registry.fetch(registryPda);
    expect(registry.ownerCredential.toBase58()).to.eq(credentialPda.toBase58());
    expect(registry.ownerSchema.toBase58()).to.eq(ownerSchemaPda.toBase58());
    expect(registry.kycCredential.toBase58()).to.eq(credentialPda.toBase58());
    expect(registry.kycSchema.toBase58()).to.eq(kycSchemaPda.toBase58());
  });

  it("creates the Core collection with the registry PDA as update authority", async () => {
    await program.methods
      .createCollection("AirSpace NYC Air Rights", "https://airspace-nyc.vercel.app/api/metadata/collection")
      .accountsPartial({
        admin,
        registry: registryPda,
        collection: collection.publicKey,
        mplCoreProgram: MPL_CORE,
        systemProgram: SystemProgram.programId,
      })
      .signers([collection])
      .rpc();
    const registry = await program.account.registry.fetch(registryPda);
    expect(registry.collection.toBase58()).to.eq(collection.publicKey.toBase58());
    const info = await connection.getAccountInfo(collection.publicKey);
    expect(info?.owner.toBase58()).to.eq(MPL_CORE.toBase58());
    // CollectionV1: key(1) + update_authority(32) + ...
    expect(new PublicKey(info!.data.subarray(1, 33)).toBase58()).to.eq(registryPda.toBase58());
  });

  // ---- verdicts -----------------------------------------------------------
  it("opens a verdict (registrar pays)", async () => {
    await program.methods
      .openVerdict(BBL)
      .accountsPartial({ payer: registrar.publicKey, verdict: verdictPda, parcel: parcelPda, systemProgram: SystemProgram.programId })
      .signers([registrar])
      .rpc();
    const verdict = await program.account.verdict.fetch(verdictPda);
    expect(verdict.bbl).to.eq(BBL);
    expect(verdict.status).to.eq(0);
    expect(verdict.requester.toBase58()).to.eq(registrar.publicKey.toBase58());
    expect(verdict.requestedAt.toNumber()).to.be.greaterThan(0);
  });

  it("rejects a malformed bbl", async () => {
    await expectError(
      program.methods
        .openVerdict("12345")
        .accountsPartial({ payer: registrar.publicKey })
        .signers([registrar])
        .rpc(),
      "InvalidArgs"
    );
  });

  it("issues SAS owner attestations (seller for the BBL, plus a decoy for the buyer)", async () => {
    await issueAttestation(ownerSchemaPda, ownerNonce(seller.publicKey, BBL), borshString(BBL));
    await issueAttestation(ownerSchemaPda, ownerNonce(buyer.publicKey, BBL), borshString(BBL));
    const info = await connection.getAccountInfo(sellerOwnerAttestation);
    expect(info?.owner.toBase58()).to.eq(SAS.toBase58());
    expect(info!.data[0]).to.eq(2); // Attestation discriminator
  });

  it("refuses to mint while the verdict is Pending", async () => {
    await expectError(mintParcelTx(seller, sellerOwnerAttestation, asset), "VerdictNotAllowed");
  });

  it("rejects record_verdict_manual from a non-registrar", async () => {
    await expectError(
      program.methods
        .recordVerdictManual(1, VERDICT.confidenceBps, VERDICT.flags, VERDICT.unusedSqft, VERDICT.estValueUsd, VERDICT.reportHash)
        .accountsPartial({ registrar: seller.publicKey, registry: registryPda, verdict: verdictPda })
        .signers([seller])
        .rpc(),
      "Unauthorized"
    );
  });

  it("records a Deny verdict and refuses to mint", async () => {
    await program.methods
      .recordVerdictManual(2, 9_500, 8, new BN(0), new BN(0), VERDICT.reportHash)
      .accountsPartial({ registrar: registrar.publicKey, registry: registryPda, verdict: verdictPda })
      .signers([registrar])
      .rpc();
    const verdict = await program.account.verdict.fetch(verdictPda);
    expect(verdict.status).to.eq(2);
    expect(verdict.source).to.eq(0);
    await expectError(mintParcelTx(seller, sellerOwnerAttestation, asset), "VerdictNotAllowed");
  });

  it("records an Allow verdict (manual, source = registrar)", async () => {
    await program.methods
      .recordVerdictManual(1, VERDICT.confidenceBps, VERDICT.flags, VERDICT.unusedSqft, VERDICT.estValueUsd, VERDICT.reportHash)
      .accountsPartial({ registrar: registrar.publicKey, registry: registryPda, verdict: verdictPda })
      .signers([registrar])
      .rpc();
    const verdict = await program.account.verdict.fetch(verdictPda);
    expect(verdict.status).to.eq(1);
    expect(verdict.confidenceBps).to.eq(VERDICT.confidenceBps);
    expect(verdict.flags).to.eq(VERDICT.flags);
    expect(verdict.unusedSqft.toString()).to.eq(VERDICT.unusedSqft.toString());
    expect(verdict.estValueUsd.toString()).to.eq(VERDICT.estValueUsd.toString());
    expect(verdict.reportHash).to.deep.eq(VERDICT.reportHash);
    expect(verdict.recordedAt.toNumber()).to.be.greaterThan(0);
  });

  // ---- mint ---------------------------------------------------------------
  it("refuses to mint without a valid owner attestation", async () => {
    // Non-existent account (not owned by SAS)
    await expectError(mintParcelTx(seller, Keypair.generate().publicKey, asset), "InvalidAttestation");
    // Real SAS attestation, but for a different wallet (nonce mismatch)
    await expectError(mintParcelTx(seller, buyerOwnerAttestation, asset), "InvalidAttestation");
    // Attestation of the right wallet presented by the wrong signer
    await expectError(mintParcelTx(buyer, sellerOwnerAttestation, asset), "InvalidAttestation");
  });

  it("mints the parcel as a Core asset in the collection", async () => {
    await mintParcelTx(seller, sellerOwnerAttestation, asset);

    const parcel = await program.account.parcel.fetch(parcelPda);
    expect(parcel.bbl).to.eq(BBL);
    expect(parcel.owner.toBase58()).to.eq(seller.publicKey.toBase58());
    expect(parcel.coreAsset.toBase58()).to.eq(asset.publicKey.toBase58());
    expect(parcel.address).to.eq(MINT_ARGS.address);
    expect(parcel.borough).to.eq(1);
    expect(parcel.latE6).to.eq(MINT_ARGS.latE6);
    expect(parcel.lngE6).to.eq(MINT_ARGS.lngE6);
    expect(parcel.maxFarBps).to.eq(MINT_ARGS.maxFarBps);
    expect(parcel.unusedSqft.toString()).to.eq(VERDICT.unusedSqft.toString());
    expect(parcel.estValueUsd.toString()).to.eq(VERDICT.estValueUsd.toString());
    expect(parcel.zoning).to.eq(MINT_ARGS.zoning);
    expect(parcel.verdictHash).to.deep.eq(VERDICT.reportHash);
    expect(parcel.status).to.eq(0);

    const registry = await program.account.registry.fetch(registryPda);
    expect(registry.parcelCount.toNumber()).to.eq(1);

    const owner = await coreAssetOwner(asset.publicKey);
    expect(owner.toBase58()).to.eq(seller.publicKey.toBase58());
    const data = (await connection.getAccountInfo(asset.publicKey))!.data;
    for (const needle of [MINT_ARGS.name, MINT_ARGS.uri, BBL, "AirSpace Registrar", "verdict_hash", "40.748400", "-73.985700", "15.00"]) {
      expect(data.includes(utf8(needle)), `asset should carry ${needle}`).to.be.true;
    }
  });

  it("locks the verdict once a parcel exists", async () => {
    await expectError(
      program.methods
        .openVerdict(BBL)
        .accountsPartial({ payer: registrar.publicKey, verdict: verdictPda, parcel: parcelPda })
        .signers([registrar])
        .rpc(),
      "VerdictLocked"
    );
  });

  it("re-opening an unminted verdict resets it to Pending", async () => {
    const verdict2 = pda([utf8("verdict"), utf8(BBL_2)], program.programId);
    const open = () =>
      program.methods
        .openVerdict(BBL_2)
        .accountsPartial({ payer: seller.publicKey })
        .signers([seller])
        .rpc();
    await open();
    await program.methods
      .recordVerdictManual(3, 5_000, 16, new BN(10), new BN(10), VERDICT.reportHash)
      .accountsPartial({ registrar: registrar.publicKey, registry: registryPda, verdict: verdict2 })
      .signers([registrar])
      .rpc();
    expect((await program.account.verdict.fetch(verdict2)).status).to.eq(3);
    await open();
    const v = await program.account.verdict.fetch(verdict2);
    expect(v.status).to.eq(0);
    expect(v.flags).to.eq(0);
    expect(v.requester.toBase58()).to.eq(seller.publicKey.toBase58());
  });

  // ---- listings -----------------------------------------------------------
  it("lists the parcel (asset moves to escrow)", async () => {
    await listParcelTx(PRICE_USD_CENTS);
    const listing = await program.account.listing.fetch(listingPda);
    expect(listing.parcel.toBase58()).to.eq(parcelPda.toBase58());
    expect(listing.seller.toBase58()).to.eq(seller.publicKey.toBase58());
    expect(listing.priceUsdCents.toString()).to.eq(PRICE_USD_CENTS.toString());
    expect((await program.account.parcel.fetch(parcelPda)).status).to.eq(1);
    expect((await coreAssetOwner(asset.publicKey)).toBase58()).to.eq(escrowPda.toBase58());
  });

  it("rejects cancel_listing from a non-seller", async () => {
    await expectError(
      program.methods
        .cancelListing()
        .accountsPartial({
          seller: buyer.publicKey,
          parcel: parcelPda,
          listing: listingPda,
          asset: asset.publicKey,
          collection: collection.publicKey,
          escrow: escrowPda,
          mplCoreProgram: MPL_CORE,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer])
        .rpc(),
      "Unauthorized"
    );
  });

  it("cancels the listing (asset returns to seller, listing closed)", async () => {
    await program.methods
      .cancelListing()
      .accountsPartial({
        seller: seller.publicKey,
        parcel: parcelPda,
        listing: listingPda,
        asset: asset.publicKey,
        collection: collection.publicKey,
        escrow: escrowPda,
        mplCoreProgram: MPL_CORE,
        systemProgram: SystemProgram.programId,
      })
      .signers([seller])
      .rpc();
    expect(await connection.getAccountInfo(listingPda)).to.be.null;
    expect((await program.account.parcel.fetch(parcelPda)).status).to.eq(0);
    expect((await coreAssetOwner(asset.publicKey)).toBase58()).to.eq(seller.publicKey.toBase58());
  });

  it("rejects a zero price and relists the parcel", async () => {
    await expectError(listParcelTx(0n), "InvalidArgs");
    await listParcelTx(PRICE_USD_CENTS);
    expect((await coreAssetOwner(asset.publicKey)).toBase58()).to.eq(escrowPda.toBase58());
  });

  // ---- purchase -----------------------------------------------------------
  it("refuses a purchase without a KYC attestation", async () => {
    await expectError(buyParcelTx(buyer, Keypair.generate().publicKey), "InvalidAttestation");
    // owner attestation is a real SAS account but the wrong schema
    await expectError(buyParcelTx(buyer, buyerOwnerAttestation), "InvalidAttestation");
  });

  it("issues the KYC attestation for the buyer", async () => {
    await issueAttestation(kycSchemaPda, buyer.publicKey, new Uint8Array([2]));
    const info = await connection.getAccountInfo(buyerKycAttestation);
    expect(info?.owner.toBase58()).to.eq(SAS.toBase58());
  });

  it("buys the parcel with Pyth-priced SOL settlement", async () => {
    const priceInfo = await connection.getAccountInfo(PYTH_SOL_USD);
    expect(priceInfo?.owner.toBase58()).to.eq(PYTH_RECEIVER.toBase58());
    const price = parsePriceUpdate(priceInfo!.data);
    expect(price.feedId).to.eq("ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d");
    const lamports = usdCentsToLamports(PRICE_USD_CENTS, price.price, price.exponent);
    const fee = (lamports * BigInt(FEE_BPS)) / 10_000n;
    const toSeller = lamports - fee;
    expect(fee > 0n).to.be.true;

    const listingRent = BigInt((await connection.getAccountInfo(listingPda))!.lamports);
    const [sellerBefore, treasuryBefore, buyerBefore] = await Promise.all(
      [seller, treasury, buyer].map((k) => connection.getBalance(k.publicKey).then(BigInt))
    );

    await buyParcelTx(buyer, buyerKycAttestation);

    const [sellerAfter, treasuryAfter, buyerAfter] = await Promise.all(
      [seller, treasury, buyer].map((k) => connection.getBalance(k.publicKey).then(BigInt))
    );
    expect((treasuryAfter - treasuryBefore).toString(), "treasury fee").to.eq(fee.toString());
    expect((sellerAfter - sellerBefore).toString(), "seller proceeds + listing rent").to.eq((toSeller + listingRent).toString());
    expect((buyerBefore - buyerAfter).toString(), "buyer paid").to.eq(lamports.toString());

    const parcel = await program.account.parcel.fetch(parcelPda);
    expect(parcel.owner.toBase58()).to.eq(buyer.publicKey.toBase58());
    expect(parcel.status).to.eq(0);
    expect(await connection.getAccountInfo(listingPda)).to.be.null;
    expect((await coreAssetOwner(asset.publicKey)).toBase58()).to.eq(buyer.publicKey.toBase58());
    console.log(
      `      SOL/USD ${Number(price.price) / 10 ** -price.exponent} -> $${Number(PRICE_USD_CENTS) / 100} = ${Number(lamports) / LAMPORTS_PER_SOL} SOL (fee ${Number(fee) / LAMPORTS_PER_SOL} SOL)`
    );
  });

  it("refuses to buy a parcel that is no longer listed", async () => {
    await expectError(buyParcelTx(buyer, buyerKycAttestation), "AccountNotInitialized");
  });

  // ---- forwarder gate -----------------------------------------------------
  it("rejects on_report from anyone but the keystone forwarder", async () => {
    const report = encodeVerdictReport({
      bbl: BBL,
      status: 1,
      confidenceBps: 9_000,
      flags: 0,
      unusedSqft: 1n,
      estValueUsd: 1n,
      reportHash: new Uint8Array(32),
    });
    const impostor = Keypair.generate();
    // state not owned by the forwarder program
    await expectError(
      program.methods
        .onReport(Buffer.alloc(0), report)
        .accountsPartial({ state: Keypair.generate().publicKey, forwarderAuthority: impostor.publicKey, registry: registryPda, verdict: verdictPda })
        .signers([impostor])
        .rpc(),
      "InvalidForwarderProgram"
    );
    // real forwarder state, but the signer is not the forwarder PDA
    await expectError(
      program.methods
        .onReport(Buffer.alloc(0), report)
        .accountsPartial({ state: FORWARDER_STATE, forwarderAuthority: impostor.publicKey, registry: registryPda, verdict: verdictPda })
        .signers([impostor])
        .rpc(),
      "InvalidForwarderAuthority"
    );
    const verdict = await program.account.verdict.fetch(verdictPda);
    expect(verdict.source).to.eq(0);
    expect(verdict.confidenceBps).to.eq(VERDICT.confidenceBps);
  });
});
