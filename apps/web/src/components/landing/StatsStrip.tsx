"use client";

import { motion } from "framer-motion";
import { Stat } from "@/components/ui/Stat";
import { useParcels } from "@/lib/hooks/useParcels";
import { formatCompact, formatCompactUsd, formatNumber } from "@/lib/utils";

export function StatsStrip() {
  const { data, loading } = useParcels();
  const s = data?.stats;
  const items = [
    { label: "Parcels verified", value: s ? formatNumber(s.parcelsVerified) : "—", hint: "Allow verdicts on-chain" },
    { label: "Sq ft tokenized", value: s ? formatCompact(s.sqftTokenized) : "—", hint: "Unused floor area minted" },
    { label: "Total value", value: s ? formatCompactUsd(s.totalValueUsd) : "—", hint: "Estimated at mint" },
    { label: "Live listings", value: s ? formatNumber(s.listed) : "—", hint: "Priced in USD, paid in SOL" },
  ];
  return (
    <section className="relative z-10 mx-auto -mt-10 max-w-7xl px-4 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="glass-strong grid grid-cols-2 gap-6 rounded-3xl p-6 sm:p-8 md:grid-cols-4">
        {items.map((it) => (
          <Stat key={it.label} label={it.label} value={it.value} hint={it.hint} loading={loading && !data} size="lg" />
        ))}
      </motion.div>
      {data?.error ? <p className="mt-3 text-center text-xs text-fg-faint">Live stats partially unavailable: {data.error}</p> : null}
    </section>
  );
}
