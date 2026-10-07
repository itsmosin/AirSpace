"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Copy, LogOut, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn, shortAddress } from "@/lib/utils";

export function ConnectButton({ size = "sm", className, label = "Connect wallet" }: { size?: "sm" | "md" | "lg"; className?: string; label?: string }) {
  const { publicKey, wallet, connecting, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [open, setOpen] = useState(false);

  if (!publicKey) {
    return (
      <Button size={size} variant="primary" loading={connecting} onClick={() => setVisible(true)} icon={<Wallet className="size-4" />} className={className}>
        {connecting ? "Connecting" : label}
      </Button>
    );
  }

  const address = publicKey.toBase58();
  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 items-center gap-2 rounded-full bg-fg pl-1.5 pr-3 text-[13px] text-bg transition-opacity hover:opacity-90"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {wallet?.adapter.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={wallet.adapter.icon} alt="" className="size-6 rounded-full" />
        ) : (
          <span className="flex size-6 items-center justify-center rounded-full bg-bg/20"><Wallet className="size-3.5" /></span>
        )}
        <span className="font-mono tracking-tight">{shortAddress(address)}</span>
        <ChevronDown className={cn("size-3.5 opacity-70 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open ? (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-pop"
              role="menu"
            >
              <div className="px-3 py-2">
                <p className="text-[12px] text-fg-faint">{wallet?.adapter.name ?? "Wallet"} · devnet</p>
                <p className="mt-0.5 truncate font-mono text-[12px] text-fg">{address}</p>
              </div>
              <button
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[14px] text-fg hover:bg-fill"
                onClick={async () => {
                  try { await navigator.clipboard.writeText(address); } catch { /* ignore */ }
                  setOpen(false);
                }}
              >
                <Copy className="size-4 text-fg-muted" /> Copy address
              </button>
              <button
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[14px] text-red-ink hover:bg-red/10"
                onClick={async () => {
                  setOpen(false);
                  await disconnect();
                }}
              >
                <LogOut className="size-4" /> Disconnect
              </button>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
