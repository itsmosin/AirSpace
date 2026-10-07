import { cn } from "@/lib/utils";

/** Used vs allowed floor-area ratio. */
export function FarBar({ used, allowed, className }: { used: number; allowed: number; className?: string }) {
  const pct = allowed > 0 ? Math.min(100, Math.max(0, (used / allowed) * 100)) : 0;
  return (
    <div className={cn("", className)}>
      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span className="text-fg-muted">
          FAR used <span className="font-mono text-fg">{used.toFixed(2)}</span>
        </span>
        <span className="text-fg-muted">
          allowed <span className="font-mono text-fg">{allowed.toFixed(2)}</span>
        </span>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/5">
        <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-fg-muted/70 to-fg-muted" style={{ width: `${pct}%` }} />
        <div className="absolute inset-y-0 rounded-full bg-gradient-to-r from-cyan/70 to-cyan shadow-[0_0_14px_rgba(34,211,238,0.6)]" style={{ left: `${pct}%`, right: 0 }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-fg-faint">
        <span>built</span>
        <span className="text-cyan">unused · {(100 - pct).toFixed(0)}%</span>
      </div>
    </div>
  );
}
