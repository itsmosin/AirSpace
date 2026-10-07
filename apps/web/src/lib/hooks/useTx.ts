"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { describeError } from "@/lib/errors";
import { explorerTx } from "@/lib/utils";

/** Runs an async action, surfaces errors as toasts and tracks a busy flag. */
export function useAction() {
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, opts: { success?: string; successDescription?: string; tx?: (r: T) => string | undefined; error?: string } = {}): Promise<T | null> => {
      setBusy(true);
      try {
        const r = await fn();
        const sig = opts.tx?.(r);
        if (opts.success) push({ title: opts.success, description: opts.successDescription, variant: "success", href: sig ? explorerTx(sig) : undefined });
        return r;
      } catch (e) {
        push({ title: opts.error ?? "Something went wrong", description: describeError(e), variant: "error" });
        return null;
      } finally {
        setBusy(false);
      }
    },
    [push],
  );
  return { run, busy };
}

export async function refreshParcelsCache() {
  try {
    await fetch("/api/parcels?refresh=1", { cache: "no-store" });
  } catch {
    // ignore
  }
}
