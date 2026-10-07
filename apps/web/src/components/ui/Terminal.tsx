"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export function Terminal({ text, title = "cre workflow simulate", live, className, maxHeight = 320 }: { text: string; title?: string; live?: boolean; className?: string; maxHeight?: number }) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [text]);
  return (
    <div className={cn("overflow-hidden rounded-xl border border-white/10 bg-[#05070c]", className)}>
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="size-2.5 rounded-full bg-white/10" />
        <span className="size-2.5 rounded-full bg-white/10" />
        <span className="size-2.5 rounded-full bg-white/10" />
        <span className="ml-2 font-mono text-[11px] text-fg-faint">{title}</span>
        {live ? (
          <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-cyan">
            <span className="size-1.5 animate-pulse rounded-full bg-cyan" /> live
          </span>
        ) : null}
      </div>
      <pre ref={ref} className="scrollbar-thin overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[11.5px] leading-relaxed text-[#b7c1d6]" style={{ maxHeight }}>
        {text || <span className="text-fg-faint">waiting for output…</span>}
        {live ? <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-cyan/80 align-middle" /> : null}
      </pre>
    </div>
  );
}
