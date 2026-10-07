import { cn } from "@/lib/utils";

/** Thin, faint elliptical orbit arcs used behind heroes and section headers. */
export function OrbitArcs({ className, variant = "hero" }: { className?: string; variant?: "hero" | "section" }) {
  const arcs =
    variant === "hero"
      ? [
          { rx: 760, ry: 230, rot: -12, color: "var(--blue)", op: 0.16 },
          { rx: 640, ry: 300, rot: 9, color: "var(--green)", op: 0.13 },
          { rx: 900, ry: 180, rot: -3, color: "var(--orange)", op: 0.12 },
        ]
      : [
          { rx: 640, ry: 150, rot: -8, color: "var(--blue)", op: 0.14 },
          { rx: 520, ry: 190, rot: 7, color: "var(--orange)", op: 0.12 },
        ];
  return (
    <svg className={cn("pointer-events-none absolute inset-0 h-full w-full", className)} viewBox="0 0 1600 800" preserveAspectRatio="xMidYMid slice" aria-hidden>
      {arcs.map((a, i) => (
        <ellipse key={i} cx="800" cy="400" rx={a.rx} ry={a.ry} fill="none" stroke={a.color} strokeOpacity={a.op} strokeWidth="1.25" transform={`rotate(${a.rot} 800 400)`} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
