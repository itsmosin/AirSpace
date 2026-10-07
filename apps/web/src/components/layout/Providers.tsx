"use client";

import { useEffect, type ReactNode } from "react";
import { Buffer } from "buffer";
import { ToastProvider } from "@/components/ui/Toast";
import { WalletProvider } from "@/components/wallet/WalletProvider";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof window !== "undefined" && !(window as unknown as { Buffer?: unknown }).Buffer) {
      (window as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
    }
  }, []);
  return (
    <ToastProvider>
      <WalletProvider>{children}</WalletProvider>
    </ToastProvider>
  );
}
