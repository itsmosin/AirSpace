import { BOROUGH_NAME, type Borough, type PlutoLot } from "@airspace/shared";
import type { ParcelView, VerdictView } from "@/lib/airspace/types";

export type CoreMetadata = {
  name: string;
  symbol: string;
  description: string;
  image: string;
  external_url: string;
  attributes: Array<{ trait_type: string; value: string | number }>;
  properties: { category: string; files: Array<{ uri: string; type: string }> };
};

export type MetadataSource = {
  bbl: string;
  address: string;
  borough: Borough;
  zoning: string;
  lotAreaSqft: number;
  builtAreaSqft: number;
  maxFar: number;
  unusedSqft: number;
  estValueUsd: number;
  lat: number;
  lng: number;
  verdictHash: string;
  verifiedBy: "Chainlink CRE" | "AirSpace Registrar" | "Unverified";
};

export function sourceFromParcel(p: ParcelView, v: VerdictView | null): MetadataSource {
  return {
    bbl: p.bbl, address: p.address, borough: p.boroughCode, zoning: p.zoning, lotAreaSqft: p.lotAreaSqft, builtAreaSqft: p.builtAreaSqft,
    maxFar: p.maxFar, unusedSqft: p.unusedSqft, estValueUsd: p.estValueUsd, lat: p.lat, lng: p.lng, verdictHash: p.verdictHash,
    verifiedBy: v ? (v.source === 1 ? "Chainlink CRE" : "AirSpace Registrar") : "AirSpace Registrar",
  };
}

export function sourceFromLot(lot: PlutoLot, v: VerdictView | null): MetadataSource {
  return {
    bbl: lot.bbl, address: lot.address, borough: lot.borough, zoning: lot.zoning, lotAreaSqft: lot.lotAreaSqft, builtAreaSqft: lot.builtAreaSqft,
    maxFar: lot.maxFar, unusedSqft: v?.unusedSqft || lot.unusedSqft, estValueUsd: v?.estValueUsd || lot.estValueUsd, lat: lot.lat, lng: lot.lng,
    verdictHash: v?.reportHash ?? "", verifiedBy: v && v.status === 1 ? (v.source === 1 ? "Chainlink CRE" : "AirSpace Registrar") : "Unverified",
  };
}

export function assetName(address: string) {
  return `Air Rights · ${address}`;
}

export function buildMetadata(src: MetadataSource, origin: string): CoreMetadata {
  const image = `${origin}/api/og/${src.bbl}`;
  return {
    name: assetName(src.address),
    symbol: "AIR",
    description: `${src.unusedSqft.toLocaleString("en-US")} sq ft of unused development rights above ${src.address}, ${BOROUGH_NAME[src.borough]} (BBL ${src.bbl}). Verified by ${src.verifiedBy} and settled on Solana.`,
    image,
    external_url: `${origin}/parcel/${src.bbl}`,
    attributes: [
      { trait_type: "bbl", value: src.bbl },
      { trait_type: "address", value: src.address },
      { trait_type: "borough", value: BOROUGH_NAME[src.borough] },
      { trait_type: "zoning", value: src.zoning },
      { trait_type: "lot_area_sqft", value: src.lotAreaSqft },
      { trait_type: "built_area_sqft", value: src.builtAreaSqft },
      { trait_type: "max_far", value: src.maxFar },
      { trait_type: "unused_sqft", value: src.unusedSqft },
      { trait_type: "est_value_usd", value: src.estValueUsd },
      { trait_type: "verdict_hash", value: src.verdictHash },
      { trait_type: "lat", value: src.lat },
      { trait_type: "lng", value: src.lng },
      { trait_type: "verified_by", value: src.verifiedBy },
    ],
    properties: { category: "image", files: [{ uri: image, type: "image/svg+xml" }] },
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Dark editorial card used as the Core asset image. */
export function renderParcelSvg(src: Partial<MetadataSource> & { bbl: string }) {
  const address = esc(src.address || "Unknown address");
  const borough = src.borough ? BOROUGH_NAME[src.borough] : "New York";
  const sqft = (src.unusedSqft ?? 0).toLocaleString("en-US");
  const value = src.estValueUsd ? `$${(src.estValueUsd / 1e6).toFixed(2)}M` : "—";
  const verified = src.verifiedBy && src.verifiedBy !== "Unverified";
  const bars = Array.from({ length: 14 }, (_, i) => {
    const h = 60 + ((i * 37) % 160);
    const x = 760 + i * 22;
    const color = i % 3 === 0 ? "#8b5cf6" : "#22d3ee";
    return `<rect x="${x}" y="${420 - h}" width="10" height="${h}" rx="2" fill="${color}" opacity="${0.35 + (i % 4) * 0.15}"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="g1" cx="15%" cy="0%" r="70%"><stop offset="0%" stop-color="#22d3ee" stop-opacity="0.35"/><stop offset="100%" stop-color="#07090f" stop-opacity="0"/></radialGradient>
    <radialGradient id="g2" cx="95%" cy="20%" r="60%"><stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.4"/><stop offset="100%" stop-color="#07090f" stop-opacity="0"/></radialGradient>
    <linearGradient id="t" x1="0" x2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c7f6ff"/></linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#07090f"/>
  <rect width="1200" height="630" fill="url(#g1)"/>
  <rect width="1200" height="630" fill="url(#g2)"/>
  <g stroke="#ffffff" stroke-opacity="0.06">${Array.from({ length: 25 }, (_, i) => `<line x1="${i * 50}" y1="0" x2="${i * 50}" y2="630"/>`).join("")}${Array.from({ length: 13 }, (_, i) => `<line x1="0" y1="${i * 50}" x2="1200" y2="${i * 50}"/>`).join("")}</g>
  ${bars}
  <g transform="translate(72,70)">
    <rect x="0" y="4" width="4" height="28" rx="1" fill="#22d3ee"/><rect x="9" y="0" width="4" height="36" rx="1" fill="#22d3ee"/><rect x="18" y="10" width="4" height="22" rx="1" fill="#8b5cf6"/>
    <text x="34" y="27" font-family="Inter, Helvetica, Arial, sans-serif" font-size="26" font-weight="600" fill="#e6e9f2" letter-spacing="-0.5">AirSpace</text>
  </g>
  <text x="72" y="190" font-family="Inter, Helvetica, Arial, sans-serif" font-size="22" fill="#8b93a7" letter-spacing="4">AIR RIGHTS · ${esc(borough.toUpperCase())}</text>
  <text x="72" y="268" font-family="Inter, Helvetica, Arial, sans-serif" font-size="58" font-weight="700" fill="url(#t)" letter-spacing="-2">${address.length > 30 ? address.slice(0, 30) + "…" : address}</text>
  <text x="72" y="330" font-family="ui-monospace, Menlo, monospace" font-size="22" fill="#8b93a7">BBL ${esc(src.bbl)}</text>
  <g transform="translate(72,400)">
    <text font-family="Inter, Helvetica, Arial, sans-serif" font-size="18" fill="#8b93a7" letter-spacing="3">UNUSED</text>
    <text y="52" font-family="Inter, Helvetica, Arial, sans-serif" font-size="46" font-weight="700" fill="#e6e9f2" letter-spacing="-1">${sqft} <tspan font-size="22" fill="#8b93a7">sq ft</tspan></text>
  </g>
  <g transform="translate(420,400)">
    <text font-family="Inter, Helvetica, Arial, sans-serif" font-size="18" fill="#8b93a7" letter-spacing="3">EST. VALUE</text>
    <text y="52" font-family="Inter, Helvetica, Arial, sans-serif" font-size="46" font-weight="700" fill="#e6e9f2" letter-spacing="-1">${value}</text>
  </g>
  <g transform="translate(72,520)">
    <rect width="${verified ? 330 : 190}" height="44" rx="22" fill="${verified ? "#22d3ee" : "#8b93a7"}" fill-opacity="0.12" stroke="${verified ? "#22d3ee" : "#8b93a7"}" stroke-opacity="0.5"/>
    <circle cx="24" cy="22" r="5" fill="${verified ? "#22d3ee" : "#8b93a7"}"/>
    <text x="42" y="28" font-family="Inter, Helvetica, Arial, sans-serif" font-size="18" fill="#e6e9f2">${verified ? `Verified by ${esc(src.verifiedBy!)}` : "Unverified"}</text>
  </g>
  <text x="1128" y="590" text-anchor="end" font-family="ui-monospace, Menlo, monospace" font-size="16" fill="#5b6378">Solana devnet · Metaplex Core</text>
</svg>`;
}

export function renderCollectionSvg() {
  return renderParcelSvg({ bbl: "COLLECTION", address: "New York City", borough: "MN", unusedSqft: 0, estValueUsd: 0, verifiedBy: "Chainlink CRE" })
    .replace("BBL COLLECTION", "AIR RIGHTS COLLECTION")
    .replace(/0 <tspan[^<]*<\/tspan>/, "Verified <tspan font-size=\"22\" fill=\"#8b93a7\">parcels</tspan>")
    .replace(">—<", ">NYC<");
}
