import "server-only";
import { PLUTO_SELECT, PLUTO_URL, normalizePluto, type PlutoLot } from "@airspace/shared";
import { haversineMeters } from "@/lib/geo";
import { SERVER_ENV } from "./env";

const TIMEOUT_MS = 8000;

async function socrata(params: Record<string, string>): Promise<Record<string, unknown>[]> {
  const url = new URL(PLUTO_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers: Record<string, string> = { accept: "application/json" };
  if (process.env.SOCRATA_APP_TOKEN) headers["X-App-Token"] = process.env.SOCRATA_APP_TOKEN;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) throw new Error(`PLUTO request failed (${res.status})`);
  return (await res.json()) as Record<string, unknown>[];
}

const lotCache = new Map<string, { at: number; lot: PlutoLot | null }>();
const LOT_TTL = 10 * 60 * 1000;

export async function plutoByBbl(bbl: string): Promise<PlutoLot | null> {
  const hit = lotCache.get(bbl);
  if (hit && Date.now() - hit.at < LOT_TTL) return hit.lot;
  const rows = await socrata({ bbl, $select: PLUTO_SELECT, $limit: "1" });
  const lot = rows[0] ? normalizePluto(rows[0]) : null;
  lotCache.set(bbl, { at: Date.now(), lot });
  return lot;
}

export async function plutoNearest(lat: number, lng: number, radiusDeg = 0.0015): Promise<PlutoLot | null> {
  const where = `latitude between ${(lat - radiusDeg).toFixed(6)} and ${(lat + radiusDeg).toFixed(6)} and longitude between ${(lng - radiusDeg).toFixed(6)} and ${(lng + radiusDeg).toFixed(6)}`;
  const rows = await socrata({ $where: where, $select: PLUTO_SELECT, $limit: "60" });
  if (rows.length === 0) return null;
  const lots = rows.map(normalizePluto).filter((l) => l.lat && l.lng);
  lots.sort((a, b) => haversineMeters(lat, lng, a.lat, a.lng) - haversineMeters(lat, lng, b.lat, b.lng));
  return lots[0] ?? null;
}

type Geocode = { lat: number; lng: number; label: string };

export async function geocodeAddress(address: string): Promise<Geocode | null> {
  const token = SERVER_ENV.mapboxToken;
  if (!token) return null;
  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("q", address);
  url.searchParams.set("proximity", "-73.98,40.75");
  url.searchParams.set("country", "us");
  url.searchParams.set("limit", "1");
  url.searchParams.set("access_token", token);
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) throw new Error(`Mapbox geocoding failed (${res.status})`);
  const json = (await res.json()) as { features?: Array<{ geometry: { coordinates: [number, number] }; properties?: { full_address?: string; name?: string } }> };
  const f = json.features?.[0];
  if (!f) return null;
  const [lng, lat] = f.geometry.coordinates;
  return { lat, lng, label: f.properties?.full_address ?? f.properties?.name ?? address };
}

/** Fallback when no Mapbox token: PLUTO full-text search on a normalized street address. */
const ORDINALS: Record<string, string> = {
  first: "1", second: "2", third: "3", fourth: "4", fifth: "5", sixth: "6", seventh: "7", eighth: "8", ninth: "9", tenth: "10",
  eleventh: "11", twelfth: "12",
};
export function normalizeStreetQuery(address: string) {
  return address
    .toLowerCase()
    .replace(/,.*$/, "")
    .replace(/\b(\d+)(st|nd|rd|th)\b/g, "$1")
    .replace(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\b/g, (m) => ORDINALS[m])
    .replace(/\bave\.?\b|\bav\b/g, "avenue")
    .replace(/\bst\.?\b/g, "street")
    .replace(/\bblvd\.?\b/g, "boulevard")
    .replace(/\bw\.?\b/g, "west")
    .replace(/\be\.?\b/g, "east")
    .replace(/\bnew york\b|\bnyc\b|\bny\b|\bmanhattan\b/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

const BOROUGH_RANK: Record<string, number> = { MN: 0, BK: 1, QN: 2, BX: 3, SI: 4 };

export async function plutoByAddressText(address: string): Promise<PlutoLot | null> {
  const q = normalizeStreetQuery(address);
  if (!q) return null;
  const houseNo = q.split(" ")[0];
  const street = q.slice(houseNo.length).trim();
  const byBorough = (a: PlutoLot, b: PlutoLot) => (BOROUGH_RANK[a.borough] ?? 9) - (BOROUGH_RANK[b.borough] ?? 9);
  // 1) exact house number + street prefix, e.g. "350 5 AVENUE"
  if (/^\d+$/.test(houseNo) && street) {
    const safe = q.replace(/'/g, "''");
    const rows = await socrata({ $where: `upper(address) like '${safe}%'`, $select: PLUTO_SELECT, $limit: "20" });
    const lots = rows.map(normalizePluto).sort(byBorough);
    if (lots[0]) return lots[0];
    // 2) same street, nearest house number (PLUTO addresses are ranges like "338 5 AVENUE")
    const streetRows = await socrata({ $where: `upper(address) like '% ${street.replace(/'/g, "''")}'`, $select: PLUTO_SELECT, $limit: "400" });
    const target = Number(houseNo);
    const candidates = streetRows.map(normalizePluto).filter((l) => /^\d+/.test(l.address));
    candidates.sort((a, b) => {
      const da = Math.abs(parseInt(a.address, 10) - target), db = Math.abs(parseInt(b.address, 10) - target);
      return da - db || byBorough(a, b);
    });
    if (candidates[0] && Math.abs(parseInt(candidates[0].address, 10) - target) <= 40) return candidates[0];
  }
  // 3) full-text search as a last resort
  const rows = await socrata({ $q: q, $select: PLUTO_SELECT, $limit: "10" });
  if (rows.length === 0) return null;
  const lots = rows.map(normalizePluto).sort(byBorough);
  return lots.find((l) => l.address.toUpperCase().startsWith(houseNo + " ")) ?? lots[0];
}

export async function plutoByAddress(address: string): Promise<{ lot: PlutoLot | null; geocode: Geocode | null; method: "mapbox" | "pluto-text" }> {
  const geocode = await geocodeAddress(address);
  if (geocode) {
    const lot = await plutoNearest(geocode.lat, geocode.lng);
    return { lot, geocode, method: "mapbox" };
  }
  const lot = await plutoByAddressText(address);
  return { lot, geocode: null, method: "pluto-text" };
}
