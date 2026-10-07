import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AccentTone = "blue" | "green" | "orange" | "red" | "purple" | "yellow" | "teal" | "neutral";
/** Semantic tone names used by verdict and flag presentation; resolved to accents here. */
type SemanticTone = "cyan" | "violet" | "amber" | "rose" | "emerald";
export type BadgeTone = AccentTone | SemanticTone;

const semantic: Record<SemanticTone, AccentTone> = { cyan: "green", emerald: "green", violet: "orange", amber: "yellow", rose: "red" };

export function resolveTone(tone: BadgeTone): AccentTone {
  return (semantic as Record<string, AccentTone>)[tone] ?? (tone as AccentTone);
}

const tones: Record<AccentTone, string> = {
  blue: "bg-blue/12 text-blue-ink",
  green: "bg-green/14 text-green-ink",
  orange: "bg-orange/14 text-orange-ink",
  red: "bg-red/12 text-red-ink",
  purple: "bg-purple/12 text-purple-ink",
  yellow: "bg-yellow/20 text-yellow-ink",
  teal: "bg-teal/16 text-teal-ink",
  neutral: "bg-fill text-fg-muted",
};

export const toneText: Record<AccentTone, string> = {
  blue: "text-blue-ink",
  green: "text-green-ink",
  orange: "text-orange-ink",
  red: "text-red-ink",
  purple: "text-purple-ink",
  yellow: "text-yellow-ink",
  teal: "text-teal-ink",
  neutral: "text-fg-muted",
};

export const toneDot: Record<AccentTone, string> = {
  blue: "bg-blue",
  green: "bg-green",
  orange: "bg-orange",
  red: "bg-red",
  purple: "bg-purple",
  yellow: "bg-yellow",
  teal: "bg-teal",
  neutral: "bg-fg-faint",
};

export function Badge({ tone = "neutral", children, className, dot }: { tone?: BadgeTone; children: ReactNode; className?: string; dot?: boolean }) {
  const t = resolveTone(tone);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium leading-none", tones[t], className)}>
      {dot ? <span className={cn("size-1.5 rounded-full", toneDot[t], t === "orange" || t === "yellow" ? "animate-pulse-soft" : "")} /> : null}
      {children}
    </span>
  );
}
