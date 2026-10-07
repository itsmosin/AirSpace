"use client";

import { useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { fetchAttestationInfo, kycAttestationPda, ownerAttestationPda, type AttestationInfo } from "@/lib/attestation";
import type { RegistryView } from "@/lib/airspace/types";
import { usePoll } from "./usePoll";

const isSet = (k?: string) => !!k && k !== PublicKey.default.toBase58();

export function useKycAttestation(registry: RegistryView | null, wallet: PublicKey | null) {
  const { connection } = useConnection();
  const ready = !!registry && !!wallet && isSet(registry.kycCredential) && isSet(registry.kycSchema);
  const pda = ready ? kycAttestationPda(new PublicKey(registry!.kycCredential), new PublicKey(registry!.kycSchema), wallet!) : null;
  const fetcher = useCallback(async () => (pda ? fetchAttestationInfo(connection, pda) : null), [connection, pda]);
  const state = usePoll<AttestationInfo | null>(pda ? `kyc:${pda.toBase58()}` : null, fetcher, { intervalMs: 15000 });
  return { ...state, pda, configured: ready, hasKyc: !!state.data && !state.data.expired };
}

export function useOwnerAttestation(registry: RegistryView | null, wallet: PublicKey | null, bbl: string | null) {
  const { connection } = useConnection();
  const ready = !!registry && !!wallet && !!bbl && isSet(registry.ownerCredential) && isSet(registry.ownerSchema);
  const pda = ready ? ownerAttestationPda(new PublicKey(registry!.ownerCredential), new PublicKey(registry!.ownerSchema), wallet!, bbl!) : null;
  const fetcher = useCallback(async () => (pda ? fetchAttestationInfo(connection, pda) : null), [connection, pda]);
  const state = usePoll<AttestationInfo | null>(pda ? `owner:${pda.toBase58()}` : null, fetcher, { intervalMs: 15000 });
  return { ...state, pda, configured: ready, hasAttestation: !!state.data && !state.data.expired };
}
