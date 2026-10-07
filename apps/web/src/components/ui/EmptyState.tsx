import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("glass flex flex-col items-center justify-center rounded-2xl px-6 py-14 text-center", className)}>
      {icon ? <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-fg-muted">{icon}</div> : null}
      <h3 className="text-base font-semibold tracking-tight text-fg">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
