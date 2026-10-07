"use client";

import { useMemo, useState } from "react";
import { Filter, RefreshCw, Search } from "lucide-react";
import { BOROUGH_NAME, type Borough } from "@airspace/shared";
import { AirMapLazy } from "@/components/map/AirMapLazy";
import { toMapParcels } from "@/components/map/toMapParcels";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Input";
import { Eyebrow } from "@/components/ui/Panel";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { useParcels } from "@/lib/hooks/useParcels";
import { cn, formatNumber, timeAgo } from "@/lib/utils";
import { presentVerdict } from "@/lib/verdict";
import { ParcelCard } from "./ParcelCard";
import Link from "next/link";

export function ExploreView() {
  const { data, loading, error, refresh } = useParcels({ intervalMs: 20000 });
  const [selected, setSelected] = useState<string | null>(null);
  const [listedOnly, setListedOnly] = useState(false);
  const [borough, setBorough] = useState<"" | Borough>("");
  const [minSqft, setMinSqft] = useState("");
  const [query, setQuery] = useState("");

  const parcels = useMemo(() => {
    const min = Number(minSqft) || 0;
    const q = query.trim().toLowerCase();
    return (data?.parcels ?? []).filter((p) => (!listedOnly || p.listing) && (!borough || p.boroughCode === borough) && p.unusedSqft >= min && (!q || p.address.toLowerCase().includes(q) || p.bbl.includes(q)));
  }, [data, listedOnly, borough, minSqft, query]);

  const mapParcels = useMemo(() => toMapParcels(parcels, data?.pending ?? []), [parcels, data]);
  const pending = data?.pending ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 pt-24 sm:px-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Eyebrow>Marketplace</Eyebrow>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Explore verified air rights</h1>
          <p className="mt-2 text-sm text-fg-muted">
            {data ? `${data.parcels.length} minted · ${data.stats.listed} listed · ${pending.length} in verification` : "Loading on-chain parcels…"}
            {data?.updatedAt ? <span className="text-fg-faint"> · updated {timeAgo(Math.floor(data.updatedAt / 1000))}</span> : null}
          </p>
        </div>
        <Button variant="ghost" size="sm" icon={<RefreshCw className={cn("size-3.5", loading && "animate-spin")} />} onClick={() => void fetch("/api/parcels?refresh=1").then(() => refresh())}>
          Refresh
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="order-2 lg:order-1 lg:sticky lg:top-24 lg:self-start">
          <div className="relative h-[52vh] min-h-[360px] overflow-hidden rounded-3xl border border-white/10 lg:h-[calc(100vh-7.5rem)]">
            <AirMapLazy parcels={mapParcels} selected={selected} onSelect={setSelected} />
            <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-2">
              <Legend color="#22d3ee" label="Verified / listed" />
              <Legend color="#8b5cf6" label="Pending verification" />
            </div>
          </div>
        </div>

        <div className="order-1 flex flex-col gap-4 lg:order-2">
          <div className="glass rounded-2xl p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-fg-muted"><Filter className="size-3.5" /> Filters</div>
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-faint" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Address or BBL" className="pl-10" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select value={borough} onChange={(e) => setBorough(e.target.value as "" | Borough)} aria-label="Borough">
                <option value="">All boroughs</option>
                {(Object.keys(BOROUGH_NAME) as Borough[]).map((b) => (
                  <option key={b} value={b}>{BOROUGH_NAME[b]}</option>
                ))}
              </Select>
              <Input type="number" inputMode="numeric" min={0} step={1000} value={minSqft} onChange={(e) => setMinSqft(e.target.value)} placeholder="Min unused sq ft" />
            </div>
            <label className="mt-3 flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm">
              <span className="text-fg">Listed only</span>
              <button type="button" role="switch" aria-checked={listedOnly} onClick={() => setListedOnly((v) => !v)} className={cn("relative h-6 w-11 rounded-full transition-colors", listedOnly ? "bg-cyan" : "bg-white/10")}>
                <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-all", listedOnly ? "left-[22px]" : "left-0.5")} />
              </button>
            </label>
          </div>

          <div className="flex flex-col gap-3">
            {loading && !data ? (
              <>
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </>
            ) : parcels.length === 0 ? (
              <EmptyState
                title={data?.parcels.length ? "No parcels match these filters" : "No parcels minted yet"}
                description={error ? `Could not reach the program: ${error}` : data?.parcels.length ? "Try widening the borough or lowering the minimum size." : "Be the first: verify a lot and mint its unused development rights."}
                action={<Button href="/list" size="sm">List air rights</Button>}
              />
            ) : (
              parcels.map((p, i) => <ParcelCard key={p.bbl} parcel={p} index={i} selected={selected === p.bbl} onSelect={setSelected} />)
            )}
          </div>

          {pending.length ? (
            <div className="mt-2">
              <Eyebrow className="mb-3">In verification</Eyebrow>
              <ul className="flex flex-col gap-2">
                {pending.map((v) => {
                  const pr = presentVerdict(v);
                  return (
                    <li key={v.bbl}>
                      <Link href={`/parcel/${v.bbl}`} onClick={() => setSelected(v.bbl)} className={cn("glass flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm transition hover:border-white/20", selected === v.bbl && "ring-glow-violet")}>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-fg">{v.lot?.address ?? `BBL ${v.bbl}`}</p>
                          <p className="font-mono text-[11px] text-fg-faint">BBL {v.bbl}{v.lot ? ` · ${formatNumber(v.lot.unusedSqft)} sq ft unused` : ""}</p>
                        </div>
                        <Badge tone={pr.tone} dot={pr.dot}>{pr.label}</Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="glass-strong inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] text-fg-muted">
      <span className="size-2 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}` }} /> {label}
    </span>
  );
}
