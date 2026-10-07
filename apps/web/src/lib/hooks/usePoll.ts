"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type PollState<T> = { data: T | null; error: string | null; loading: boolean; refresh: () => Promise<void>; updatedAt: number };

/** Generic polling fetcher with a shared in-memory cache keyed by `key`. */
const cache = new Map<string, { data: unknown; at: number }>();

export function usePoll<T>(key: string | null, fetcher: () => Promise<T>, opts: { intervalMs?: number; enabled?: boolean; staleMs?: number } = {}): PollState<T> {
  const { intervalMs = 0, enabled = true, staleMs = 0 } = opts;
  const cached = key ? (cache.get(key) as { data: T; at: number } | undefined) : undefined;
  const [data, setData] = useState<T | null>(cached?.data ?? null);
  const [updatedAt, setUpdatedAt] = useState(cached?.at ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!cached);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    if (!key || !enabled) return;
    try {
      const d = await fetcherRef.current();
      if (!alive.current) return;
      cache.set(key, { data: d, at: Date.now() });
      setData(d);
      setUpdatedAt(Date.now());
      setError(null);
    } catch (e) {
      if (!alive.current) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [key, enabled]);

  useEffect(() => {
    alive.current = true;
    if (!key || !enabled) {
      setLoading(false);
      return;
    }
    const c = cache.get(key) as { data: T; at: number } | undefined;
    if (c && staleMs > 0 && Date.now() - c.at < staleMs) {
      setData(c.data);
      setUpdatedAt(c.at);
      setLoading(false);
    } else {
      void refresh();
    }
    if (intervalMs > 0) {
      const id = setInterval(() => void refresh(), intervalMs);
      return () => {
        alive.current = false;
        clearInterval(id);
      };
    }
    return () => {
      alive.current = false;
    };
  }, [key, enabled, intervalMs, staleMs, refresh]);

  return { data, error, loading, refresh, updatedAt };
}
