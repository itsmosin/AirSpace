"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Wordmark } from "@/components/brand/Logo";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { cn } from "@/lib/utils";

const links = [
  { href: "/explore", label: "Explore" },
  { href: "/list", label: "List air rights" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/activity", label: "Activity" },
];

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="glass-strong flex h-12 w-full items-center justify-between rounded-full pl-4 pr-2">
          <Wordmark />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {links.map((l) => {
              const active = pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href));
              return (
                <Link key={l.href} href={l.href} className={cn("relative rounded-full px-3.5 py-1.5 text-[13px] transition-colors", active ? "text-fg" : "text-fg-muted hover:text-fg")}>
                  {active ? <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-white/8" transition={{ type: "spring", stiffness: 500, damping: 40 }} /> : null}
                  <span className="relative">{l.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-fg-muted lg:inline-flex">
              <span className="size-1.5 rounded-full bg-emerald" /> devnet
            </span>
            <ConnectButton />
            <button className="rounded-full p-2 text-fg-muted hover:bg-white/5 hover:text-fg md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {open ? (
          <motion.nav
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass-strong mx-4 mt-2 rounded-2xl p-2 md:hidden"
            aria-label="Mobile"
          >
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className={cn("block rounded-xl px-4 py-3 text-sm", pathname.startsWith(l.href) ? "bg-white/8 text-fg" : "text-fg-muted hover:bg-white/5 hover:text-fg")}>
                {l.label}
              </Link>
            ))}
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
