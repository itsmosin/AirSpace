"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, MapPin } from "lucide-react";
import { BOROUGH_NAME } from "@airspace/shared";
import { Button } from "@/components/ui/Button";
import type { ParcelRecord } from "@/lib/airspace/types";
import { cn, formatCompactUsd, formatNumber, formatUsd } from "@/lib/utils";
import { VerdictBadge } from "./VerdictBadge";

export function ParcelCard({ parcel, selected, onSelect, index = 0 }: { parcel: ParcelRecord; selected?: boolean; onSelect?: (bbl: string) => void; index?: number }) {
  const listed = !!parcel.listing;
  const price = listed ? parcel.listing!.priceUsdCents / 100 : null;
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      onClick={() => onSelect?.(parcel.bbl)}
      className={cn(
        "group glass relative cursor-pointer rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]",
        selected && "ring-glow-cyan border-cyan/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold tracking-tight text-fg">{parcel.address || "Unknown address"}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-muted">
            <MapPin className="size-3" /> {BOROUGH_NAME[parcel.boroughCode]} · {parcel.zoning || "—"} · <span className="font-mono">BBL {parcel.bbl}</span>
          </p>
        </div>
        <VerdictBadge verdict={parcel.verdict} listed={listed} />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-fg-faint">Unused</p>
          <p className="mt-0.5 text-sm font-semibold text-fg">{formatNumber(parcel.unusedSqft)} <span className="text-xs font-normal text-fg-muted">sq ft</span></p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-fg-faint">Est. value</p>
          <p className="mt-0.5 text-sm font-semibold text-fg">{formatCompactUsd(parcel.estValueUsd)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-fg-faint">{listed ? "Ask" : "Status"}</p>
          <p className={cn("mt-0.5 text-sm font-semibold", listed ? "text-cyan" : "text-fg-muted")}>{listed ? formatUsd(price!) : "Not listed"}</p>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2">
        <Button href={`/parcel/${parcel.bbl}`} variant="secondary" size="sm" iconRight={<ArrowUpRight className="size-3.5" />} onClick={(e) => e.stopPropagation()}>
          Details
        </Button>
        {listed ? (
          <Link href={`/parcel/${parcel.bbl}#buy`} onClick={(e) => e.stopPropagation()} className="inline-flex h-9 items-center rounded-full bg-cyan px-4 text-[13px] font-medium text-[#06202a] transition hover:brightness-110">
            Buy
          </Link>
        ) : null}
        <span className="ml-auto font-mono text-[11px] text-fg-faint">FAR {parcel.maxFar.toFixed(1)}</span>
      </div>
    </motion.article>
  );
}
