export type Borough = 'MN' | 'BX' | 'BK' | 'QN' | 'SI';

export type PlutoLot = {
  bbl: string; address: string; borough: Borough; zipcode: string;
  lotAreaSqft: number; builtAreaSqft: number; residFar: number; commFar: number; facilFar: number; maxFar: number;
  zoning: string; specialDistrict: string; numFloors: number; landmark: string; historicDistrict: string;
  ownerName: string; yearBuilt: number; lat: number; lng: number; unusedSqft: number; estValueUsd: number;
};

export type VerdictStatus = 0 | 1 | 2 | 3; // Pending, Allow, Deny, Review
export const VERDICT_LABEL: Record<VerdictStatus, string> = { 0: 'Pending', 1: 'Verified', 2: 'Denied', 3: 'Needs review' };

export const FLAGS = {
  LANDMARK: 1, HISTORIC_DISTRICT: 2, NO_UNUSED_FAR: 4, DATA_MISMATCH: 8,
  LOW_CONFIDENCE: 16, SPECIAL_DISTRICT: 32, OWNER_MISMATCH: 64,
} as const;

export const BOROUGH_CODE: Record<Borough, number> = { MN: 1, BX: 2, BK: 3, QN: 4, SI: 5 };
export const BOROUGH_NAME: Record<Borough, string> = { MN: 'Manhattan', BX: 'Bronx', BK: 'Brooklyn', QN: 'Queens', SI: 'Staten Island' };

export const PRICE_PER_SQFT = { MN_CORE: 350, MN: 250, BK: 180, QN: 120, BX: 90, SI: 70 } as const;

export type VerdictReport = {
  bbl: string; status: 1 | 2 | 3; confidenceBps: number; flags: number;
  unusedSqft: bigint; estValueUsd: bigint; reportHash: Uint8Array; // 32 bytes
};
