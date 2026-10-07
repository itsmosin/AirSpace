"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Keypair, PublicKey } from "@solana/web3.js";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BadgeCheck, Building2, Check, ExternalLink, RotateCcw, Search, Sparkles, Wallet } from "lucide-react";
import { BOROUGH_CODE, BOROUGH_NAME, type PlutoLot } from "@airspace/shared";
import { AirMapLazy } from "@/components/map/AirMapLazy";
import { FlagChips } from "@/components/parcel/FlagChips";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FarBar } from "@/components/ui/FarBar";
import { Input, Label } from "@/components/ui/Input";
import { Mono } from "@/components/ui/Mono";
import { Eyebrow, Panel } from "@/components/ui/Panel";
import { Skeleton } from "@/components/ui/Skeleton";
import { Stat } from "@/components/ui/Stat";
import { Steps } from "@/components/ui/Steps";
import { Terminal } from "@/components/ui/Terminal";
import { useToast } from "@/components/ui/Toast";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { listParcelIx, mintParcelIx } from "@/lib/airspace/instructions";
import { parcelPda } from "@/lib/airspace/pdas";
import type { RegistryView } from "@/lib/airspace/types";
import { fetchJson, postJson } from "@/lib/fetch";
import { useKycAttestation, useOwnerAttestation } from "@/lib/hooks/useAttestation";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { useParcels } from "@/lib/hooks/useParcels";
import { useAirspaceProgram } from "@/lib/hooks/useProgram";
import { refreshParcelsCache, useAction } from "@/lib/hooks/useTx";
import { useVerifyStatus } from "@/lib/hooks/useVerify";
import { assetName } from "@/lib/metadata";
import { cn, explorerAddress, explorerTx, formatNumber, formatUsd, isBbl, titleCase } from "@/lib/utils";
import { presentVerdict } from "@/lib/verdict";

const STEPS = ["Connect", "Identity", "Building", "Verify", "Mint", "List"];

type WizardState = {
  step: number;
  wallet?: string;
  kyc?: { attestation: string; txSignature: string };
  lot?: PlutoLot;
  ownerName?: string;
  ownerAttestation?: { attestation: string; txSignature: string };
  verify?: { jobId: string; openVerdictTx?: string; requestedAt: number };
  mint?: { asset: string; txSignature: string; parcel: string };
  listing?: { priceUsd: number; txSignature: string };
};

const INITIAL: WizardState = { step: 0 };
const STORAGE_KEY = "airspace:list-wizard:v1";
const ease = [0.22, 1, 0.36, 1] as const;

export function ListWizard() {
  const [state, setState, { hydrated, reset }] = useLocalStorage<WizardState>(STORAGE_KEY, INITIAL);
  const { publicKey } = useWallet();
  const { data: parcelsData } = useParcels({ intervalMs: 20000 });
  const registry = parcelsData?.registry ?? null;
  const patch = (p: Partial<WizardState>) => setState((s) => ({ ...s, ...p }));
  const goto = (step: number) => patch({ step });

  // Wallet switch invalidates wallet-bound steps.
  useEffect(() => {
    if (!hydrated || !publicKey) return;
    const w = publicKey.toBase58();
    if (state.wallet && state.wallet !== w && state.step > 0 && !state.mint) {
      setState({ step: 1, wallet: w, lot: state.lot, ownerName: state.ownerName });
    }
  }, [publicKey, hydrated, state.wallet, state.step, state.mint, state.lot, state.ownerName, setState]);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-28 sm:px-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-6 h-64 w-full rounded-3xl" />
      </div>
    );
  }

  const done = state.step >= STEPS.length;

  return (
    <div className="mx-auto max-w-3xl px-4 pt-24 pb-20 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Eyebrow>List air rights</Eyebrow>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Turn unused floor area into a tradable asset.</h1>
        </div>
        {state.step > 0 ? (
          <Button variant="ghost" size="sm" icon={<RotateCcw className="size-3.5" />} onClick={reset}>Start over</Button>
        ) : null}
      </div>

      <div className="mt-8">
        <Steps steps={STEPS} current={Math.min(state.step, STEPS.length)} onSelect={(i) => (!state.mint || i >= 4) && goto(i)} />
      </div>

      {!registry && parcelsData ? (
        <p className="mt-4 rounded-xl border border-amber/25 bg-amber/5 px-4 py-3 text-xs text-amber">
          The AirSpace registry is not initialized on this cluster yet. Minting and listing will fail until the program is set up.
        </p>
      ) : null}

      <AnimatePresence mode="wait">
        <motion.div key={state.step} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease }} className="mt-6">
          {done ? (
            <DoneStep state={state} onReset={reset} />
          ) : state.step === 0 ? (
            <ConnectStep onNext={() => patch({ step: 1, wallet: publicKey!.toBase58() })} />
          ) : state.step === 1 ? (
            <IdentityStep registry={registry} state={state} patch={patch} />
          ) : state.step === 2 ? (
            <BuildingStep state={state} patch={patch} />
          ) : state.step === 3 ? (
            <VerifyStep state={state} patch={patch} />
          ) : state.step === 4 ? (
            <MintStep state={state} patch={patch} registry={registry} />
          ) : (
            <ListStep state={state} patch={patch} registry={registry} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function StepCard({ title, subtitle, children, icon }: { title: string; subtitle?: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <Panel className="p-6 sm:p-8">
      <div className="flex items-start gap-4">
        {icon ? <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-cyan">{icon}</div> : null}
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm leading-relaxed text-fg-muted">{subtitle}</p> : null}
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </Panel>
  );
}

// ---- 1. Connect ----
function ConnectStep({ onNext }: { onNext: () => void }) {
  const { publicKey } = useWallet();
  return (
    <StepCard icon={<Wallet className="size-5" />} title="Connect your wallet" subtitle="The wallet you connect becomes the owner of record for the minted asset and receives sale proceeds. Use a devnet wallet with some SOL.">
      <div className="flex flex-wrap items-center gap-3">
        <ConnectButton size="md" label="Connect Phantom or Solflare" />
        {publicKey ? (
          <Button onClick={onNext} iconRight={<ArrowRight className="size-4" />}>
            Continue as {publicKey.toBase58().slice(0, 4)}…{publicKey.toBase58().slice(-4)}
          </Button>
        ) : null}
      </div>
    </StepCard>
  );
}

// ---- 2. Identity ----
function IdentityStep({ registry, state, patch }: { registry: RegistryView | null; state: WizardState; patch: (p: Partial<WizardState>) => void }) {
  const { publicKey } = useWallet();
  const kyc = useKycAttestation(registry ?? null, publicKey);
  const { run, busy } = useAction();
  const has = kyc.hasKyc || !!state.kyc;

  const verify = async () => {
    if (!publicKey) return;
    const res = await run(() => postJson<{ attestation: string; txSignature: string }>("/api/kyc", { wallet: publicKey.toBase58(), level: 1 }), {
      success: "Identity verified", successDescription: "KYC attestation issued by the AirSpace registrar.", tx: (r) => r.txSignature || undefined, error: "Verification failed",
    });
    if (res) {
      patch({ kyc: { attestation: res.attestation, txSignature: res.txSignature } });
      await kyc.refresh();
    }
  };

  return (
    <StepCard icon={<BadgeCheck className="size-5" />} title="Verify your identity" subtitle="AirSpace issues a Solana Attestation Service credential to your wallet. The program checks it when you buy; sellers get it now so the same wallet can trade later.">
      {has ? (
        <AttestationBadge label="KYC attestation" pda={state.kyc?.attestation ?? kyc.pda?.toBase58() ?? ""} tx={state.kyc?.txSignature} />
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-fg-muted">
          No KYC attestation found for <span className="font-mono text-fg">{publicKey?.toBase58().slice(0, 8)}…</span>. In this demo the registrar issues it instantly; a production flow would run a real identity check first.
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        {!has ? <Button loading={busy} onClick={verify} icon={<BadgeCheck className="size-4" />}>Verify identity</Button> : null}
        <Button variant={has ? "primary" : "secondary"} onClick={() => patch({ step: 2 })} iconRight={<ArrowRight className="size-4" />}>
          {has ? "Continue" : "Skip for now"}
        </Button>
      </div>
    </StepCard>
  );
}

function AttestationBadge({ label, pda, tx }: { label: string; pda: string; tx?: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-emerald/25 bg-emerald/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-emerald/15 text-emerald"><Check className="size-4" /></span>
        <div>
          <p className="text-sm font-medium text-fg">{label} present</p>
          <p className="text-xs text-fg-muted">Issued by the AirSpace registrar · valid 365 days</p>
        </div>
      </div>
      <div className="flex flex-col items-start gap-1 text-xs sm:items-end">
        {pda ? <Mono value={pda} href={explorerAddress(pda)} /> : null}
        {tx ? <a href={explorerTx(tx)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan hover:underline">issuance tx <ExternalLink className="size-3" /></a> : null}
      </div>
    </div>
  );
}

// ---- 3. Building ----
function BuildingStep({ state, patch }: { state: WizardState; patch: (p: Partial<WizardState>) => void }) {
  const { publicKey } = useWallet();
  const [mode, setMode] = useState<"address" | "bbl">(state.lot ? "bbl" : "address");
  const [query, setQuery] = useState(state.lot ? state.lot.bbl : "");
  const [ownerName, setOwnerName] = useState(state.ownerName ?? "");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const { run, busy } = useAction();
  const lot = state.lot ?? null;

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    try {
      const url = mode === "bbl" || isBbl(q) ? `/api/pluto?bbl=${encodeURIComponent(q)}` : `/api/pluto?address=${encodeURIComponent(q)}`;
      const res = await fetchJson<{ lot: PlutoLot }>(url);
      patch({ lot: res.lot, ownerAttestation: undefined, verify: undefined });
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
    }
  };

  const attest = async () => {
    if (!publicKey || !lot) return;
    const res = await run(() => postJson<{ attestation: string; txSignature: string }>("/api/attest-owner", { wallet: publicKey.toBase58(), bbl: lot.bbl }), {
      success: "Ownership attested", successDescription: `Owner attestation for BBL ${lot.bbl} issued to your wallet.`, tx: (r) => r.txSignature || undefined, error: "Attestation failed",
    });
    if (res) patch({ ownerAttestation: { attestation: res.attestation, txSignature: res.txSignature }, ownerName, step: 3 });
  };

  const mapParcels = useMemo(
    () => (lot ? [{ bbl: lot.bbl, address: lot.address, lat: lot.lat, lng: lot.lng, numFloors: lot.numFloors || 1, lotAreaSqft: lot.lotAreaSqft, unusedSqft: lot.unusedSqft, estValueUsd: lot.estValueUsd, state: "pending" as const }] : []),
    [lot],
  );

  return (
    <StepCard icon={<Building2 className="size-5" />} title="Find your building" subtitle="We pull the lot's PLUTO record from NYC Open Data and compute the unused floor area from zoning.">
      <div className="flex gap-1 rounded-full border border-white/10 p-1 text-xs">
        {(["address", "bbl"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={cn("flex-1 rounded-full px-3 py-1.5 transition-colors", mode === m ? "bg-white/10 text-fg" : "text-fg-muted hover:text-fg")}>
            {m === "address" ? "Street address" : "BBL"}
          </button>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-faint" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} mono={mode === "bbl"} placeholder={mode === "bbl" ? "1008350041" : "350 Fifth Avenue, New York"} className="pl-10" />
        </div>
        <Button type="submit" loading={searching} variant="secondary">Look up</Button>
      </form>
      {searchError ? <p className="mt-2 text-xs text-rose">{searchError}</p> : null}
      <p className="mt-2 text-[11px] text-fg-faint">Try BBL 1008350041 (Empire State Building) or 1012970029 (Chrysler Building).</p>

      {lot ? (
        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_220px]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold tracking-tight">{lot.address}</p>
                <p className="text-xs text-fg-muted">{BOROUGH_NAME[lot.borough]} · {lot.zoning || "—"} · <span className="font-mono">BBL {lot.bbl}</span></p>
              </div>
              <Badge tone={lot.unusedSqft > 0 ? "cyan" : "rose"}>{lot.unusedSqft > 0 ? "Has unused FAR" : "No unused FAR"}</Badge>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Unused" value={formatNumber(lot.unusedSqft)} hint="sq ft" size="sm" />
              <Stat label="Estimate" value={formatUsd(lot.estValueUsd)} size="sm" />
              <Stat label="Lot" value={formatNumber(lot.lotAreaSqft)} hint="sq ft" size="sm" />
              <Stat label="Built" value={formatNumber(lot.builtAreaSqft)} hint={`${lot.numFloors} floors`} size="sm" />
            </div>
            <FarBar className="mt-5" used={lot.lotAreaSqft ? lot.builtAreaSqft / lot.lotAreaSqft : 0} allowed={lot.maxFar} />
            <p className="mt-4 text-xs text-fg-muted">Owner of record: <span className="text-fg">{lot.ownerName ? titleCase(lot.ownerName) : "—"}</span>{lot.landmark ? <span className="text-amber"> · landmark</span> : null}{lot.historicDistrict ? <span className="text-amber"> · historic district</span> : null}</p>
          </div>
          <div className="relative min-h-[200px] overflow-hidden rounded-2xl border border-white/10">
            <AirMapLazy parcels={mapParcels} selected={lot.bbl} interactive={false} showPopups={false} placeholderCompact view={{ lng: lot.lng, lat: lot.lat, zoom: 16.3 }} />
          </div>
        </div>
      ) : null}

      {lot ? (
        <div className="mt-6">
          <Label hint="optional, compared with PLUTO by the audit">Your name or entity</Label>
          <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="e.g. ESRT Empire State Building LLC" />
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button loading={busy} onClick={attest} disabled={lot.unusedSqft <= 0} icon={<Check className="size-4" />}>
              This is my building
            </Button>
            {state.ownerAttestation ? <Button variant="secondary" onClick={() => patch({ step: 3, ownerName })} iconRight={<ArrowRight className="size-4" />}>Continue</Button> : null}
            <span className="text-xs text-fg-faint">Issues an owner attestation (mock title check) to your wallet.</span>
          </div>
        </div>
      ) : null}
    </StepCard>
  );
}

// ---- 4. Verify ----
function VerifyStep({ state, patch }: { state: WizardState; patch: (p: Partial<WizardState>) => void }) {
  const { publicKey } = useWallet();
  const lot = state.lot!;
  const { run, busy } = useAction();
  const { push } = useToast();
  const status = useVerifyStatus(lot.bbl, { intervalMs: 4000 });
  const job = status.data?.job ?? null;
  const verdict = status.data?.verdict ?? null;
  const requestedAt = state.verify?.requestedAt ?? 0;
  const fresh = !!verdict && verdict.status !== 0 && (verdict.recordedAt * 1000 >= requestedAt - 60_000 || !requestedAt);
  const pres = presentVerdict(fresh ? verdict : null);
  const running = !!state.verify && !fresh && job?.status !== "failed";

  const request = async () => {
    if (!publicKey) return;
    const res = await run(
      () => postJson<{ jobId: string; openVerdictTx?: string; status: string }>("/api/verify", { bbl: lot.bbl, wallet: publicKey.toBase58(), submitted: { address: lot.address, ownerName: state.ownerName || undefined, lotAreaSqft: lot.lotAreaSqft, builtAreaSqft: lot.builtAreaSqft } }),
      { success: "Verification requested", successDescription: "Verdict account opened on-chain. The Chainlink CRE workflow is now running.", tx: (r) => r.openVerdictTx, error: "Could not start verification" },
    );
    if (res) {
      patch({ verify: { jobId: res.jobId, openVerdictTx: res.openVerdictTx, requestedAt: Date.now() } });
      await status.refresh();
    }
  };

  useEffect(() => {
    if (fresh && verdict?.status === 1 && state.verify) push({ title: "Verdict: Allow", description: `${formatNumber(verdict.unusedSqft)} sq ft verified at ${(verdict.confidenceBps / 100).toFixed(0)}% confidence.`, variant: "success" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fresh, verdict?.status]);

  return (
    <StepCard icon={<Sparkles className="size-5" />} title="Request verification" subtitle="A Chainlink CRE workflow fetches the PLUTO record, audits it confidentially with an LLM, hashes the report and writes the verdict to the AirSpace program through the keystone forwarder.">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={pres.tone} dot={pres.dot || running}>{running ? (job?.status === "running" ? "CRE running" : "Queued") : pres.label}</Badge>
        {state.ownerAttestation ? <span className="text-xs text-fg-muted">owner attestation <Mono value={state.ownerAttestation.attestation} href={explorerAddress(state.ownerAttestation.attestation)} className="text-xs" /></span> : null}
      </div>

      {!state.verify && !fresh ? (
        <div className="mt-6">
          <Button loading={busy} onClick={request} icon={<Sparkles className="size-4" />}>Run Chainlink CRE verification</Button>
          <p className="mt-2 text-xs text-fg-faint">The registrar pays to open the verdict account; the CRE simulation broadcasts the report to devnet. Usually 1-3 minutes.</p>
        </div>
      ) : null}

      {state.verify || job ? (
        <div className="mt-6 space-y-4">
          <Terminal text={job?.log ?? ""} live={running} title={`cre workflow simulate · ${lot.bbl}${job ? ` · ${job.status}` : ""}`} />
          {job?.txSignature ? (
            <p className="text-xs text-fg-muted">Report tx <Mono value={job.txSignature} href={explorerTx(job.txSignature)} chars={8} className="text-xs" /></p>
          ) : null}
          {job?.status === "failed" && !fresh ? (
            <div className="rounded-xl border border-rose/25 bg-rose/5 p-4 text-sm">
              <p className="font-medium text-rose">The CRE run failed{job.error ? `: ${job.error}` : ""}.</p>
              <p className="mt-1 text-xs text-fg-muted">Check the log above. You can retry, or a registrar can record a manual verdict for this BBL.</p>
              <Button className="mt-3" size="sm" variant="secondary" loading={busy} onClick={request}>Retry</Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {fresh && verdict ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold tracking-tight">{pres.label}</p>
              <p className="text-xs text-fg-muted">{pres.description}</p>
            </div>
            <Badge tone={pres.tone}>{verdict.source === 1 ? "Chainlink CRE" : "Registrar"}</Badge>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <Stat label="Unused" value={formatNumber(verdict.unusedSqft)} hint="sq ft" size="sm" />
            <Stat label="Value" value={formatUsd(verdict.estValueUsd)} size="sm" />
            <Stat label="Confidence" value={`${(verdict.confidenceBps / 100).toFixed(0)}%`} size="sm" />
          </div>
          <FlagChips flags={verdict.flags} className="mt-4" />
          <p className="mt-4 text-xs text-fg-muted">report hash <Mono value={verdict.reportHash} chars={8} className="text-xs" /> · verdict <Mono value={verdict.pda} href={explorerAddress(verdict.pda)} className="text-xs" /></p>
          <div className="mt-5 flex flex-wrap gap-3">
            {verdict.status === 1 ? (
              <Button onClick={() => patch({ step: 4 })} iconRight={<ArrowRight className="size-4" />}>Continue to mint</Button>
            ) : (
              <>
                <Button variant="secondary" loading={busy} onClick={request}>Request again</Button>
                <Button variant="ghost" onClick={() => patch({ step: 2, verify: undefined })}>Choose another building</Button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </StepCard>
  );
}

// ---- 5. Mint ----
function MintStep({ state, patch, registry }: { state: WizardState; patch: (p: Partial<WizardState>) => void; registry: RegistryView | null }) {
  const { publicKey } = useWallet();
  const { program } = useAirspaceProgram();
  const lot = state.lot!;
  const owner = useOwnerAttestation(registry, publicKey, lot.bbl);
  const { run, busy } = useAction();
  const ownerAttestation = state.ownerAttestation?.attestation ?? owner.pda?.toBase58() ?? null;

  const mint = async () => {
    if (!publicKey || !registry || !ownerAttestation) return;
    const asset = Keypair.generate();
    const origin = window.location.origin;
    const args = {
      address: lot.address.slice(0, 96),
      borough: BOROUGH_CODE[lot.borough],
      latE6: Math.round(lot.lat * 1e6),
      lngE6: Math.round(lot.lng * 1e6),
      lotAreaSqft: Math.round(lot.lotAreaSqft),
      builtAreaSqft: Math.round(lot.builtAreaSqft),
      maxFarBps: Math.round(lot.maxFar * 10000),
      zoning: lot.zoning.slice(0, 16),
      name: assetName(lot.address).slice(0, 32),
      uri: `${origin}/api/metadata/${lot.bbl}`,
    };
    const sig = await run(
      () => mintParcelIx(program, { owner: publicKey, bbl: lot.bbl, ownerAttestation: new PublicKey(ownerAttestation), asset, collection: new PublicKey(registry.collection), args }).rpc(),
      { success: "Air rights minted", successDescription: `${assetName(lot.address)} is now a Core asset in your wallet.`, tx: (s) => s, error: "Mint failed" },
    );
    if (sig) {
      await refreshParcelsCache();
      patch({ mint: { asset: asset.publicKey.toBase58(), txSignature: sig, parcel: parcelPda(lot.bbl).toBase58() }, step: 5 });
    }
  };

  return (
    <StepCard icon={<Building2 className="size-5" />} title="Mint on Solana" subtitle="Creates a Metaplex Core asset inside the AirSpace collection with the verified attributes and a 5% royalty to the treasury, plus the on-chain Parcel account.">
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <Row k="Asset name" v={assetName(lot.address).slice(0, 32)} />
        <Row k="Collection" v={registry ? <Mono value={registry.collection} href={explorerAddress(registry.collection)} /> : "—"} />
        <Row k="Owner attestation" v={ownerAttestation ? <Mono value={ownerAttestation} href={explorerAddress(ownerAttestation)} /> : <span className="text-rose">missing</span>} />
        <Row k="Metadata URI" v={<span className="font-mono text-xs">/api/metadata/{lot.bbl}</span>} />
        <Row k="Attributes" v={`bbl, address, borough, zoning, lot/built area, max FAR, unused sq ft, est. value, verdict hash, lat/lng, verified_by`} full />
      </dl>
      {!owner.hasAttestation && !state.ownerAttestation && owner.configured && !owner.loading ? (
        <p className="mt-4 rounded-xl border border-amber/25 bg-amber/5 px-4 py-3 text-xs text-amber">No owner attestation found on-chain for this wallet and BBL. Go back to step 3 and confirm ownership.</p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button loading={busy} onClick={mint} disabled={!registry || !ownerAttestation} icon={<Sparkles className="size-4" />}>Mint air rights</Button>
        <Button variant="ghost" onClick={() => patch({ step: 3 })}>Back</Button>
      </div>
    </StepCard>
  );
}

// ---- 6. List ----
function ListStep({ state, patch, registry }: { state: WizardState; patch: (p: Partial<WizardState>) => void; registry: RegistryView | null }) {
  const { publicKey } = useWallet();
  const { program } = useAirspaceProgram();
  const { data } = useParcels({ intervalMs: 10000 });
  const lot = state.lot!;
  const parcel = data?.parcels.find((p) => p.bbl === lot.bbl) ?? null;
  const verdictValue = parcel?.estValueUsd ?? lot.estValueUsd;
  const [price, setPrice] = useState(String(Math.max(1, Math.round(verdictValue))));
  const { run, busy } = useAction();
  const asset = state.mint?.asset ?? parcel?.coreAsset ?? null;

  const list = async () => {
    if (!publicKey || !registry || !asset) return;
    const usd = Number(price);
    if (!Number.isFinite(usd) || usd <= 0) return;
    const sig = await run(
      () => listParcelIx(program, { seller: publicKey, bbl: lot.bbl, asset: new PublicKey(asset), collection: new PublicKey(registry.collection), priceUsdCents: BigInt(Math.round(usd * 100)) }).rpc(),
      { success: "Listed for sale", successDescription: `${lot.address} at ${formatUsd(usd)}.`, tx: (s) => s, error: "Listing failed" },
    );
    if (sig) {
      await refreshParcelsCache();
      patch({ listing: { priceUsd: usd, txSignature: sig }, step: 6 });
    }
  };

  return (
    <StepCard icon={<Check className="size-5" />} title="Set a price" subtitle="Prices are quoted in USD. Buyers pay the SOL equivalent at the live Pyth price; a marketplace fee goes to the treasury and the rest to you, atomically.">
      {state.mint ? (
        <div className="mb-5 rounded-xl border border-emerald/25 bg-emerald/5 px-4 py-3 text-xs">
          <span className="text-emerald">Minted</span> · asset <Mono value={state.mint.asset} href={explorerAddress(state.mint.asset)} className="text-xs" /> · tx <Mono value={state.mint.txSignature} href={explorerTx(state.mint.txSignature)} chars={6} className="text-xs" />
        </div>
      ) : null}
      <Label hint={`estimated value ${formatUsd(verdictValue)}`}>Asking price (USD)</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-fg-faint">$</span>
        <Input type="number" min={1} step={1000} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="pl-8" />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button loading={busy} onClick={list} disabled={!registry || !asset}>List for sale</Button>
        <Button variant="ghost" onClick={() => patch({ step: 6 })}>Skip, keep unlisted</Button>
      </div>
    </StepCard>
  );
}

function Row({ k, v, full }: { k: string; v: React.ReactNode; full?: boolean }) {
  return (
    <div className={cn("min-w-0", full && "sm:col-span-2")}>
      <dt className="text-[11px] uppercase tracking-[0.14em] text-fg-faint">{k}</dt>
      <dd className="truncate text-fg">{v}</dd>
    </div>
  );
}

// ---- Done ----
function DoneStep({ state, onReset }: { state: WizardState; onReset: () => void }) {
  const lot = state.lot;
  return (
    <StepCard icon={<Check className="size-5" />} title={state.listing ? "Your air rights are live" : "Your air rights are minted"} subtitle={lot ? `${lot.address} · BBL ${lot.bbl}` : undefined}>
      <ul className="space-y-2 text-sm">
        {state.kyc ? <Li label="KYC attestation" value={state.kyc.attestation} href={explorerAddress(state.kyc.attestation)} /> : null}
        {state.ownerAttestation ? <Li label="Owner attestation" value={state.ownerAttestation.attestation} href={explorerAddress(state.ownerAttestation.attestation)} /> : null}
        {state.mint ? <Li label="Core asset" value={state.mint.asset} href={explorerAddress(state.mint.asset)} /> : null}
        {state.mint ? <Li label="Mint tx" value={state.mint.txSignature} href={explorerTx(state.mint.txSignature)} /> : null}
        {state.listing ? <Li label={`Listing tx (${formatUsd(state.listing.priceUsd)})`} value={state.listing.txSignature} href={explorerTx(state.listing.txSignature)} /> : null}
      </ul>
      <div className="mt-6 flex flex-wrap gap-3">
        {lot ? <Button href={`/parcel/${lot.bbl}`} iconRight={<ArrowRight className="size-4" />}>View parcel</Button> : null}
        <Button href="/portfolio" variant="secondary">Portfolio</Button>
        <Button variant="ghost" onClick={onReset} icon={<RotateCcw className="size-3.5" />}>List another</Button>
      </div>
      <p className="mt-6 text-xs text-fg-faint">
        Share it: <Link href={lot ? `/parcel/${lot.bbl}` : "/explore"} className="font-mono text-cyan hover:underline">{typeof window !== "undefined" && lot ? `${window.location.origin}/parcel/${lot.bbl}` : "/explore"}</Link>
      </p>
    </StepCard>
  );
}

function Li({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
      <span className="text-fg-muted">{label}</span>
      <Mono value={value} href={href} chars={6} />
    </li>
  );
}
