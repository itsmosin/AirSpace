"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** Soft rounded "Verification log" card with mono text. */
export function Terminal({ text, title = "Verification log", meta, live, className, maxHeight = 320 }: { text: string; title?: string; meta?: string; live?: boolean; className?: string; maxHeight?: number }) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [text]);
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-line bg-log", className)}>
      <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <span className="text-[13px] font-medium text-fg">{title}</span>
        {meta ? <span className="truncate font-mono text-[11px] text-fg-faint">{meta}</span> : null}
        {live ? (
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-green-ink">
            <span className="size-1.5 animate-pulse rounded-full bg-green" /> live
          </span>
        ) : null}
      </div>
      <pre ref={ref} className="scrollbar-thin overflow-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-[12px] leading-relaxed text-fg-muted" style={{ maxHeight }}>
        {text || <span className="text-fg-faint">waiting for output…</span>}
        {live ? <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-green align-middle" /> : null}
      </pre>
    </div>
  );
}
