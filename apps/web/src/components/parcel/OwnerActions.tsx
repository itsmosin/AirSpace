"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { Tag, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { cancelListingIx, listParcelIx } from "@/lib/airspace/instructions";
import type { ParcelRecord, RegistryView } from "@/lib/airspace/types";
import { useAirspaceProgram } from "@/lib/hooks/useProgram";
import { refreshParcelsCache, useAction } from "@/lib/hooks/useTx";
import { formatUsd } from "@/lib/utils";

export function OwnerActions({ parcel, registry, onDone, compact }: { parcel: ParcelRecord; registry: RegistryView | null; onDone?: () => void; compact?: boolean }) {
  const { program, publicKey } = useAirspaceProgram();
  const { run, busy } = useAction();
  const [price, setPrice] = useState(String(Math.max(1, Math.round(parcel.estValueUsd))));
  const listed = !!parcel.listing;
  const isOwner = !!publicKey && publicKey.toBase58() === parcel.owner;
  if (!isOwner) return null;
  const collection = registry ? new PublicKey(registry.collection) : null;

  const list = async () => {
    if (!publicKey || !collection) return;
    const usd = Number(price);
    if (!Number.isFinite(usd) || usd <= 0) return;
    const sig = await run(
      () => listParcelIx(program, { seller: publicKey, bbl: parcel.bbl, asset: new PublicKey(parcel.coreAsset), collection, priceUsdCents: BigInt(Math.round(usd * 100)) }).rpc(),
      { success: "Listed for sale", successDescription: `${parcel.address} at ${formatUsd(usd)}. The asset is held in escrow until it sells or you cancel.`, tx: (s) => s, error: "Listing failed" },
    );
    if (sig) {
      await refreshParcelsCache();
      onDone?.();
    }
  };

  const cancel = async () => {
    if (!publicKey || !collection) return;
    const sig = await run(
      () => cancelListingIx(program, { seller: publicKey, bbl: parcel.bbl, asset: new PublicKey(parcel.coreAsset), collection }).rpc(),
      { success: "Listing cancelled", successDescription: "The asset is back in your wallet.", tx: (s) => s, error: "Cancel failed" },
    );
    if (sig) {
      await refreshParcelsCache();
      onDone?.();
    }
  };

  const body = listed ? (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[14px] text-fg-muted">
        Listed at <span className="font-semibold text-fg">{formatUsd(parcel.listing!.priceUsdCents / 100, true)}</span>. Buyers pay the SOL equivalent at the live Pyth price.
      </p>
      <Button variant="danger" size="sm" icon={<XCircle className="size-4" />} loading={busy} onClick={cancel}>
        Cancel listing
      </Button>
    </div>
  ) : (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Label hint={`Estimated value ${formatUsd(parcel.estValueUsd)}`}>Asking price (USD)</Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[14px] text-fg-faint">$</span>
          <Input type="number" min={1} step={1000} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="pl-8" />
        </div>
      </div>
      <Button icon={<Tag className="size-4" />} loading={busy} onClick={list} disabled={!collection}>
        List for sale
      </Button>
    </div>
  );

  if (compact) return body;
  return (
    <Panel>
      <PanelHeader title="Owner actions" subtitle={listed ? "This parcel is in escrow" : "Set a USD price and move the asset into escrow"} />
      <div className="px-6 py-5">{body}</div>
    </Panel>
  );
}
