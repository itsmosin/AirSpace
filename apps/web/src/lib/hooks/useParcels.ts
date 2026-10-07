"use client";

import { fetchJson } from "@/lib/fetch";
import type { ParcelsResponse } from "@/lib/airspace/types";
import { usePoll } from "./usePoll";

export function useParcels(opts: { intervalMs?: number } = {}) {
  return usePoll<ParcelsResponse>("parcels", () => fetchJson<ParcelsResponse>("/api/parcels"), { intervalMs: opts.intervalMs ?? 30000, staleMs: 10000 });
}

export function useParcel(bbl: string | null) {
  const state = useParcels({ intervalMs: 15000 });
  const parcel = state.data?.parcels.find((p) => p.bbl === bbl) ?? null;
  const pending = state.data?.pending.find((p) => p.bbl === bbl) ?? null;
  return { ...state, parcel, pending, registry: state.data?.registry ?? null };
}
