"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Github } from "lucide-react";
import { Wordmark } from "@/components/brand/Logo";
import { IconButton } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { cn } from "@/lib/utils";

const links = [
  { href: "/explore", label: "Explore" },
  { href: "/list", label: "List air rights" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/activity", label: "Activity" },
];

function PillNav({ pathname, layoutId, className }: { pathname: string; layoutId: string; className?: string }) {
  return (
    <nav className={cn("flex items-center gap-1 rounded-full p-1", className)} aria-label="Primary">
      {links.map((l) => {
        const active = pathname === l.href || pathname.startsWith(l.href + "/");
        return (
          <Link key={l.href} href={l.href} className={cn("relative shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors", active ? "text-fg" : "text-fg-muted hover:text-fg")}>
            {active ? <motion.span layoutId={layoutId} className="absolute inset-0 rounded-full bg-fill" transition={{ type: "spring", stiffness: 500, damping: 40 }} /> : null}
            <span className="relative">{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/70 backdrop-blur-xl transition-colors duration-300">
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Wordmark />
        <PillNav pathname={pathname} layoutId="nav-pill" className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:flex" />
        <div className="flex items-center gap-2">
          <IconButton href="https://github.com/itsmosin/AirSpace" external label="AirSpace on GitHub" className="hidden sm:inline-flex">
            <Github className="size-4" />
          </IconButton>
          <ThemeToggle />
          <ConnectButton />
        </div>
      </div>
      <div className="no-scrollbar overflow-x-auto border-t border-line px-3 py-1.5 md:hidden">
        <PillNav pathname={pathname} layoutId="nav-pill-mobile" className="w-max" />
      </div>
    </header>
  );
}
