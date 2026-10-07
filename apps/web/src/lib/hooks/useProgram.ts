"use client";

import { useMemo } from "react";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getProgram, getReadonlyProgram, makeProvider } from "@/lib/airspace/program";

/** Anchor program bound to the connected wallet (or read-only when disconnected). */
export function useAirspaceProgram() {
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();
  const { publicKey, connected } = useWallet();
  const program = useMemo(() => {
    if (anchorWallet) return getProgram(makeProvider(connection, anchorWallet));
    return getReadonlyProgram(connection);
  }, [connection, anchorWallet]);
  return { program, connection, publicKey, connected, canSign: !!anchorWallet };
}
