"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin } from "lucide-react";
import { BOROUGH_NAME } from "@airspace/shared";
import { AirMapLazy } from "@/components/map/AirMapLazy";
import { toMapParcels } from "@/components/map/toMapParcels";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FarBar } from "@/components/ui/FarBar";
import { Mono } from "@/components/ui/Mono";
import { Panel } from "@/components/ui/Panel";
import { Skeleton } from "@/components/ui/Skeleton";
import { Stat } from "@/components/ui/Stat";
import { Terminal } from "@/components/ui/Terminal";
import { useParcel } from "@/lib/hooks/useParcels";
import { usePluto } from "@/lib/hooks/usePluto";
import { useVerifyStatus } from "@/lib/hooks/useVerify";
import { explorerAddress, formatCompactUsd, formatNumber, formatUsd } from "@/lib/utils";
import { BuyPanel } from "./BuyPanel";
import { CoreAssetPanel } from "./CoreAssetPanel";
import { OwnerActions } from "./OwnerActions";
import { PlutoFacts } from "./PlutoFacts";
import { VerdictBadge } from "./VerdictBadge";
import { VerificationPanel } from "./VerificationPanel";

export function ParcelDetail({ bbl }: { bbl: string }) {
  const { parcel, pending, registry, loading, refresh, data } = useParcel(bbl);
  const pluto = usePluto(bbl);
  const verdictPending = !parcel && (!pending || pending.status === 0);
  const verify = useVerifyStatus(bbl, { intervalMs: verdictPending ? 4000 : 30000 });
  const verdict = verify.data?.verdict ?? parcel?.verdict ?? pending ?? null;
  const lot = pluto.data?.lot ?? null;
  const job = verify.data?.job ?? null;

  const unusedSqft = parcel?.unusedSqft ?? verdict?.unusedSqft ?? lot?.unusedSqft ?? 0;
  const estValue = parcel?.estValueUsd ?? verdict?.estValueUsd ?? lot?.estValueUsd ?? 0;
  const address = parcel?.address ?? lot?.address ?? `BBL ${bbl}`;
  const borough = parcel ? BOROUGH_NAME[parcel.boroughCode] : lot ? BOROUGH_NAME[lot.borough] : "New York";
  const zoning = parcel?.zoning ?? lot?.zoning ?? "";
  const lotArea = parcel?.lotAreaSqft ?? lot?.lotAreaSqft ?? 0;
  const builtArea = parcel?.builtAreaSqft ?? lot?.builtAreaSqft ?? 0;
  const maxFar = parcel?.maxFar ?? lot?.maxFar ?? 0;
  const usedFar = lotArea > 0 ? builtArea / lotArea : 0;

  const mapParcels = useMemo(() => {
    if (parcel) return toMapParcels([parcel]);
    if (lot) return toMapParcels([], [{ ...(verdict ?? { pda: "", bbl, status: 0, confidenceBps: 0, flags: 0, unusedSqft: lot.unusedSqft, estValueUsd: lot.estValueUsd, reportHash: "", source: 0, requester: "", requestedAt: 0, recordedAt: 0 }), lot: { address: lot.address, borough: lot.borough, lat: lot.lat, lng: lot.lng, numFloors: lot.numFloors, lotAreaSqft: lot.lotAreaSqft, unusedSqft: lot.unusedSqft, estValueUsd: lot.estValueUsd, zoning: lot.zoning } }]);
    return [];
  }, [parcel, lot, verdict, bbl]);
  const center = parcel ? { lng: parcel.lng, lat: parcel.lat } : lot ? { lng: lot.lng, lat: lot.lat } : null;
  const initialLoading = loading && !data && pluto.loading;
  const notFound = !loading && !parcel && !pluto.loading && !lot && !verdict;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-24 pb-16 sm:px-6">
      <Link href="/explore" className="inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> Back to explore
      </Link>

      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <VerdictBadge verdict={verdict} listed={!!parcel?.listing} />
            {parcel ? <Badge tone="neutral">Minted</Badge> : null}
            {parcel?.listing ? <Badge tone="cyan">{formatUsd(parcel.listing.priceUsdCents / 100)}</Badge> : null}
          </div>
          {initialLoading ? <Skeleton className="mt-3 h-10 w-80" /> : <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl md:text-5xl">{address}</h1>}
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
            <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" /> {borough}{zoning ? ` · ${zoning}` : ""}</span>
            <span className="font-mono text-xs">BBL {bbl}</span>
            {parcel ? <Mono value={parcel.pda} href={explorerAddress(parcel.pda)} className="text-xs text-fg-muted" /> : null}
          </p>
        </div>
        {!parcel && verdict?.status === 1 ? (
          <Button href="/list" size="sm">Mint these rights</Button>
        ) : !parcel && !verdict ? (
          <Button href="/list" size="sm" variant="secondary">Request verification</Button>
        ) : null}
      </motion.header>

      {notFound ? (
        <Panel className="mt-8 p-8 text-center">
          <p className="text-lg font-semibold">We could not find this lot</p>
          <p className="mt-1 text-sm text-fg-muted">No on-chain parcel, verdict or PLUTO record matched BBL {bbl}.</p>
        </Panel>
      ) : null}

      <div className="mt-8 grid gap-4 md:grid-cols-[1fr_1fr] lg:grid-cols-[2fr_1fr]">
        <Panel className="grid grid-cols-2 gap-6 p-6 sm:grid-cols-4">
          <Stat label="Unused" value={<>{formatNumber(unusedSqft)} <span className="text-sm font-normal text-fg-muted">sq ft</span></>} loading={initialLoading} />
          <Stat label="Est. value" value={formatCompactUsd(estValue)} hint={estValue ? formatUsd(estValue) : undefined} loading={initialLoading} />
          <Stat label="Lot area" value={<>{formatNumber(lotArea)} <span className="text-sm font-normal text-fg-muted">sq ft</span></>} loading={initialLoading} />
          <Stat label="Built area" value={<>{formatNumber(builtArea)} <span className="text-sm font-normal text-fg-muted">sq ft</span></>} loading={initialLoading} />
          <div className="col-span-2 sm:col-span-4">
            <FarBar used={usedFar} allowed={maxFar} />
          </div>
        </Panel>
        <div className="relative min-h-[220px] overflow-hidden rounded-2xl border border-white/10">
          <AirMapLazy parcels={mapParcels} selected={center ? bbl : null} interactive showPopups={false} placeholderCompact view={center ? { ...center, zoom: 16.2 } : undefined} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <VerificationPanel verdict={verdict} loading={verify.loading && !verify.data && loading} txSignature={job?.txSignature} />
          {job && (job.status === "running" || job.status === "queued" || (job.status === "failed" && verdict?.status === 0)) ? (
            <Terminal text={job.log} live={job.status === "running" || job.status === "queued"} title={`cre · job ${job.id} · ${job.status}`} />
          ) : null}
          <PlutoFacts lot={lot} loading={pluto.loading && !lot} />
        </div>
        <div className="flex flex-col gap-4">
          <CoreAssetPanel assetAddress={parcel?.coreAsset ?? null} owner={parcel?.owner} />
          {parcel ? <OwnerActions parcel={parcel} registry={registry} onDone={refresh} /> : null}
          {parcel ? <BuyPanel parcel={parcel} registry={registry} onDone={refresh} /> : null}
        </div>
      </div>
    </div>
  );
}
