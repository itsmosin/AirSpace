"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { AirMapLazy } from "@/components/map/AirMapLazy";
import { toMapParcels } from "@/components/map/toMapParcels";
import { useParcels } from "@/lib/hooks/useParcels";

const ease = [0.22, 1, 0.36, 1] as const;

export function MapCard() {
  const { data } = useParcels();
  const parcels = useMemo(() => toMapParcels(data?.parcels ?? [], data?.pending ?? []), [data]);
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, ease }}
        className="overflow-hidden rounded-3xl border border-line bg-surface shadow-card"
      >
        <div className="flex flex-col gap-3 px-6 pt-6 pb-5 md:flex-row md:items-end md:justify-between md:px-8 md:pt-8">
          <div>
            <h2 className="display text-[28px] font-semibold leading-tight text-fg sm:text-[34px]">See the sky you can buy</h2>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
              Solid blocks are buildings that exist today. The translucent volume above each one is verified, tradable air rights.
            </p>
          </div>
          <div className="flex items-center gap-3 text-[13px] text-fg-faint">
            <span className="inline-flex items-center gap-2 rounded-full bg-green/12 px-3 py-1 text-[12px] font-medium text-green-ink">
              <span className="size-2 animate-pulse rounded-full bg-green" /> Live
            </span>
            {data ? `${data.parcels.length} minted · ${data.stats.listed} listed · ${data.pending.length} in verification` : "Loading on-chain parcels…"}
          </div>
        </div>
        <div className="relative mx-3 mb-3 h-[440px] overflow-hidden rounded-2xl border border-line sm:h-[520px] md:mx-4 md:mb-4 md:h-[600px]">
          <AirMapLazy parcels={parcels} />
        </div>
      </motion.div>
    </section>
  );
}
