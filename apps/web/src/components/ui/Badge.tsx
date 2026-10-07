import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "cyan" | "violet" | "amber" | "rose" | "emerald" | "neutral";

const tones: Record<BadgeTone, string> = {
  cyan: "bg-cyan/10 text-cyan border-cyan/30",
  violet: "bg-violet/10 text-violet border-violet/30",
  amber: "bg-amber/10 text-amber border-amber/30",
  rose: "bg-rose/10 text-rose border-rose/30",
  emerald: "bg-emerald/10 text-emerald border-emerald/30",
  neutral: "bg-white/5 text-fg-muted border-white/10",
};

export function Badge({ tone = "neutral", children, className, dot }: { tone?: BadgeTone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em]", tones[tone], className)}>
      {dot ? <span className={cn("size-1.5 rounded-full bg-current", tone === "amber" || tone === "violet" ? "animate-pulse-soft" : "")} /> : null}
      {children}
    </span>
  );
}
