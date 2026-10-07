import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({ className, children, strong, ...props }: HTMLAttributes<HTMLDivElement> & { strong?: boolean; children: ReactNode }) {
  return (
    <div className={cn(strong ? "glass-strong" : "glass", "rounded-2xl", className)} {...props}>
      {children}
    </div>
  );
}

export function PanelHeader({ title, subtitle, right, className }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4", className)}>
      <div>
        <h3 className="text-sm font-semibold tracking-tight text-fg">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-fg-muted">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[11px] font-medium uppercase tracking-[0.18em] text-fg-muted", className)}>{children}</p>;
}
