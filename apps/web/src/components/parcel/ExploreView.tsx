"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw, Search } from "lucide-react";
import { BOROUGH_NAME, type Borough } from "@airspace/shared";
import { AirMapLazy } from "@/components/map/AirMapLazy";
import { toMapParcels } from "@/components/map/toMapParcels";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Segmented } from "@/components/ui/Input";
import { Eyebrow } from "@/components/ui/Panel";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { useParcels } from "@/lib/hooks/useParcels";
import { cn, formatNumber, timeAgo } from "@/lib/utils";
import { presentVerdict } from "@/lib/verdict";
import { ParcelCard } from "./ParcelCard";

type Status = "all" | "listed" | "verified" | "pending";
const STATUS: Array<{ value: Status; label: string }> = [
  { value: "all", label: "All" },
  { value: "listed", label: "Listed" },
  { value: "verified", label: "Verified" },
  { value: "pending", label: "Pending" },
];
const BOROUGHS: Array<{ value: "" | Borough; label: string }> = [{ value: "", label: "All boroughs" }, ...(Object.keys(BOROUGH_NAME) as Borough[]).map((b) => ({ value: b, label: BOROUGH_NAME[b] }))];

export function ExploreView() {
  const { data, loading, error, refresh } = useParcels({ intervalMs: 20000 });
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("all");
  const [borough, setBorough] = useState<"" | Borough>("");
  const [minSqft, setMinSqft] = useState("");
  const [query, setQuery] = useState("");

  const parcels = useMemo(() => {
    if (status === "pending") return [];
    const min = Number(minSqft) || 0;
    const q = query.trim().toLowerCase();
    return (data?.parcels ?? []).filter((p) => (status !== "listed" || p.listing) && (!borough || p.boroughCode === borough) && p.unusedSqft >= min && (!q || p.address.toLowerCase().includes(q) || p.bbl.includes(q)));
  }, [data, status, borough, minSqft, query]);

  const showPending = status === "all" || status === "pending";
  const pending = useMemo(() => {
    if (!showPending) return [];
    const q = query.trim().toLowerCase();
    return (data?.pending ?? []).filter((v) => !q || v.bbl.includes(q) || (v.lot?.address ?? "").toLowerCase().includes(q));
  }, [data, showPending, query]);
  const mapParcels = useMemo(() => toMapParcels(parcels, pending), [parcels, pending]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6">
      <SectionHeader
        title="Explore verified air rights"
        description={
          <>
            {data ? `${data.parcels.length} minted · ${data.stats.listed} listed · ${data.pending.length} in verification` : "Loading on-chain parcels…"}
            {data?.updatedAt ? <span className="text-fg-faint"> · updated {timeAgo(Math.floor(data.updatedAt / 1000))}</span> : null}
          </>
        }
      />

      <div className="flex flex-col gap-2 rounded-[28px] border border-line bg-surface p-2 shadow-card lg:flex-row lg:flex-wrap lg:items-center">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-fg-faint" />
          <Input pill value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Address or BBL" className="border-transparent bg-fill-2 pl-11 focus:bg-surface" aria-label="Search parcels" />
        </div>
        <Segmented label="Borough" value={borough} onChange={setBorough} options={BOROUGHS} className="shrink-0" />
        <Segmented label="Status" value={status} onChange={setStatus} options={STATUS} className="shrink-0" />
        <Input type="number" inputMode="numeric" min={0} step={1000} value={minSqft} onChange={(e) => setMinSqft(e.target.value)} placeholder="Min sq ft" aria-label="Minimum unused square feet" className="rounded-full border-transparent bg-fill-2 lg:w-28" />
        <IconButton label="Refresh" className="shrink-0 self-end border-transparent bg-fill-2 lg:self-auto" onClick={() => void fetch("/api/parcels?refresh=1").then(() => refresh())}>
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
        </IconButton>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="order-2 lg:order-1 lg:sticky lg:top-24 lg:self-start">
          <div className="relative h-[56vh] min-h-[400px] overflow-hidden rounded-3xl border border-line shadow-card lg:h-[calc(100vh-7.5rem)]">
            <AirMapLazy parcels={mapParcels} selected={selected} onSelect={setSelected} />
          </div>
        </div>

        <div className="order-1 flex flex-col gap-4 lg:order-2">
          <div className="flex flex-col gap-3">
            {loading && !data ? (
              <>
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </>
            ) : parcels.length === 0 && status !== "pending" ? (
              <EmptyState
                title={data?.parcels.length ? "No parcels match these filters" : "No parcels minted yet"}
                description={error ? `Could not reach the program: ${error}` : data?.parcels.length ? "Try widening the borough or lowering the minimum size." : "Be the first: verify a lot and mint its unused development rights."}
                action={<Button href="/list" size="sm">List air rights</Button>}
              />
            ) : (
              parcels.map((p, i) => <ParcelCard key={p.bbl} parcel={p} index={i} selected={selected === p.bbl} onSelect={setSelected} />)
            )}
          </div>

          {showPending ? (
            <div className="mt-2">
              <Eyebrow className="mb-3">In verification</Eyebrow>
              {pending.length === 0 ? (
                <p className="rounded-2xl border border-line bg-surface px-4 py-3 text-[13px] text-fg-muted">No lots are waiting on a verdict right now.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {pending.map((v) => {
                    const pr = presentVerdict(v);
                    return (
                      <li key={v.bbl}>
                        <Link
                          href={`/parcel/${v.bbl}`}
                          onClick={() => setSelected(v.bbl)}
                          className={cn("flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-[14px] shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover", selected === v.bbl && "ring-2 ring-blue/50")}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-fg">{v.lot?.address ?? `BBL ${v.bbl}`}</p>
                            <p className="font-mono text-[12px] text-fg-faint">BBL {v.bbl}{v.lot ? ` · ${formatNumber(v.lot.unusedSqft)} sq ft unused` : ""}</p>
                          </div>
                          <Badge tone={pr.tone} dot={pr.dot}>{pr.label}</Badge>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
