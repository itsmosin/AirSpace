"use client";

import { useConnection } from "@solana/wallet-adapter-react";
import { fetchSolUsd, type SolPrice } from "@/lib/pyth";
import { usePoll } from "./usePoll";

export function useSolPrice(maxAgeSecs = 3600) {
  const { connection } = useConnection();
  return usePoll<SolPrice>("pyth:sol-usd", () => fetchSolUsd(connection, maxAgeSecs), { intervalMs: 20000, staleMs: 5000 });
}
