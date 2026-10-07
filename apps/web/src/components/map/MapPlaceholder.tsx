import { MapPinOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function MapPlaceholder({ className, compact, reason }: { className?: string; compact?: boolean; reason?: "token" | "webgl" }) {
  return (
    <div className={cn("relative flex h-full w-full items-center justify-center overflow-hidden bg-fill-2", className)}>
      <div className="dot-field absolute inset-0 opacity-80" />
      {/* skyline silhouette */}
      <svg viewBox="0 0 800 260" className="absolute inset-x-0 bottom-0 w-full" preserveAspectRatio="none" aria-hidden>
        {Array.from({ length: 40 }, (_, i) => {
          const h = 40 + ((i * 53) % 170);
          const w = 14 + ((i * 7) % 12);
          const x = i * 20;
          const accent = i % 7 === 0 ? "var(--green)" : i % 11 === 0 ? "var(--orange)" : "var(--fg)";
          return <rect key={i} x={x} y={260 - h} width={w} height={h} fill={accent} opacity={i % 7 === 0 || i % 11 === 0 ? 0.35 : 0.08} />;
        })}
      </svg>
      <div className={cn("relative z-10 mx-4 max-w-md rounded-3xl border border-line bg-surface p-6 text-center shadow-card", compact && "p-4")}>
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-fill text-fg-muted">
          <MapPinOff className="size-5" />
        </div>
        {reason === "webgl" ? (
          <>
            <p className="text-[15px] font-semibold text-fg">This browser cannot render the 3D map</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">WebGL is unavailable here. Parcels, verification and trading all work without it.</p>
          </>
        ) : (
          <>
            <p className="text-[15px] font-semibold text-fg">3D map needs a Mapbox token</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">
              Set <code className="rounded bg-fill px-1 py-0.5 font-mono text-[12px] text-blue-ink">NEXT_PUBLIC_MAPBOX_TOKEN</code> in <code className="font-mono text-[12px]">apps/web/.env.local</code> and restart the dev server. Everything else works without it.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
