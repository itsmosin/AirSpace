"use client";

import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { AlertCircle, BadgeCheck, ShoppingBag, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Mono } from "@/components/ui/Mono";
import { Note, Panel, PanelHeader } from "@/components/ui/Panel";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { buyParcelIx } from "@/lib/airspace/instructions";
import type { ParcelRecord, RegistryView } from "@/lib/airspace/types";
import { postJson } from "@/lib/fetch";
import { useKycAttestation } from "@/lib/hooks/useAttestation";
import { useAirspaceProgram } from "@/lib/hooks/useProgram";
import { useSolPrice } from "@/lib/hooks/useSolPrice";
import { refreshParcelsCache, useAction } from "@/lib/hooks/useTx";
import { usdCentsToLamports } from "@/lib/pyth";
import { explorerAddress, explorerTx, formatSol, formatUsd, timeAgo } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

export function BuyPanel({ parcel, registry, onDone }: { parcel: ParcelRecord; registry: RegistryView | null; onDone?: () => void }) {
  const { publicKey } = useWallet();
  const { program } = useAirspaceProgram();
  const price = useSolPrice(registry?.maxPriceAgeSecs ?? 3600);
  const kyc = useKycAttestation(registry, publicKey);
  const { run, busy } = useAction();
  const { push } = useToast();

  const listing = parcel.listing;
  const isSeller = !!publicKey && listing?.seller === publicKey.toBase58();
  const cents = listing ? BigInt(listing.priceUsdCents) : 0n;
  const lamports = price.data && listing ? usdCentsToLamports(cents, price.data.price, price.data.exponent) : null;
  const fee = registry && lamports !== null ? (lamports * BigInt(registry.feeBps)) / 10000n : null;

  const verifyIdentity = async () => {
    if (!publicKey) return;
    const res = await run(() => postJson<{ attestation: string; txSignature: string; alreadyExisted?: boolean }>("/api/kyc", { wallet: publicKey.toBase58(), level: 1 }), {
      success: "Identity verified",
      successDescription: "A KYC attestation was issued to your wallet by the AirSpace registrar.",
      tx: (r) => r.txSignature || undefined,
      error: "Identity verification failed",
    });
    if (res) await kyc.refresh();
  };

  const buy = async () => {
    if (!publicKey || !listing || !registry || !kyc.pda) return;
    const sig = await run(
      () =>
        buyParcelIx(program, {
          buyer: publicKey,
          bbl: parcel.bbl,
          seller: new PublicKey(listing.seller),
          treasury: new PublicKey(registry.treasury),
          buyerAttestation: kyc.pda!,
          asset: new PublicKey(parcel.coreAsset),
          collection: new PublicKey(registry.collection),
        }).rpc(),
      { success: "Purchase settled", successDescription: `${parcel.address} is now in your wallet.`, tx: (s) => s, error: "Purchase failed" },
    );
    if (sig) {
      push({ title: "Transaction confirmed", description: sig, variant: "info", href: explorerTx(sig) });
      await refreshParcelsCache();
      onDone?.();
    }
  };

  return (
    <Panel id="buy" className="scroll-mt-28">
      <PanelHeader title="Buy these air rights" subtitle="Priced in USD, settled in SOL at the live Pyth SOL/USD price" />
      <div className="space-y-5 px-6 py-5">
        {!listing ? (
          <NegativeState icon={<AlertCircle className="size-4 text-fg-muted" />} title="Not listed" body="The owner has not put these rights up for sale. Check back later or explore other parcels." />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-[12px] text-fg-faint">Ask</p>
                <p className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-fg">{formatUsd(Number(cents) / 100, true)}</p>
              </div>
              <div>
                <p className="text-[12px] text-fg-faint">SOL / USD</p>
                {price.data ? (
                  <p className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-fg">${price.data.priceUsd.toFixed(2)}</p>
                ) : price.error ? (
                  <p className="mt-1 text-[14px] text-red-ink">unavailable</p>
                ) : (
                  <Skeleton className="mt-2 h-7 w-20" />
                )}
                <p className="mt-0.5 text-[12px] text-fg-faint">
                  {price.data ? (
                    <>
                      Pyth · {timeAgo(price.data.publishTime)}{price.data.stale ? <span className="text-orange-ink"> · stale</span> : null}
                    </>
                  ) : (
                    "Pyth price update"
                  )}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-fg-faint">You pay</p>
                {lamports !== null ? <p className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-green-ink">{formatSol(lamports)}</p> : <Skeleton className="mt-2 h-7 w-24" />}
                {fee !== null ? <p className="mt-0.5 text-[12px] text-fg-faint">incl. {registry!.feeBps / 100}% fee ({formatSol(fee)})</p> : null}
              </div>
            </div>

            <div className="text-[12px] text-fg-faint">
              Seller <Mono value={listing.seller} href={explorerAddress(listing.seller)} className="text-[12px]" /> · price account <Mono value={price.data?.account ?? ""} href={price.data ? explorerAddress(price.data.account) : undefined} className="text-[12px]" copy={false} />
            </div>

            {!publicKey ? (
              <Note className="flex flex-col items-start gap-3">
                <p className="text-[14px] text-fg-muted">Connect a wallet to buy.</p>
                <ConnectButton size="md" />
              </Note>
            ) : isSeller ? (
              <NegativeState icon={<AlertCircle className="size-4 text-fg-muted" />} title="This is your listing" body="You cannot buy your own parcel. Cancel the listing from the owner panel to take it off the market." />
            ) : !registry || !kyc.configured ? (
              <NegativeState icon={<AlertCircle className="size-4 text-orange-ink" />} title="Attestations not configured" body="The registry has no KYC credential/schema set yet. Run the SAS setup script and set_attestation_config." />
            ) : kyc.loading ? (
              <Skeleton className="h-11 w-full" />
            ) : !kyc.hasKyc ? (
              <div className="flex flex-col gap-3 rounded-2xl bg-orange/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <UserCheck className="mt-0.5 size-4 shrink-0 text-orange-ink" />
                  <div>
                    <p className="text-[14px] font-medium text-fg">Identity verification required</p>
                    <p className="mt-0.5 text-[13px] text-fg-muted">Buyers need a KYC attestation from the AirSpace registrar. This is a one-time, on-chain credential for your wallet.</p>
                  </div>
                </div>
                <Button size="sm" variant="secondary" loading={busy} onClick={verifyIdentity} icon={<BadgeCheck className="size-4" />}>
                  Verify identity
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-[13px] font-medium text-green-ink">
                  <BadgeCheck className="size-4" /> KYC attestation present <Mono value={kyc.pda!.toBase58()} href={explorerAddress(kyc.pda!.toBase58())} className="text-[12px] text-green-ink" copy={false} />
                </div>
                <Button size="lg" loading={busy} onClick={buy} disabled={lamports === null || !!price.data?.stale} icon={<ShoppingBag className="size-4" />}>
                  {lamports !== null ? `Buy for ${formatSol(lamports)}` : "Buy"}
                </Button>
                {price.data?.stale ? <p className="text-[13px] text-orange-ink">The Pyth price is older than the registry allows ({registry!.maxPriceAgeSecs}s). The program would reject the purchase.</p> : null}
              </div>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}

function NegativeState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <Note className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-[14px] font-medium text-fg">{title}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">{body}</p>
      </div>
    </Note>
  );
}
