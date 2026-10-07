"use client";

import { Clock, ExternalLink, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Mono } from "@/components/ui/Mono";
import { Note, Panel, PanelHeader } from "@/components/ui/Panel";
import { Skeleton } from "@/components/ui/Skeleton";
import type { VerdictView } from "@/lib/airspace/types";
import { cn, explorerAddress, explorerTx, formatDate, formatNumber, formatUsd } from "@/lib/utils";
import { presentVerdict, sourceLabel } from "@/lib/verdict";
import { FlagChips } from "./FlagChips";

export function VerificationPanel({ verdict, loading, txSignature, className }: { verdict: VerdictView | null; loading?: boolean; txSignature?: string | null; className?: string }) {
  const p = presentVerdict(verdict);
  const confidence = verdict ? verdict.confidenceBps / 100 : 0;
  return (
    <Panel className={className}>
      <PanelHeader title="Verification" subtitle={p.description} right={<Badge tone={p.tone} dot={p.dot}>{p.label}</Badge>} />
      <div className="space-y-5 px-6 py-5">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-2.5 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : verdict ? (
          <>
            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
                <span className="text-fg-muted">Audit confidence</span>
                <span className="font-mono text-fg">{confidence.toFixed(1)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-fill">
                <div className={cn("h-full rounded-full transition-all duration-700", confidence >= 70 ? "bg-green" : "bg-orange")} style={{ width: `${Math.max(2, Math.min(100, confidence))}%` }} />
              </div>
            </div>

            <FlagChips flags={verdict.flags} />

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-[14px] sm:grid-cols-2">
              <Row label="Unused sq ft" value={<span className="font-mono">{formatNumber(verdict.unusedSqft)}</span>} />
              <Row label="Estimated value" value={<span className="font-mono">{formatUsd(verdict.estValueUsd)}</span>} />
              <Row label="Source" value={<span className="inline-flex items-center gap-1.5"><span className={cn("size-1.5 rounded-full", verdict.source === 1 ? "bg-blue" : "bg-purple")} />{sourceLabel(verdict)}</span>} />
              <Row label="Recorded" value={<span className="inline-flex items-center gap-1.5"><Clock className="size-3.5 text-fg-faint" />{verdict.recordedAt ? formatDate(verdict.recordedAt) : "not yet"}</span>} />
              <Row label="Requested" value={formatDate(verdict.requestedAt)} />
              <Row label="Requester" value={<Mono value={verdict.requester} href={explorerAddress(verdict.requester)} />} />
              <Row label="Report hash" value={<Mono value={verdict.reportHash || "—"} short chars={8} copy={!!verdict.reportHash} />} full />
              <Row label="Verdict account" value={<Mono value={verdict.pda} href={explorerAddress(verdict.pda)} />} />
              {txSignature ? <Row label="Verdict tx" value={<Mono value={txSignature} href={explorerTx(txSignature)} chars={6} />} /> : null}
            </dl>
          </>
        ) : (
          <Note className="flex items-start gap-3">
            <Link2 className="mt-0.5 size-4 shrink-0 text-fg-faint" />
            <p>
              No verdict account exists for this lot. Owners can request a Chainlink CRE audit from the{" "}
              <a href="/list" className="font-medium text-blue-ink hover:underline">listing wizard</a>.
            </p>
          </Note>
        )}
      </div>
    </Panel>
  );
}

function Row({ label, value, full }: { label: string; value: React.ReactNode; full?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", full && "sm:col-span-2")}>
      <dt className="text-[12px] text-fg-faint">{label}</dt>
      <dd className="min-w-0 truncate text-fg">{value}</dd>
    </div>
  );
}

export function ExplorerLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium text-blue-ink hover:underline">
      {children} <ExternalLink className="size-3" />
    </a>
  );
}
