"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { cn, shortAddress } from "@/lib/utils";

export function Mono({ value, href, short = true, chars = 4, className, copy = true }: { value: string; href?: string; short?: boolean; chars?: number; className?: string; copy?: boolean }) {
  const [copied, setCopied] = useState(false);
  const text = short ? shortAddress(value, chars) : value;
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore clipboard failures
    }
  };
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1.5 font-mono text-[13px] tracking-tight text-fg", className)} title={value}>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 truncate hover:text-cyan">
          <span className="truncate">{text}</span>
          <ExternalLink className="size-3 shrink-0 opacity-60" />
        </a>
      ) : (
        <span className="truncate">{text}</span>
      )}
      {copy ? (
        <button type="button" onClick={onCopy} className="rounded p-0.5 text-fg-faint hover:bg-white/10 hover:text-fg" aria-label="Copy">
          {copied ? <Check className="size-3 text-emerald" /> : <Copy className="size-3" />}
        </button>
      ) : null}
    </span>
  );
}
