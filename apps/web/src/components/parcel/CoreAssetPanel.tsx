"use client";

import { useEffect, useState } from "react";
import { Layers } from "lucide-react";
import { Mono } from "@/components/ui/Mono";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Skeleton } from "@/components/ui/Skeleton";
import { ExplorerLink } from "@/components/parcel/VerificationPanel";
import { fetchCoreAsset, type CoreAssetView } from "@/lib/umi";
import { explorerAddress } from "@/lib/utils";

export function CoreAssetPanel({ assetAddress, owner, className }: { assetAddress: string | null; owner?: string; className?: string }) {
  const [asset, setAsset] = useState<CoreAssetView | null>(null);
  const [loading, setLoading] = useState(!!assetAddress);

  useEffect(() => {
    let alive = true;
    if (!assetAddress) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchCoreAsset(assetAddress).then((a) => {
      if (!alive) return;
      setAsset(a);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [assetAddress]);

  return (
    <Panel className={className}>
      <PanelHeader title="Core asset" subtitle="Metaplex Core NFT with on-chain attributes and 5% royalties" right={assetAddress ? <ExplorerLink href={explorerAddress(assetAddress)}>Explorer</ExplorerLink> : null} />
      <div className="px-5 py-5">
        {!assetAddress ? (
          <div className="flex items-start gap-3 text-sm text-fg-muted">
            <Layers className="mt-0.5 size-4 text-fg-faint" />
            <p>Not minted yet. Once the verdict is Allow, the owner can mint these rights as a Core asset.</p>
          </div>
        ) : loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[11px] uppercase tracking-[0.14em] text-fg-faint">Asset</dt>
                <dd><Mono value={assetAddress} href={explorerAddress(assetAddress)} /></dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.14em] text-fg-faint">Holder</dt>
                <dd>{asset?.owner ?? owner ? <Mono value={asset?.owner ?? owner!} href={explorerAddress(asset?.owner ?? owner!)} /> : "—"}</dd>
              </div>
              {asset?.collection ? (
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.14em] text-fg-faint">Collection</dt>
                  <dd><Mono value={asset.collection} href={explorerAddress(asset.collection)} /></dd>
                </div>
              ) : null}
              {asset ? (
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.14em] text-fg-faint">Name</dt>
                  <dd className="truncate text-fg">{asset.name}</dd>
                </div>
              ) : null}
            </dl>
            {asset ? (
              asset.attributes.length ? (
                <div className="overflow-hidden rounded-xl border border-white/10">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-white/5">
                      {asset.attributes.map((a) => (
                        <tr key={a.key}>
                          <td className="whitespace-nowrap px-3 py-2 font-mono text-fg-muted">{a.key}</td>
                          <td className="max-w-0 truncate px-3 py-2 text-right font-mono text-fg" title={a.value}>{a.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-fg-muted">No attributes plugin found on this asset.</p>
              )
            ) : (
              <p className="text-xs text-fg-muted">Asset account not readable from this RPC yet. It may still be confirming.</p>
            )}
            {asset?.uri ? (
              <p className="text-xs text-fg-muted">
                Metadata: <a href={asset.uri} target="_blank" rel="noreferrer" className="font-mono text-cyan hover:underline">{asset.uri}</a>
              </p>
            ) : null}
          </div>
        )}
      </div>
    </Panel>
  );
}
