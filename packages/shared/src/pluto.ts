import { PRICE_PER_SQFT, type Borough, type PlutoLot } from './types';

/** Normalize a raw PLUTO Socrata row into PlutoLot and compute unused FAR + estimate. */
export function normalizePluto(row: Record<string, any>): PlutoLot {
  const num = (v: any) => (v === undefined || v === null || v === '' ? 0 : Number(v));
  const bbl = String(row.bbl ?? '').split('.')[0].padStart(10, '0');
  const lotAreaSqft = num(row.lotarea);
  const builtAreaSqft = num(row.bldgarea);
  const residFar = num(row.residfar), commFar = num(row.commfar), facilFar = num(row.facilfar);
  const maxFar = Math.max(residFar, commFar, facilFar);
  const unusedSqft = Math.max(0, Math.floor(maxFar * lotAreaSqft - builtAreaSqft));
  const borough = (row.borough ?? 'MN') as Borough;
  const lat = num(row.latitude), lng = num(row.longitude);
  const zipcode = String(row.zipcode ?? '');
  const core = borough === 'MN' && zipcode.startsWith('100') && lat > 40.70 && lat < 40.80;
  const ppsf = borough === 'MN' ? (core ? PRICE_PER_SQFT.MN_CORE : PRICE_PER_SQFT.MN) : PRICE_PER_SQFT[borough];
  return {
    bbl, address: String(row.address ?? '').trim(), borough, zipcode,
    lotAreaSqft, builtAreaSqft, residFar, commFar, facilFar, maxFar,
    zoning: String(row.zonedist1 ?? ''), specialDistrict: String(row.spdist1 ?? ''), numFloors: num(row.numfloors),
    landmark: String(row.landmark ?? ''), historicDistrict: String(row.histdist ?? ''),
    ownerName: String(row.ownername ?? ''), yearBuilt: num(row.yearbuilt), lat, lng,
    unusedSqft, estValueUsd: Math.round(unusedSqft * ppsf),
  };
}

export const PLUTO_SELECT = 'bbl,address,borough,zipcode,lotarea,bldgarea,residfar,commfar,facilfar,zonedist1,spdist1,numfloors,landmark,histdist,ownername,yearbuilt,latitude,longitude,bldgclass,landuse';
