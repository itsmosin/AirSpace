export type MapParcelState = "listed" | "verified" | "pending" | "denied";

export type MapParcel = {
  bbl: string;
  address: string;
  lat: number;
  lng: number;
  numFloors: number;
  lotAreaSqft: number;
  unusedSqft: number;
  estValueUsd: number;
  state: MapParcelState;
  priceUsd?: number;
  maxFar?: number;
  owner?: string;
};

export type MapView = { lng: number; lat: number; zoom: number; pitch: number; bearing: number };
