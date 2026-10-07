import { MapPinOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function MapPlaceholder({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("relative flex h-full w-full items-center justify-center overflow-hidden bg-bg-elevated", className)}>
      <div className="grid-fade absolute inset-0 opacity-70" />
      <div className="absolute -left-32 top-10 size-96 rounded-full bg-cyan/10 blur-3xl" />
      <div className="absolute -right-24 bottom-0 size-96 rounded-full bg-violet/10 blur-3xl" />
      {/* skyline silhouette */}
      <svg viewBox="0 0 800 260" className="absolute inset-x-0 bottom-0 w-full opacity-60" preserveAspectRatio="none" aria-hidden>
        {Array.from({ length: 40 }, (_, i) => {
          const h = 40 + ((i * 53) % 170);
          const w = 14 + ((i * 7) % 12);
          const x = i * 20;
          return <rect key={i} x={x} y={260 - h} width={w} height={h} fill={i % 5 === 0 ? "rgba(139,92,246,0.25)" : "rgba(34,211,238,0.14)"} />;
        })}
      </svg>
      <div className={cn("glass-strong relative z-10 mx-4 max-w-md rounded-2xl p-6 text-center", compact && "p-4")}>
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-fg-muted">
          <MapPinOff className="size-5" />
        </div>
        <p className="text-sm font-semibold tracking-tight text-fg">3D map needs a Mapbox token</p>
        <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">
          Set <code className="rounded bg-white/5 px-1 py-0.5 font-mono text-[11px] text-cyan">NEXT_PUBLIC_MAPBOX_TOKEN</code> in <code className="font-mono text-[11px]">apps/web/.env.local</code> and restart the dev server. Everything else works without it.
        </p>
      </div>
    </div>
  );
}
