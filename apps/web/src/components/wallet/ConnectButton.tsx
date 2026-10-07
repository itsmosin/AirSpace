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
        className="glass inline-flex h-9 items-center gap-2 rounded-full pl-1.5 pr-3 text-sm transition-colors hover:bg-white/10"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {wallet?.adapter.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={wallet.adapter.icon} alt="" className="size-6 rounded-full" />
        ) : (
          <span className="flex size-6 items-center justify-center rounded-full bg-cyan/15 text-cyan"><Wallet className="size-3.5" /></span>
        )}
        <span className="font-mono text-[13px] tracking-tight">{shortAddress(address)}</span>
        <ChevronDown className={cn("size-3.5 text-fg-muted transition-transform", open && "rotate-180")} />
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
              className="glass-strong absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl p-1 shadow-2xl"
              role="menu"
            >
              <div className="px-3 py-2">
                <p className="text-[11px] uppercase tracking-widest text-fg-faint">{wallet?.adapter.name ?? "Wallet"} · devnet</p>
                <p className="mt-0.5 truncate font-mono text-xs text-fg">{address}</p>
              </div>
              <button
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-fg hover:bg-white/5"
                onClick={async () => {
                  try { await navigator.clipboard.writeText(address); } catch { /* ignore */ }
                  setOpen(false);
                }}
              >
                <Copy className="size-4 text-fg-muted" /> Copy address
              </button>
              <button
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose hover:bg-rose/10"
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
