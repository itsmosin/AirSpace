import type { Borough } from "@airspace/shared";

export type VerdictStatusCode = 0 | 1 | 2 | 3;
export type VerdictSource = 0 | 1; // 0 Registrar (manual), 1 Chainlink CRE (forwarder)

export type RegistryView = {
  pda: string;
  admin: string;
  registrar: string;
  treasury: string;
  forwarderProgram: string;
  collection: string;
  ownerCredential: string;
  ownerSchema: string;
  kycCredential: string;
  kycSchema: string;
  feeBps: number;
  maxPriceAgeSecs: number;
  parcelCount: number;
};

export type VerdictView = {
  pda: string;
  bbl: string;
  status: VerdictStatusCode;
  confidenceBps: number;
  flags: number;
  unusedSqft: number;
  estValueUsd: number;
  reportHash: string; // hex
  source: VerdictSource;
  requester: string;
  requestedAt: number;
  recordedAt: number;
};

export type ParcelView = {
  pda: string;
  bbl: string;
  owner: string;
  coreAsset: string;
  address: string;
  borough: number;
  boroughCode: Borough;
  lat: number;
  lng: number;
  lotAreaSqft: number;
  builtAreaSqft: number;
  maxFar: number;
  unusedSqft: number;
  estValueUsd: number;
  zoning: string;
  verdictHash: string; // hex
  status: 0 | 1; // Minted, Listed
  mintedAt: number;
};

export type ListingView = {
  pda: string;
  parcel: string;
  seller: string;
  priceUsdCents: number;
  createdAt: number;
};

export type ParcelRecord = ParcelView & { listing: ListingView | null; verdict: VerdictView | null };

export type PendingLot = {
  address: string;
  borough: Borough;
  lat: number;
  lng: number;
  numFloors: number;
  lotAreaSqft: number;
  unusedSqft: number;
  estValueUsd: number;
  zoning: string;
};

export type PendingRecord = VerdictView & { lot: PendingLot | null };

export type ParcelsStats = {
  parcelsVerified: number;
  parcelsMinted: number;
  listed: number;
  sqftTokenized: number;
  totalValueUsd: number;
};

export type ParcelsResponse = {
  programId: string;
  registry: RegistryView | null;
  parcels: ParcelRecord[];
  pending: PendingRecord[];
  stats: ParcelsStats;
  updatedAt: number;
  error?: string;
};

export type JobStatus = "queued" | "running" | "done" | "failed";
export type VerifyJob = {
  id: string;
  bbl: string;
  wallet: string;
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
  openVerdictTx?: string;
  txSignature?: string;
  explorerUrl?: string;
  error?: string;
  exitCode?: number | null;
};
