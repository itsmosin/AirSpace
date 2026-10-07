import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./Skeleton";

export function Stat({ label, value, hint, loading, className, size = "md" }: { label: ReactNode; value: ReactNode; hint?: ReactNode; loading?: boolean; className?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-fg-muted">{label}</p>
      {loading ? (
        <Skeleton className={cn("mt-2", size === "lg" ? "h-9 w-32" : size === "sm" ? "h-5 w-16" : "h-7 w-24")} />
      ) : (
        <p className={cn("mt-1 truncate font-semibold tracking-tight text-fg", size === "lg" ? "text-3xl sm:text-4xl" : size === "sm" ? "text-base" : "text-xl sm:text-2xl")}>{value}</p>
      )}
      {hint ? <p className="mt-1 text-xs text-fg-faint">{hint}</p> : null}
    </div>
  );
}
