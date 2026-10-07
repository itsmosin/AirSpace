/**
 * @airspace/sas — Solana Attestation Service (SAS) helpers for the AirSpace registrar.
 *
 * The SAS program has no Anchor IDL, so instructions are encoded by hand here and
 * account data is parsed byte-by-byte (same layout the on-chain `airspace` program
 * checks). Everything is expressed with `@solana/web3.js` v1 types so the web app,
 * the scripts and the program tests can share it.
 *
 * SAS wire formats used:
 *   instruction tag (u8)       0 = create_credential, 1 = create_schema, 6 = create_attestation
 *   account discriminator (u8) 0 = Credential, 1 = Schema, 2 = Attestation
 *   SchemaDataTypes (u8)       U8 = 0, String = 12
 */
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { AIRSPACE_PROGRAM_ID, SAS_PROGRAM_ID, SEEDS } from '@airspace/shared';

// ---------------------------------------------------------------------------
// Public types and constants
// ---------------------------------------------------------------------------

export type SasContext = { rpcUrl: string; registrar: Keypair };
export type SasConfig = { credential: string; ownerSchema: string; kycSchema: string };

export const CREDENTIAL_NAME = 'AirSpace Registrar';

/** SAS `SchemaDataTypes` byte codes. */
const SCHEMA_TYPE_U8 = 0;
const SCHEMA_TYPE_STRING = 12;

type SchemaDef = { name: string; version: number; layout: number[]; fieldNames: string[] };

/** Proof that `wallet` holds title to lot `bbl`. Data = Borsh String(bbl): u32 LE length + utf8. */
export const OWNER_SCHEMA: SchemaDef = {
  name: 'airspace_owner_v1',
  version: 1,
  layout: [SCHEMA_TYPE_STRING],
  fieldNames: ['bbl'],
};

/** Buyer KYC. Data = [level] (u8, 1 = verified). */
export const KYC_SCHEMA: SchemaDef = {
  name: 'airspace_kyc_v1',
  version: 1,
  layout: [SCHEMA_TYPE_U8],
  fieldNames: ['level'],
};

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const SAS_PROGRAM = new PublicKey(SAS_PROGRAM_ID);
const AIRSPACE_PROGRAM = new PublicKey(AIRSPACE_PROGRAM_ID);

const IX_CREATE_CREDENTIAL = 0;
const IX_CREATE_SCHEMA = 1;
const IX_CREATE_ATTESTATION = 6;
const ATTESTATION_DISCRIMINATOR = 2;

const SCHEMA_DESCRIPTION: Record<string, string> = {
  [OWNER_SCHEMA.name]: 'AirSpace: wallet holds title to the NYC lot identified by BBL',
  [KYC_SCHEMA.name]: 'AirSpace: buyer identity verification level',
};

const ONE_YEAR_SECS = 365 * 24 * 60 * 60;
const defaultExpiry = () => Math.floor(Date.now() / 1000) + ONE_YEAR_SECS;

const u32le = (n: number): Buffer => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
};
const i64le = (n: bigint): Buffer => {
  const b = Buffer.alloc(8);
  b.writeBigInt64LE(n);
  return b;
};
const borshBytes = (bytes: Uint8Array): Buffer => Buffer.concat([u32le(bytes.length), Buffer.from(bytes)]);
const borshString = (s: string): Buffer => borshBytes(Buffer.from(s, 'utf8'));

function assertBbl(bbl: string): void {
  if (!/^\d{10}$/.test(bbl)) throw new Error(`BBL must be a 10-digit string, got "${bbl}"`);
}

// ---------------------------------------------------------------------------
// PDAs
// ---------------------------------------------------------------------------

export function deriveCredentialPda(authority: PublicKey, name: string): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('credential'), authority.toBuffer(), Buffer.from(name, 'utf8')],
    SAS_PROGRAM,
  )[0];
}

export function deriveSchemaPda(credential: PublicKey, name: string, version: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('schema'), credential.toBuffer(), Buffer.from(name, 'utf8'), Buffer.from([version])],
    SAS_PROGRAM,
  )[0];
}

export function deriveAttestationPda(credential: PublicKey, schema: PublicKey, nonce: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('attestation'), credential.toBuffer(), schema.toBuffer(), nonce.toBuffer()],
    SAS_PROGRAM,
  )[0];
}

/** Nonce for an owner attestation: seeds ["owner-nonce", wallet, bbl] under the AirSpace program. */
export function ownerNoncePda(programId: PublicKey, wallet: PublicKey, bbl: string): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.ownerNonce), wallet.toBuffer(), Buffer.from(bbl, 'utf8')],
    programId,
  )[0];
}

// ---------------------------------------------------------------------------
// Instruction builders
// ---------------------------------------------------------------------------

function createCredentialIx(p: {
  payer: PublicKey;
  authority: PublicKey;
  name: string;
  signers: PublicKey[];
}): TransactionInstruction {
  const credential = deriveCredentialPda(p.authority, p.name);
  const data = Buffer.concat([
    Buffer.from([IX_CREATE_CREDENTIAL]),
    borshString(p.name),
    u32le(p.signers.length),
    ...p.signers.map((s) => s.toBuffer()),
  ]);
  return new TransactionInstruction({
    programId: SAS_PROGRAM,
    keys: [
      { pubkey: p.payer, isSigner: true, isWritable: true },
      { pubkey: credential, isSigner: false, isWritable: true },
      { pubkey: p.authority, isSigner: true, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function createSchemaIx(p: {
  payer: PublicKey;
  authority: PublicKey;
  credential: PublicKey;
  def: SchemaDef;
  description: string;
}): TransactionInstruction {
  // create_schema always creates version 1; later versions go through change_schema_version.
  if (p.def.version !== 1) throw new Error(`create_schema only creates version 1 (schema ${p.def.name} asks for ${p.def.version})`);
  const schema = deriveSchemaPda(p.credential, p.def.name, p.def.version);
  const data = Buffer.concat([
    Buffer.from([IX_CREATE_SCHEMA]),
    borshString(p.def.name),
    borshString(p.description),
    borshBytes(Uint8Array.from(p.def.layout)),
    u32le(p.def.fieldNames.length),
    ...p.def.fieldNames.map(borshString),
  ]);
  return new TransactionInstruction({
    programId: SAS_PROGRAM,
    keys: [
      { pubkey: p.payer, isSigner: true, isWritable: true },
      { pubkey: p.authority, isSigner: true, isWritable: false },
      { pubkey: p.credential, isSigner: false, isWritable: false },
      { pubkey: schema, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function createAttestationIx(p: {
  payer: PublicKey;
  signer: PublicKey;
  credential: PublicKey;
  schema: PublicKey;
  nonce: PublicKey;
  data: Uint8Array;
  expiry: bigint;
}): TransactionInstruction {
  const attestation = deriveAttestationPda(p.credential, p.schema, p.nonce);
  const data = Buffer.concat([
    Buffer.from([IX_CREATE_ATTESTATION]),
    p.nonce.toBuffer(),
    borshBytes(p.data),
    i64le(p.expiry),
  ]);
  return new TransactionInstruction({
    programId: SAS_PROGRAM,
    keys: [
      { pubkey: p.payer, isSigner: true, isWritable: true },
      { pubkey: p.signer, isSigner: true, isWritable: false },
      { pubkey: p.credential, isSigner: false, isWritable: false },
      { pubkey: p.schema, isSigner: false, isWritable: false },
      { pubkey: attestation, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function accountExists(conn: Connection, address: PublicKey): Promise<boolean> {
  return (await conn.getAccountInfo(address, 'confirmed')) !== null;
}

function isRetryable(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message ?? e);
  return /block ?height exceeded|blockhash not found|has expired|429|too many requests|timed out|was not confirmed/i.test(msg);
}

/** Send one instruction signed by the registrar; retries transient devnet failures. */
async function sendIx(conn: Connection, ix: TransactionInstruction, signer: Keypair, target: PublicKey): Promise<string> {
  let lastSig = '';
  for (let attempt = 1; ; attempt++) {
    try {
      return await sendAndConfirmTransaction(conn, new Transaction().add(ix), [signer], { commitment: 'confirmed' });
    } catch (e) {
      lastSig = (e as { signature?: string })?.signature ?? lastSig;
      // A timed-out attempt may still have landed; the account is the source of truth.
      if (await accountExists(conn, target)) return lastSig;
      if (!isRetryable(e) || attempt >= 3) throw e;
      await sleep(1500 * attempt);
    }
  }
}

async function createIfMissing(
  conn: Connection,
  target: PublicKey,
  buildIx: () => TransactionInstruction,
  signer: Keypair,
): Promise<{ sig: string; existed: boolean }> {
  if (await accountExists(conn, target)) return { sig: '', existed: true };
  return { sig: await sendIx(conn, buildIx(), signer, target), existed: false };
}

// ---------------------------------------------------------------------------
// Setup: credential + schemas (idempotent)
// ---------------------------------------------------------------------------

/**
 * Creates the "AirSpace Registrar" credential (authority = registrar, authorized signer = registrar)
 * and the owner + KYC schemas. Accounts that already exist are left untouched, so this can be
 * re-run safely. `txs` lists only the transactions actually sent.
 */
export async function setupRegistrarSas(ctx: SasContext): Promise<SasConfig & { txs: string[] }> {
  const conn = new Connection(ctx.rpcUrl, 'confirmed');
  const authority = ctx.registrar.publicKey;
  const credential = deriveCredentialPda(authority, CREDENTIAL_NAME);
  const txs: string[] = [];

  const cred = await createIfMissing(
    conn,
    credential,
    () => createCredentialIx({ payer: authority, authority, name: CREDENTIAL_NAME, signers: [authority] }),
    ctx.registrar,
  );
  if (cred.sig) txs.push(cred.sig);

  const schemas: PublicKey[] = [];
  for (const def of [OWNER_SCHEMA, KYC_SCHEMA]) {
    const schema = deriveSchemaPda(credential, def.name, def.version);
    const r = await createIfMissing(
      conn,
      schema,
      () => createSchemaIx({ payer: authority, authority, credential, def, description: SCHEMA_DESCRIPTION[def.name] ?? '' }),
      ctx.registrar,
    );
    if (r.sig) txs.push(r.sig);
    schemas.push(schema);
  }

  return {
    credential: credential.toBase58(),
    ownerSchema: schemas[0].toBase58(),
    kycSchema: schemas[1].toBase58(),
    txs,
  };
}

// ---------------------------------------------------------------------------
// Attestations
// ---------------------------------------------------------------------------

type IssueResult = { attestation: PublicKey; txSignature: string; alreadyExisted: boolean };

async function issueAttestation(
  ctx: SasContext,
  credential: PublicKey,
  schema: PublicKey,
  nonce: PublicKey,
  data: Uint8Array,
  expiryTs: number,
): Promise<IssueResult> {
  if (!Number.isInteger(expiryTs) || expiryTs < 0) throw new Error(`expiryTs must be a non-negative integer unix timestamp (0 = never)`);
  const conn = new Connection(ctx.rpcUrl, 'confirmed');
  const attestation = deriveAttestationPda(credential, schema, nonce);
  const r = await createIfMissing(
    conn,
    attestation,
    () =>
      createAttestationIx({
        payer: ctx.registrar.publicKey,
        signer: ctx.registrar.publicKey,
        credential,
        schema,
        nonce,
        data,
        expiry: BigInt(expiryTs),
      }),
    ctx.registrar,
  );
  return { attestation, txSignature: r.sig, alreadyExisted: r.existed };
}

/**
 * Attest that `wallet` owns lot `bbl`. Nonce = ownerNoncePda(AirSpace program, wallet, bbl);
 * data = Borsh String(bbl). Expiry defaults to now + 365 days. Idempotent per (wallet, bbl).
 */
export async function issueOwnerAttestation(
  ctx: SasContext,
  cfg: SasConfig,
  p: { wallet: PublicKey; bbl: string; expiryTs?: number },
): Promise<IssueResult> {
  assertBbl(p.bbl);
  const nonce = ownerNoncePda(AIRSPACE_PROGRAM, p.wallet, p.bbl);
  return issueAttestation(
    ctx,
    new PublicKey(cfg.credential),
    new PublicKey(cfg.ownerSchema),
    nonce,
    borshString(p.bbl),
    p.expiryTs ?? defaultExpiry(),
  );
}

/**
 * Attest a buyer's KYC level. Nonce = the wallet itself; data = [level] (u8, default 1).
 * Expiry defaults to now + 365 days. Idempotent per wallet.
 */
export async function issueKycAttestation(
  ctx: SasContext,
  cfg: SasConfig,
  p: { wallet: PublicKey; level?: number; expiryTs?: number },
): Promise<IssueResult> {
  const level = p.level ?? 1;
  if (!Number.isInteger(level) || level < 0 || level > 255) throw new Error(`KYC level must be an integer 0..255, got ${level}`);
  return issueAttestation(
    ctx,
    new PublicKey(cfg.credential),
    new PublicKey(cfg.kycSchema),
    p.wallet,
    Uint8Array.of(level),
    p.expiryTs ?? defaultExpiry(),
  );
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export type AttestationData = {
  nonce: PublicKey;
  credential: PublicKey;
  schema: PublicKey;
  data: Uint8Array;
  signer: PublicKey;
  expiry: bigint;
};

/**
 * Fetch and parse an Attestation account. Returns null when the account does not exist.
 * Layout: [0] discriminator, [1..33] nonce, [33..65] credential, [65..97] schema,
 * [97..101] data_len u32 LE, data, signer (32), expiry i64 LE, token_account (32).
 */
export async function fetchAttestation(rpcUrl: string, attestation: PublicKey): Promise<AttestationData | null> {
  const conn = new Connection(rpcUrl, 'confirmed');
  const info = await conn.getAccountInfo(attestation, 'confirmed');
  if (!info) return null;
  if (!info.owner.equals(SAS_PROGRAM)) throw new Error(`${attestation.toBase58()} is not owned by the SAS program`);
  const buf = info.data;
  if (buf.length < 1 + 32 * 3 + 4 || buf[0] !== ATTESTATION_DISCRIMINATOR) {
    throw new Error(`${attestation.toBase58()} is not an Attestation account`);
  }
  let o = 1;
  const nonce = new PublicKey(buf.subarray(o, (o += 32)));
  const credential = new PublicKey(buf.subarray(o, (o += 32)));
  const schema = new PublicKey(buf.subarray(o, (o += 32)));
  const len = buf.readUInt32LE(o);
  o += 4;
  if (buf.length < o + len + 32 + 8) throw new Error(`${attestation.toBase58()}: truncated attestation data`);
  const data = new Uint8Array(buf.subarray(o, (o += len)));
  const signer = new PublicKey(buf.subarray(o, (o += 32)));
  const expiry = buf.readBigInt64LE(o);
  return { nonce, credential, schema, data, signer, expiry };
}

// ---------------------------------------------------------------------------
// Config file
// ---------------------------------------------------------------------------

/**
 * Load `keys/sas-config.json` (written by `scripts/setup-sas.ts`). Server-side only: reads the
 * filesystem through `process.getBuiltinModule` so the module stays free of static `node:` imports.
 */
export function loadSasConfig(path: string): SasConfig {
  const getBuiltin = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } }).process?.getBuiltinModule;
  if (!getBuiltin) throw new Error('loadSasConfig is only available in a Node/Bun runtime');
  const { readFileSync } = getBuiltin('node:fs') as typeof import('node:fs');
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  const pick = (k: keyof SasConfig): string => {
    const v = raw[k];
    if (typeof v !== 'string') throw new Error(`${path}: missing "${k}"`);
    new PublicKey(v); // throws on an invalid base58 key
    return v;
  };
  return { credential: pick('credential'), ownerSchema: pick('ownerSchema'), kycSchema: pick('kycSchema') };
}
