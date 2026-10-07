import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./Skeleton";

export function Stat({ label, value, hint, loading, className, size = "md" }: { label: ReactNode; value: ReactNode; hint?: ReactNode; loading?: boolean; className?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[13px] font-medium text-fg-muted">{label}</p>
      {loading ? (
        <Skeleton className={cn("mt-2", size === "lg" ? "h-9 w-32" : size === "sm" ? "h-5 w-16" : "h-7 w-24")} />
      ) : (
        <p className={cn("mt-1 truncate font-semibold tracking-[-0.02em] text-fg", size === "lg" ? "text-[32px] leading-none sm:text-[40px]" : size === "sm" ? "text-[17px]" : "text-[24px] leading-tight")}>{value}</p>
      )}
      {hint ? <p className="mt-1 text-[12px] text-fg-faint">{hint}</p> : null}
    </div>
  );
}
