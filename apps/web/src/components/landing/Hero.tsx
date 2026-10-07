"use client";

import { motion } from "framer-motion";
import { ArrowRight, Building2 } from "lucide-react";
import { AirMapLazy } from "@/components/map/AirMapLazy";
import { toMapParcels } from "@/components/map/toMapParcels";
import { Button } from "@/components/ui/Button";
import { useParcels } from "@/lib/hooks/useParcels";
import { useMemo } from "react";

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  const { data } = useParcels();
  const parcels = useMemo(() => toMapParcels(data?.parcels ?? [], data?.pending ?? []), [data]);
  return (
    <section className="relative h-[100svh] min-h-[640px] w-full overflow-hidden">
      <div className="absolute inset-0">
        <AirMapLazy parcels={parcels} interactive={false} showPopups={false} view={{ zoom: 15.4, pitch: 62, bearing: -24 }} />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg/80 via-bg/30 to-bg" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-bg/70 via-transparent to-transparent" />

      <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-end px-4 pb-20 pt-28 sm:px-6 md:justify-center md:pb-0">
        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-fg-muted backdrop-blur">
          <Building2 className="size-3.5 text-cyan" /> NYC air rights · Solana devnet
        </motion.p>
        <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.05, ease }} className="max-w-3xl text-[44px] font-semibold leading-[0.98] tracking-[-0.04em] sm:text-6xl md:text-7xl">
          <span className="text-gradient">Trade the sky</span>
          <br />
          above New York.
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15, ease }} className="mt-6 max-w-xl text-base leading-relaxed text-fg-muted sm:text-lg">
          Unused development rights, verified against the city&apos;s own records by Chainlink CRE, minted as Metaplex Core assets and settled on Solana in under a second.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.25, ease }} className="mt-8 flex flex-wrap items-center gap-3">
          <Button href="/explore" size="lg" iconRight={<ArrowRight className="size-4" />}>
            Explore parcels
          </Button>
          <Button href="/list" size="lg" variant="secondary">
            List your air rights
          </Button>
        </motion.div>
      </div>

      <div className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-fg-faint md:flex">
        <span className="h-px w-8 bg-white/15" /> Midtown Manhattan <span className="h-px w-8 bg-white/15" />
      </div>
    </section>
  );
}
