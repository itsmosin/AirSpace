// Geometry helpers for the air-rights volumes drawn on the map.

const METERS_PER_DEG_LAT = 111_320;

/** Square polygon (GeoJSON ring, [lng, lat]) of `meters` side centered on lat/lng. */
export function squareAround(lat: number, lng: number, meters = 25): [number, number][] {
  const half = meters / 2;
  const dLat = half / METERS_PER_DEG_LAT;
  const dLng = half / (METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  return [
    [lng - dLng, lat - dLat],
    [lng + dLng, lat - dLat],
    [lng + dLng, lat + dLat],
    [lng - dLng, lat + dLat],
    [lng - dLng, lat - dLat],
  ];
}

const FLOOR_M = 3.2;

/** Base/top heights (meters) of an air-rights volume: sits on the roof, grows with unused FAR, clamped 15-120 m tall. */
export function volumeHeights(numFloors: number, unusedSqft: number, lotAreaSqft: number) {
  const base = Math.max(0, numFloors) * FLOOR_M;
  const rawExtra = lotAreaSqft > 0 ? (unusedSqft / lotAreaSqft) * FLOOR_M : 0;
  const extra = Math.min(120, Math.max(15, rawExtra));
  return { base, top: base + extra };
}

export function estimateFloors(builtAreaSqft: number, lotAreaSqft: number) {
  if (lotAreaSqft <= 0) return 1;
  return Math.max(1, Math.round(builtAreaSqft / lotAreaSqft));
}

export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export const MIDTOWN = { lng: -73.9857, lat: 40.7484 };
