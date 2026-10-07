import type { ParcelRecord, PendingRecord } from "@/lib/airspace/types";
import { estimateFloors } from "@/lib/geo";
import type { MapParcel } from "./types";

export function toMapParcels(parcels: ParcelRecord[], pending: PendingRecord[] = []): MapParcel[] {
  const minted: MapParcel[] = parcels.map((p) => ({
    bbl: p.bbl,
    address: p.address,
    lat: p.lat,
    lng: p.lng,
    numFloors: estimateFloors(p.builtAreaSqft, p.lotAreaSqft),
    lotAreaSqft: p.lotAreaSqft,
    unusedSqft: p.unusedSqft,
    estValueUsd: p.estValueUsd,
    state: p.listing ? "listed" : "verified",
    priceUsd: p.listing ? p.listing.priceUsdCents / 100 : undefined,
    maxFar: p.maxFar,
    owner: p.owner,
  }));
  const seen = new Set(minted.map((m) => m.bbl));
  const extra: MapParcel[] = pending
    .filter((v) => v.lot && !seen.has(v.bbl))
    .map((v) => ({
      bbl: v.bbl,
      address: v.lot!.address,
      lat: v.lot!.lat,
      lng: v.lot!.lng,
      numFloors: v.lot!.numFloors || 1,
      lotAreaSqft: v.lot!.lotAreaSqft,
      unusedSqft: v.lot!.unusedSqft,
      estValueUsd: v.lot!.estValueUsd,
      state: v.status === 2 ? "denied" : v.status === 1 ? "verified" : "pending",
    }));
  return [...minted, ...extra];
}
