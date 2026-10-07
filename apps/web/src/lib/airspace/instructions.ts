// Typed instruction builders. Every helper returns an Anchor MethodsBuilder so callers can
// `.rpc()`, `.transaction()` or `.instruction()` as needed. Account lists follow docs/INTERFACES.md section 1.
import { BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { MPL_CORE_PROGRAM_ID, PYTH_SOL_USD_PRICE_ACCOUNT } from "@airspace/shared";
import type { AirspaceProgram } from "./program";
import { escrowPda, listingPda, parcelPda, registryPda, verdictPda } from "./pdas";

export const MPL_CORE = new PublicKey(MPL_CORE_PROGRAM_ID);
export const PYTH_PRICE_UPDATE = new PublicKey(PYTH_SOL_USD_PRICE_ACCOUNT);

export type MintParcelArgs = {
  address: string;
  borough: number;
  latE6: number;
  lngE6: number;
  lotAreaSqft: number;
  builtAreaSqft: number;
  maxFarBps: number;
  zoning: string;
  name: string;
  uri: string;
};

type Methods = Record<string, (...args: unknown[]) => MethodsBuilder>;
export type MethodsBuilder = {
  accountsPartial: (accounts: Record<string, PublicKey>) => MethodsBuilder;
  signers: (signers: Keypair[]) => MethodsBuilder;
  rpc: (opts?: unknown) => Promise<string>;
  transaction: () => Promise<import("@solana/web3.js").Transaction>;
  instruction: () => Promise<import("@solana/web3.js").TransactionInstruction>;
};
const methods = (program: AirspaceProgram) => program.methods as unknown as Methods;

export function initializeRegistryIx(
  program: AirspaceProgram,
  p: { admin: PublicKey; registrar: PublicKey; treasury: PublicKey; forwarderProgram: PublicKey; feeBps: number; maxPriceAgeSecs: number },
) {
  return methods(program)
    .initializeRegistry(p.registrar, p.treasury, p.forwarderProgram, p.feeBps, p.maxPriceAgeSecs)
    .accountsPartial({ admin: p.admin, registry: registryPda(program.programId), systemProgram: SystemProgram.programId });
}

export function setAttestationConfigIx(
  program: AirspaceProgram,
  p: { admin: PublicKey; ownerCredential: PublicKey; ownerSchema: PublicKey; kycCredential: PublicKey; kycSchema: PublicKey },
) {
  return methods(program)
    .setAttestationConfig(p.ownerCredential, p.ownerSchema, p.kycCredential, p.kycSchema)
    .accountsPartial({ admin: p.admin, registry: registryPda(program.programId) });
}

export function createCollectionIx(program: AirspaceProgram, p: { admin: PublicKey; collection: Keypair; name: string; uri: string }) {
  return methods(program)
    .createCollection(p.name, p.uri)
    .accountsPartial({
      admin: p.admin, registry: registryPda(program.programId), collection: p.collection.publicKey,
      mplCoreProgram: MPL_CORE, systemProgram: SystemProgram.programId,
    })
    .signers([p.collection]);
}

export function openVerdictIx(program: AirspaceProgram, p: { payer: PublicKey; bbl: string }) {
  return methods(program)
    .openVerdict(p.bbl)
    .accountsPartial({
      payer: p.payer,
      verdict: verdictPda(p.bbl, program.programId),
      systemProgram: SystemProgram.programId,
      // Parcel PDA for the BBL; only its existence is inspected (VerdictLocked guard).
      parcel: parcelPda(p.bbl, program.programId),
    });
}

export function setForwarderIx(program: AirspaceProgram, p: { admin: PublicKey; forwarderProgram: PublicKey }) {
  return methods(program).setForwarder(p.forwarderProgram).accountsPartial({ admin: p.admin, registry: registryPda(program.programId) });
}

export function onReportIx(
  program: AirspaceProgram,
  p: { state: PublicKey; forwarderAuthority: PublicKey; bbl: string; metadata: Buffer; report: Buffer },
) {
  return methods(program)
    .onReport(p.metadata, p.report)
    .accountsPartial({ state: p.state, forwarderAuthority: p.forwarderAuthority, registry: registryPda(program.programId), verdict: verdictPda(p.bbl, program.programId) });
}

export function recordVerdictManualIx(
  program: AirspaceProgram,
  p: { registrar: PublicKey; bbl: string; status: number; confidenceBps: number; flags: number; unusedSqft: bigint; estValueUsd: bigint; reportHash: Uint8Array },
) {
  return methods(program)
    .recordVerdictManual(p.status, p.confidenceBps, p.flags, new BN(p.unusedSqft.toString()), new BN(p.estValueUsd.toString()), Array.from(p.reportHash))
    .accountsPartial({ registrar: p.registrar, registry: registryPda(program.programId), verdict: verdictPda(p.bbl, program.programId) });
}

export function mintParcelIx(
  program: AirspaceProgram,
  p: { owner: PublicKey; bbl: string; ownerAttestation: PublicKey; asset: Keypair; collection: PublicKey; args: MintParcelArgs },
) {
  return methods(program)
    .mintParcel(p.args)
    .accountsPartial({
      owner: p.owner,
      registry: registryPda(program.programId),
      verdict: verdictPda(p.bbl, program.programId),
      ownerAttestation: p.ownerAttestation,
      parcel: parcelPda(p.bbl, program.programId),
      asset: p.asset.publicKey,
      collection: p.collection,
      mplCoreProgram: MPL_CORE,
      systemProgram: SystemProgram.programId,
    })
    .signers([p.asset]);
}

export function listParcelIx(
  program: AirspaceProgram,
  p: { seller: PublicKey; bbl: string; asset: PublicKey; collection: PublicKey; priceUsdCents: bigint },
) {
  const parcel = parcelPda(p.bbl, program.programId);
  return methods(program)
    .listParcel(new BN(p.priceUsdCents.toString()))
    .accountsPartial({
      seller: p.seller,
      registry: registryPda(program.programId),
      parcel,
      listing: listingPda(parcel, program.programId),
      asset: p.asset,
      collection: p.collection,
      escrow: escrowPda(program.programId),
      mplCoreProgram: MPL_CORE,
      systemProgram: SystemProgram.programId,
    });
}

export function cancelListingIx(program: AirspaceProgram, p: { seller: PublicKey; bbl: string; asset: PublicKey; collection: PublicKey }) {
  const parcel = parcelPda(p.bbl, program.programId);
  return methods(program)
    .cancelListing()
    .accountsPartial({
      seller: p.seller,
      parcel,
      listing: listingPda(parcel, program.programId),
      asset: p.asset,
      collection: p.collection,
      escrow: escrowPda(program.programId),
      mplCoreProgram: MPL_CORE,
      systemProgram: SystemProgram.programId,
    });
}

export function buyParcelIx(
  program: AirspaceProgram,
  p: { buyer: PublicKey; bbl: string; seller: PublicKey; treasury: PublicKey; buyerAttestation: PublicKey; asset: PublicKey; collection: PublicKey; priceUpdate?: PublicKey },
) {
  const parcel = parcelPda(p.bbl, program.programId);
  return methods(program)
    .buyParcel()
    .accountsPartial({
      buyer: p.buyer,
      registry: registryPda(program.programId),
      parcel,
      listing: listingPda(parcel, program.programId),
      seller: p.seller,
      treasury: p.treasury,
      buyerAttestation: p.buyerAttestation,
      priceUpdate: p.priceUpdate ?? PYTH_PRICE_UPDATE,
      asset: p.asset,
      collection: p.collection,
      escrow: escrowPda(program.programId),
      mplCoreProgram: MPL_CORE,
      systemProgram: SystemProgram.programId,
    });
}
