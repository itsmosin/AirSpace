import "server-only";
import { getReadonlyProgram } from "@/lib/airspace/program";
import { fetchAllListings, fetchAllParcels, fetchAllVerdicts, fetchRegistry, fetchVerdict } from "@/lib/airspace/accounts";
import { PROGRAM_ID, verdictPda } from "@/lib/airspace/pdas";
import type { ParcelRecord, ParcelsResponse, PendingLot, PendingRecord, VerdictView } from "@/lib/airspace/types";
import { getServerConnection } from "./connection";
import { plutoByBbl } from "./pluto";

const CACHE_TTL_MS = 15_000;
let cache: { at: number; data: ParcelsResponse } | null = null;
let inflight: Promise<ParcelsResponse> | null = null;

const pendingLotCache = new Map<string, PendingLot | null>();

async function enrichPending(verdicts: VerdictView[]): Promise<PendingRecord[]> {
  const out: PendingRecord[] = [];
  let lookups = 0;
  for (const v of verdicts) {
    let lot = pendingLotCache.get(v.bbl);
    if (lot === undefined && lookups < 12) {
      lookups += 1;
      try {
        const p = await plutoByBbl(v.bbl);
        lot = p
          ? { address: p.address, borough: p.borough, lat: p.lat, lng: p.lng, numFloors: p.numFloors, lotAreaSqft: p.lotAreaSqft, unusedSqft: v.unusedSqft || p.unusedSqft, estValueUsd: v.estValueUsd || p.estValueUsd, zoning: p.zoning }
          : null;
      } catch {
        lot = undefined; // retry next refresh
      }
      if (lot !== undefined) pendingLotCache.set(v.bbl, lot);
    }
    out.push({ ...v, lot: lot ?? null });
  }
  return out;
}

async function load(): Promise<ParcelsResponse> {
  const connection = getServerConnection();
  const program = getReadonlyProgram(connection);
  const errors: string[] = [];
  const safe = async <T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
      return fallback;
    }
  };

  const [registry, parcels, listings, verdicts] = await Promise.all([
    safe("registry", () => fetchRegistry(program), null),
    safe("parcels", () => fetchAllParcels(program), []),
    safe("listings", () => fetchAllListings(program), []),
    safe("verdicts", () => fetchAllVerdicts(program), []),
  ]);

  const listingByParcel = new Map(listings.map((l) => [l.parcel, l]));
  const verdictByBbl = new Map(verdicts.map((v) => [v.bbl, v]));
  const records: ParcelRecord[] = parcels
    .map((p) => ({ ...p, listing: listingByParcel.get(p.pda) ?? null, verdict: verdictByBbl.get(p.bbl) ?? null }))
    .sort((a, b) => b.mintedAt - a.mintedAt);

  const mintedBbls = new Set(parcels.map((p) => p.bbl));
  const pendingVerdicts = verdicts.filter((v) => !mintedBbls.has(v.bbl)).sort((a, b) => b.requestedAt - a.requestedAt);
  const pending = await enrichPending(pendingVerdicts);

  const stats = {
    parcelsVerified: verdicts.filter((v) => v.status === 1).length,
    parcelsMinted: parcels.length,
    listed: records.filter((r) => r.listing).length,
    sqftTokenized: parcels.reduce((s, p) => s + p.unusedSqft, 0),
    totalValueUsd: parcels.reduce((s, p) => s + p.estValueUsd, 0),
  };

  return {
    programId: PROGRAM_ID.toBase58(),
    registry,
    parcels: records,
    pending,
    stats,
    updatedAt: Date.now(),
    ...(errors.length ? { error: errors.join("; ") } : {}),
  };
}

export async function getParcels(force = false): Promise<ParcelsResponse> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
  if (!inflight) {
    inflight = load()
      .then((data) => {
        cache = { at: Date.now(), data };
        return data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function invalidateParcels() {
  cache = null;
}

export async function getVerdictByBbl(bbl: string): Promise<VerdictView | null> {
  const connection = getServerConnection();
  const program = getReadonlyProgram(connection);
  try {
    return await fetchVerdict(program, verdictPda(bbl, PROGRAM_ID));
  } catch {
    return null;
  }
}
