import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-3xl border border-line bg-surface px-6 py-14 text-center shadow-card", className)}>
      {icon ? <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-fill text-fg-muted">{icon}</div> : null}
      <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-fg">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
