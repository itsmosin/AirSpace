import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({ className, children, hover, ...props }: HTMLAttributes<HTMLDivElement> & { hover?: boolean; strong?: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-line bg-surface shadow-card transition-[transform,box-shadow,border-color] duration-300",
        hover && "hover:-translate-y-0.5 hover:shadow-card-hover",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function PanelHeader({ title, subtitle, right, className }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-line px-6 py-5", className)}>
      <div className="min-w-0">
        <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-fg">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-[13px] leading-snug text-fg-muted">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[13px] font-medium text-fg-muted", className)}>{children}</p>;
}

/** Small tinted inset box used for notes and states inside cards. */
export function Note({ tone = "neutral", children, className }: { tone?: "neutral" | "green" | "orange" | "red" | "blue" | "yellow"; children: ReactNode; className?: string }) {
  const tones = {
    neutral: "bg-fill-2 text-fg-muted",
    green: "bg-green/10 text-green-ink",
    orange: "bg-orange/10 text-orange-ink",
    red: "bg-red/10 text-red-ink",
    blue: "bg-blue/10 text-blue-ink",
    yellow: "bg-yellow/15 text-yellow-ink",
  } as const;
  return <div className={cn("rounded-2xl px-4 py-3 text-[13px] leading-relaxed", tones[tone], className)}>{children}</div>;
}
