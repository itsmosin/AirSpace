"use client";

import { fetchJson } from "@/lib/fetch";
import type { VerdictView, VerifyJob } from "@/lib/airspace/types";
import { usePoll } from "./usePoll";

export type VerifyStatus = { job: (VerifyJob & { log: string }) | null; verdict: VerdictView | null };

export function useVerifyStatus(bbl: string | null, opts: { intervalMs?: number; enabled?: boolean } = {}) {
  return usePoll<VerifyStatus>(bbl ? `verify:${bbl}` : null, () => fetchJson<VerifyStatus>(`/api/verify/${bbl}`), { intervalMs: opts.intervalMs ?? 4000, enabled: opts.enabled ?? true });
}
