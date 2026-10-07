"use client";

import { Clock, ExternalLink, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Mono } from "@/components/ui/Mono";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Skeleton } from "@/components/ui/Skeleton";
import type { VerdictView } from "@/lib/airspace/types";
import { explorerAddress, explorerTx, formatDate, formatNumber, formatUsd } from "@/lib/utils";
import { presentVerdict, sourceLabel } from "@/lib/verdict";
import { FlagChips } from "./FlagChips";
import { cn } from "@/lib/utils";

export function VerificationPanel({ verdict, loading, txSignature, className }: { verdict: VerdictView | null; loading?: boolean; txSignature?: string | null; className?: string }) {
  const p = presentVerdict(verdict);
  const confidence = verdict ? verdict.confidenceBps / 100 : 0;
  return (
    <Panel className={className}>
      <PanelHeader
        title="Verification"
        subtitle={p.description}
        right={<Badge tone={p.tone} dot={p.dot}>{p.label}</Badge>}
      />
      <div className="space-y-5 px-5 py-5">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-2.5 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : verdict ? (
          <>
            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-xs">
                <span className="text-fg-muted">Audit confidence</span>
                <span className="font-mono text-fg">{confidence.toFixed(1)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className={cn("h-full rounded-full transition-all duration-700", confidence >= 70 ? "bg-gradient-to-r from-cyan/60 to-cyan" : "bg-gradient-to-r from-amber/60 to-amber")}
                  style={{ width: `${Math.max(2, Math.min(100, confidence))}%` }}
                />
              </div>
            </div>

            <FlagChips flags={verdict.flags} />

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Row label="Unused sq ft" value={<span className="font-mono">{formatNumber(verdict.unusedSqft)}</span>} />
              <Row label="Estimated value" value={<span className="font-mono">{formatUsd(verdict.estValueUsd)}</span>} />
              <Row label="Source" value={<span className="inline-flex items-center gap-1.5">{verdict.source === 1 ? <span className="size-1.5 rounded-full bg-cyan" /> : <span className="size-1.5 rounded-full bg-violet" />}{sourceLabel(verdict)}</span>} />
              <Row label="Recorded" value={<span className="inline-flex items-center gap-1.5"><Clock className="size-3.5 text-fg-faint" />{verdict.recordedAt ? formatDate(verdict.recordedAt) : "not yet"}</span>} />
              <Row label="Requested" value={formatDate(verdict.requestedAt)} />
              <Row label="Requester" value={<Mono value={verdict.requester} href={explorerAddress(verdict.requester)} />} />
              <Row label="Report hash" value={<Mono value={verdict.reportHash || "—"} short chars={8} copy={!!verdict.reportHash} />} full />
              <Row label="Verdict account" value={<Mono value={verdict.pda} href={explorerAddress(verdict.pda)} />} />
              {txSignature ? <Row label="Verdict tx" value={<Mono value={txSignature} href={explorerTx(txSignature)} chars={6} />} /> : null}
            </dl>
          </>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-fg-muted">
            <Link2 className="mt-0.5 size-4 shrink-0 text-fg-faint" />
            <p>
              No verdict account exists for this lot. Owners can request a Chainlink CRE audit from the{" "}
              <a href="/list" className="text-cyan hover:underline">listing wizard</a>.
            </p>
          </div>
        )}
      </div>
    </Panel>
  );
}

function Row({ label, value, full }: { label: string; value: React.ReactNode; full?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", full && "sm:col-span-2")}>
      <dt className="text-[11px] uppercase tracking-[0.14em] text-fg-faint">{label}</dt>
      <dd className="min-w-0 truncate text-fg">{value}</dd>
    </div>
  );
}

export function ExplorerLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-cyan hover:underline">
      {children} <ExternalLink className="size-3" />
    </a>
  );
}
