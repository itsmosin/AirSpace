import { BN } from "@coral-xyz/anchor";
import { PublicKey, type Connection } from "@solana/web3.js";
import type { Borough } from "@airspace/shared";
import type { AirspaceProgram } from "./program";
import { registryPda } from "./pdas";
import type { ListingView, ParcelView, RegistryView, VerdictView } from "./types";

const BOROUGH_BY_CODE: Record<number, Borough> = { 1: "MN", 2: "BX", 3: "BK", 4: "QN", 5: "SI" };

// ---- raw decoded shapes (Anchor camelCases IDL field names) ----
type RawRegistry = {
  admin: PublicKey; registrar: PublicKey; treasury: PublicKey; forwarderProgram: PublicKey; collection: PublicKey;
  ownerCredential: PublicKey; ownerSchema: PublicKey; kycCredential: PublicKey; kycSchema: PublicKey;
  feeBps: number; maxPriceAgeSecs: number; parcelCount: BN; bump: number;
};
type RawVerdict = {
  bbl: string; status: number; confidenceBps: number; flags: number; unusedSqft: BN; estValueUsd: BN;
  reportHash: number[]; source: number; requester: PublicKey; requestedAt: BN; recordedAt: BN; bump: number;
};
type RawParcel = {
  bbl: string; owner: PublicKey; coreAsset: PublicKey; address: string; borough: number; latE6: number; lngE6: number;
  lotAreaSqft: number; builtAreaSqft: number; maxFarBps: number; unusedSqft: BN; estValueUsd: BN; zoning: string;
  verdictHash: number[]; status: number; mintedAt: BN; bump: number;
};
type RawListing = { parcel: PublicKey; seller: PublicKey; priceUsdCents: BN; createdAt: BN; bump: number };

const toHex = (bytes: number[] | Uint8Array) => Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
const bn = (v: BN | number | bigint | undefined | null) => (v == null ? 0 : typeof v === "number" ? v : Number(v.toString()));

export function toRegistryView(pda: PublicKey, r: RawRegistry): RegistryView {
  return {
    pda: pda.toBase58(),
    admin: r.admin.toBase58(), registrar: r.registrar.toBase58(), treasury: r.treasury.toBase58(),
    forwarderProgram: r.forwarderProgram.toBase58(), collection: r.collection.toBase58(),
    ownerCredential: r.ownerCredential.toBase58(), ownerSchema: r.ownerSchema.toBase58(),
    kycCredential: r.kycCredential.toBase58(), kycSchema: r.kycSchema.toBase58(),
    feeBps: r.feeBps, maxPriceAgeSecs: r.maxPriceAgeSecs, parcelCount: bn(r.parcelCount),
  };
}
export function toVerdictView(pda: PublicKey, v: RawVerdict): VerdictView {
  return {
    pda: pda.toBase58(), bbl: v.bbl, status: (v.status & 3) as VerdictView["status"], confidenceBps: v.confidenceBps,
    flags: v.flags, unusedSqft: bn(v.unusedSqft), estValueUsd: bn(v.estValueUsd), reportHash: toHex(v.reportHash),
    source: (v.source === 1 ? 1 : 0), requester: v.requester.toBase58(), requestedAt: bn(v.requestedAt), recordedAt: bn(v.recordedAt),
  };
}
export function toParcelView(pda: PublicKey, p: RawParcel): ParcelView {
  return {
    pda: pda.toBase58(), bbl: p.bbl, owner: p.owner.toBase58(), coreAsset: p.coreAsset.toBase58(), address: p.address,
    borough: p.borough, boroughCode: BOROUGH_BY_CODE[p.borough] ?? "MN", lat: p.latE6 / 1e6, lng: p.lngE6 / 1e6,
    lotAreaSqft: p.lotAreaSqft, builtAreaSqft: p.builtAreaSqft, maxFar: p.maxFarBps / 10000, unusedSqft: bn(p.unusedSqft),
    estValueUsd: bn(p.estValueUsd), zoning: p.zoning, verdictHash: toHex(p.verdictHash), status: p.status === 1 ? 1 : 0,
    mintedAt: bn(p.mintedAt),
  };
}
export function toListingView(pda: PublicKey, l: RawListing): ListingView {
  return { pda: pda.toBase58(), parcel: l.parcel.toBase58(), seller: l.seller.toBase58(), priceUsdCents: bn(l.priceUsdCents), createdAt: bn(l.createdAt) };
}

// ---- account namespace access (IDL is untyped so we index by name) ----
type AccountClient = {
  all: () => Promise<Array<{ publicKey: PublicKey; account: unknown }>>;
  fetchNullable: (pk: PublicKey) => Promise<unknown>;
};
function client(program: AirspaceProgram, name: "registry" | "verdict" | "parcel" | "listing"): AccountClient {
  const ns = program.account as unknown as Record<string, AccountClient | undefined>;
  const c = ns[name];
  if (!c) throw new Error(`IDL has no account "${name}"`);
  return c;
}

export async function fetchRegistry(program: AirspaceProgram): Promise<RegistryView | null> {
  const pda = registryPda(program.programId);
  const raw = (await client(program, "registry").fetchNullable(pda)) as RawRegistry | null;
  return raw ? toRegistryView(pda, raw) : null;
}
export async function fetchVerdict(program: AirspaceProgram, pda: PublicKey): Promise<VerdictView | null> {
  const raw = (await client(program, "verdict").fetchNullable(pda)) as RawVerdict | null;
  return raw ? toVerdictView(pda, raw) : null;
}
export async function fetchParcel(program: AirspaceProgram, pda: PublicKey): Promise<ParcelView | null> {
  const raw = (await client(program, "parcel").fetchNullable(pda)) as RawParcel | null;
  return raw ? toParcelView(pda, raw) : null;
}
export async function fetchListing(program: AirspaceProgram, pda: PublicKey): Promise<ListingView | null> {
  const raw = (await client(program, "listing").fetchNullable(pda)) as RawListing | null;
  return raw ? toListingView(pda, raw) : null;
}
export async function fetchAllParcels(program: AirspaceProgram): Promise<ParcelView[]> {
  const rows = await client(program, "parcel").all();
  return rows.map((r) => toParcelView(r.publicKey, r.account as RawParcel));
}
export async function fetchAllListings(program: AirspaceProgram): Promise<ListingView[]> {
  const rows = await client(program, "listing").all();
  return rows.map((r) => toListingView(r.publicKey, r.account as RawListing));
}
export async function fetchAllVerdicts(program: AirspaceProgram): Promise<VerdictView[]> {
  const rows = await client(program, "verdict").all();
  return rows.map((r) => toVerdictView(r.publicKey, r.account as RawVerdict));
}

/** Returns true when the program account exists on the connected cluster. */
export async function programIsDeployed(connection: Connection, programId: PublicKey) {
  const info = await connection.getAccountInfo(programId);
  return !!info?.executable;
}
