"use client";

import type { PlutoLot } from "@airspace/shared";
import { fetchJson } from "@/lib/fetch";
import { usePoll } from "./usePoll";

export function usePluto(bbl: string | null) {
  return usePoll<{ lot: PlutoLot }>(bbl ? `pluto:${bbl}` : null, () => fetchJson<{ lot: PlutoLot }>(`/api/pluto?bbl=${bbl}`), { staleMs: 10 * 60 * 1000 });
}
