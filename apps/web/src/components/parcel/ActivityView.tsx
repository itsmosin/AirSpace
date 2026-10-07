"use client";

import Link from "next/link";
import { useCallback } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { Activity, ExternalLink, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Mono } from "@/components/ui/Mono";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { decodeInstructionName, parseEventsFromLogs, plainEventData } from "@/lib/airspace/events";
import { PROGRAM_ID } from "@/lib/airspace/pdas";
import { usePoll } from "@/lib/hooks/usePoll";
import { cn, explorerAddress, explorerTx, formatUsd, formatSol, shortAddress, timeAgo } from "@/lib/utils";

type Row = {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: boolean;
  instructions: string[];
  events: Array<{ name: string; data: Record<string, string | number> }>;
};

const EVENT_TONE: Record<string, BadgeTone> = { VerdictRecorded: "purple", ParcelMinted: "blue", ParcelListed: "teal", ListingCancelled: "neutral", ParcelSold: "green" };
const humanIx: Record<string, string> = {
  initializeRegistry: "Initialize registry", setAttestationConfig: "Set attestation config", createCollection: "Create collection", openVerdict: "Open verdict",
  onReport: "CRE report received", recordVerdictManual: "Manual verdict", mintParcel: "Mint parcel", listParcel: "List parcel", cancelListing: "Cancel listing", buyParcel: "Buy parcel",
};

export function ActivityView() {
  const { connection } = useConnection();
  const fetcher = useCallback(async (): Promise<Row[]> => {
    const sigs = await connection.getSignaturesForAddress(PROGRAM_ID, { limit: 30 }, "confirmed");
    if (sigs.length === 0) return [];
    // Fetch in small chunks with spacing and backoff: public and free-tier RPCs cap requests per second,
    // and a batch call is billed per transaction.
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const txs: Awaited<ReturnType<typeof connection.getTransactions>> = [];
    const CHUNK = 8;
    for (let i = 0; i < sigs.length; i += CHUNK) {
      const chunk = sigs.slice(i, i + CHUNK).map((s) => s.signature);
      let attempt = 0;
      for (;;) {
        try {
          txs.push(...(await connection.getTransactions(chunk, { maxSupportedTransactionVersion: 0, commitment: "confirmed" })));
          break;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!/limit|429|Too Many/i.test(msg) || attempt >= 4) throw e;
          attempt += 1;
          await sleep(600 * 2 ** attempt);
        }
      }
      if (i + CHUNK < sigs.length) await sleep(700);
    }
    return sigs.map((s, i) => {
      const tx = txs[i];
      const logs = tx?.meta?.logMessages ?? [];
      const events = parseEventsFromLogs(PROGRAM_ID, logs).map((e) => ({ name: e.name, data: plainEventData(e.data) }));
      const instructions: string[] = [];
      if (tx) {
        const msg = tx.transaction.message;
        const keys = msg.staticAccountKeys;
        for (const ix of msg.compiledInstructions) {
          if (keys[ix.programIdIndex]?.equals(PROGRAM_ID)) {
            const name = decodeInstructionName(Buffer.from(ix.data));
            instructions.push(name ?? "unknown");
          }
        }
      }
      return { signature: s.signature, slot: s.slot, blockTime: s.blockTime ?? null, err: !!s.err, instructions, events };
    });
  }, [connection]);

  const { data, loading, error, refresh } = usePoll<Row[]>("activity", fetcher, { intervalMs: 30000, staleMs: 10000 });

  return (
    <div className="mx-auto max-w-4xl px-4 pb-8 sm:px-6">
      <SectionHeader
        title="Recent program transactions"
        description={
          <>
            Newest first, decoded from Anchor events on <Mono value={PROGRAM_ID.toBase58()} href={explorerAddress(PROGRAM_ID.toBase58())} className="text-[13px]" />
          </>
        }
      >
        <Button variant="secondary" size="sm" icon={<RefreshCw className={cn("size-3.5", loading && "animate-spin")} />} onClick={() => void refresh()}>Refresh</Button>
      </SectionHeader>

      <div className="flex flex-col gap-3">
        {loading && !data ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-3xl" />)
        ) : error && !data ? (
          <EmptyState icon={<Activity className="size-5" />} title="Could not load activity" description={error} />
        ) : !data || data.length === 0 ? (
          <EmptyState icon={<Activity className="size-5" />} title="No transactions yet" description="Once the registry is initialized and parcels are verified, every program interaction shows up here." />
        ) : (
          data.map((row, i) => (
            <motion.article
              key={row.signature}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: Math.min(i, 8) * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className={cn("rounded-3xl border border-line bg-surface p-5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover", row.err && "border-red/40")}
            >
              <div className="flex flex-wrap items-center gap-2">
                {row.events.length ? row.events.map((e, i) => <Badge key={i} tone={EVENT_TONE[e.name] ?? "neutral"}>{e.name}</Badge>) : row.instructions.map((ix, i) => <Badge key={i} tone="neutral">{humanIx[ix] ?? ix}</Badge>)}
                {row.err ? <Badge tone="red">failed</Badge> : null}
                <span className="ml-auto text-[12px] text-fg-faint">{row.blockTime ? timeAgo(row.blockTime) : `slot ${row.slot}`}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-fg-muted">
                <a href={explorerTx(row.signature)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-[12px] hover:text-blue-ink">
                  {shortAddress(row.signature, 8)} <ExternalLink className="size-3" />
                </a>
                {row.instructions.length && row.events.length ? <span>{row.instructions.map((ix) => humanIx[ix] ?? ix).join(", ")}</span> : null}
              </div>
              {row.events.map((e, i) => (
                <EventSummary key={i} name={e.name} data={e.data} />
              ))}
            </motion.article>
          ))
        )}
      </div>
    </div>
  );
}

function EventSummary({ name, data }: { name: string; data: Record<string, string | number> }) {
  const bbl = String(data.bbl ?? "");
  const parts: React.ReactNode[] = [];
  if (bbl) parts.push(<Link key="bbl" href={`/parcel/${bbl}`} className="font-mono text-[13px] font-medium text-blue-ink hover:underline">BBL {bbl}</Link>);
  if (name === "ParcelSold") {
    parts.push(<span key="p">{formatUsd(Number(data.priceUsdCents) / 100, true)} · {formatSol(Number(data.lamportsPaid))}</span>);
    parts.push(<span key="b">buyer {shortAddress(String(data.buyer))}</span>);
  } else if (name === "ParcelListed") {
    parts.push(<span key="p">ask {formatUsd(Number(data.priceUsdCents) / 100)}</span>);
  } else if (name === "VerdictRecorded") {
    const status = Number(data.status);
    parts.push(<span key="s">status {["Pending", "Allow", "Deny", "Review"][status] ?? status} · {(Number(data.confidenceBps) / 100).toFixed(0)}% · {data.source === 1 || data.source === "1" ? "Chainlink CRE" : "Registrar"}</span>);
  } else if (name === "ParcelMinted") {
    parts.push(<span key="o">owner {shortAddress(String(data.owner))}</span>);
  }
  if (data.asset) parts.push(<a key="a" href={explorerAddress(String(data.asset))} target="_blank" rel="noreferrer" className="font-mono text-[13px] hover:text-blue-ink">asset {shortAddress(String(data.asset))}</a>);
  return <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-fg">{parts}</p>;
}
