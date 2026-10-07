// NYC PLUTO normalisation + air-rights math. Kept local to the workflow so the
// WASM bundle has no workspace imports; the logic matches packages/shared.

export type Borough = 'MN' | 'BX' | 'BK' | 'QN' | 'SI'

export type PlutoLot = {
	bbl: string; address: string; borough: Borough; zipcode: string
	lotAreaSqft: number; builtAreaSqft: number; residFar: number; commFar: number; facilFar: number; maxFar: number
	zoning: string; specialDistrict: string; numFloors: number; landmark: string; historicDistrict: string
	ownerName: string; yearBuilt: number; lat: number; lng: number; unusedSqft: number; estValueUsd: number
	/** $/sqft comparable used for estValueUsd */
	pricePerSqft: number
}

export const FLAGS = {
	LANDMARK: 1, HISTORIC_DISTRICT: 2, NO_UNUSED_FAR: 4, DATA_MISMATCH: 8,
	LOW_CONFIDENCE: 16, SPECIAL_DISTRICT: 32, OWNER_MISMATCH: 64,
} as const

export const PRICE_PER_SQFT = { MN_CORE: 350, MN: 250, BK: 180, QN: 120, BX: 90, SI: 70 } as const

export const PLUTO_SELECT =
	'bbl,address,borough,zipcode,lotarea,bldgarea,residfar,commfar,facilfar,zonedist1,spdist1,numfloors,landmark,histdist,ownername,yearbuilt,latitude,longitude,bldgclass,landuse'

/** Normalise a raw PLUTO Socrata row and compute unused FAR + base estimate. */
export function normalizePluto(row: Record<string, unknown>): PlutoLot {
	const num = (v: unknown) => (v === undefined || v === null || v === '' ? 0 : Number(v))
	const str = (v: unknown) => (v === undefined || v === null ? '' : String(v)).trim()
	const bbl = str(row.bbl).split('.')[0].padStart(10, '0')
	const lotAreaSqft = num(row.lotarea)
	const builtAreaSqft = num(row.bldgarea)
	const residFar = num(row.residfar), commFar = num(row.commfar), facilFar = num(row.facilfar)
	const maxFar = Math.max(residFar, commFar, facilFar)
	const unusedSqft = Math.max(0, Math.floor(maxFar * lotAreaSqft - builtAreaSqft))
	const boroughRaw = str(row.borough).toUpperCase()
	const borough: Borough = (['MN', 'BX', 'BK', 'QN', 'SI'] as const).includes(boroughRaw as Borough)
		? (boroughRaw as Borough)
		: 'MN'
	const lat = num(row.latitude), lng = num(row.longitude)
	const zipcode = str(row.zipcode)
	const core = borough === 'MN' && zipcode.startsWith('100') && lat > 40.7 && lat < 40.8
	const pricePerSqft = borough === 'MN' ? (core ? PRICE_PER_SQFT.MN_CORE : PRICE_PER_SQFT.MN) : PRICE_PER_SQFT[borough]
	return {
		bbl, address: str(row.address), borough, zipcode,
		lotAreaSqft, builtAreaSqft, residFar, commFar, facilFar, maxFar,
		zoning: str(row.zonedist1), specialDistrict: str(row.spdist1), numFloors: num(row.numfloors),
		landmark: str(row.landmark), historicDistrict: str(row.histdist),
		ownerName: str(row.ownername), yearBuilt: num(row.yearbuilt), lat, lng,
		unusedSqft, estValueUsd: Math.round(unusedSqft * pricePerSqft), pricePerSqft,
	}
}
