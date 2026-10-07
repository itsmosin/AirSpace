"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Briefcase, Layers } from "lucide-react";
import { BOROUGH_NAME } from "@airspace/shared";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Mono } from "@/components/ui/Mono";
import { Eyebrow, Panel } from "@/components/ui/Panel";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { Stat } from "@/components/ui/Stat";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { useParcels } from "@/lib/hooks/useParcels";
import { fetchCoreAssetsByOwner, type CoreAssetView } from "@/lib/umi";
import { explorerAddress, formatCompactUsd, formatNumber, formatUsd } from "@/lib/utils";
import { OwnerActions } from "./OwnerActions";
import { VerdictBadge } from "./VerdictBadge";

export function PortfolioView() {
  const { publicKey } = useWallet();
  const { data, loading, refresh } = useParcels({ intervalMs: 15000 });
  const [assets, setAssets] = useState<CoreAssetView[] | null>(null);
  const owner = publicKey?.toBase58() ?? null;

  const mine = useMemo(() => (data?.parcels ?? []).filter((p) => p.owner === owner), [data, owner]);

  useEffect(() => {
    let alive = true;
    if (!owner) {
      setAssets(null);
      return;
    }
    fetchCoreAssetsByOwner(owner).then((a) => alive && setAssets(a));
    return () => {
      alive = false;
    };
  }, [owner, data?.updatedAt]);

  const collection = data?.registry?.collection;
  const coreInCollection = (assets ?? []).filter((a) => !collection || a.collection === collection);
  const unmatched = coreInCollection.filter((a) => !mine.some((p) => p.coreAsset === a.address));
  const totalValue = mine.reduce((s, p) => s + p.estValueUsd, 0);
  const totalSqft = mine.reduce((s, p) => s + p.unusedSqft, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-24 pb-16 sm:px-6">
      <Eyebrow>Portfolio</Eyebrow>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Your air rights</h1>

      {!publicKey ? (
        <EmptyState className="mt-8" icon={<Briefcase className="size-5" />} title="Connect a wallet" description="Your minted parcels, listings and Core assets will appear here." action={<ConnectButton size="md" />} />
      ) : (
        <>
          <Panel className="mt-6 grid grid-cols-2 gap-6 p-6 md:grid-cols-4">
            <Stat label="Parcels" value={formatNumber(mine.length)} loading={loading && !data} />
            <Stat label="Listed" value={formatNumber(mine.filter((p) => p.listing).length)} loading={loading && !data} />
            <Stat label="Unused sq ft" value={formatNumber(totalSqft)} loading={loading && !data} />
            <Stat label="Est. value" value={formatCompactUsd(totalValue)} loading={loading && !data} />
          </Panel>

          <div className="mt-6 grid gap-4">
            {loading && !data ? (
              <>
                <CardSkeleton />
                <CardSkeleton />
              </>
            ) : mine.length === 0 ? (
              <EmptyState icon={<Layers className="size-5" />} title="No parcels in this wallet" description="Verify a building you own and mint its unused development rights." action={<Button href="/list" size="sm">List air rights</Button>} />
            ) : (
              mine.map((p) => (
                <Panel key={p.bbl} className="p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/parcel/${p.bbl}`} className="text-lg font-semibold tracking-tight hover:text-cyan">{p.address}</Link>
                        <VerdictBadge verdict={p.verdict} listed={!!p.listing} />
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">{BOROUGH_NAME[p.boroughCode]} · {p.zoning} · <span className="font-mono">BBL {p.bbl}</span></p>
                      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                        <span><span className="text-fg-faint">Unused</span> <span className="font-medium">{formatNumber(p.unusedSqft)} sq ft</span></span>
                        <span><span className="text-fg-faint">Est.</span> <span className="font-medium">{formatUsd(p.estValueUsd)}</span></span>
                        {p.listing ? <span><span className="text-fg-faint">Ask</span> <span className="font-medium text-cyan">{formatUsd(p.listing.priceUsdCents / 100)}</span></span> : null}
                        <span className="text-xs"><span className="text-fg-faint">Asset</span> <Mono value={p.coreAsset} href={explorerAddress(p.coreAsset)} className="text-xs" /></span>
                      </div>
                    </div>
                    <div className="w-full md:w-[380px]">
                      <OwnerActions parcel={p} registry={data?.registry ?? null} onDone={refresh} compact />
                    </div>
                  </div>
                </Panel>
              ))
            )}
          </div>

          <div className="mt-10">
            <Eyebrow>Core assets cross-check</Eyebrow>
            <p className="mt-2 text-sm text-fg-muted">
              {assets === null ? "Reading Core assets held by this wallet…" : `${coreInCollection.length} Core asset${coreInCollection.length === 1 ? "" : "s"} from the AirSpace collection held directly by this wallet (listed parcels sit in escrow).`}
            </p>
            {unmatched.length ? (
              <ul className="mt-3 flex flex-col gap-2">
                {unmatched.map((a) => (
                  <li key={a.address} className="glass flex items-center justify-between rounded-xl px-4 py-3 text-sm">
                    <span className="truncate">{a.name || "Core asset"}</span>
                    <Mono value={a.address} href={explorerAddress(a.address)} />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
