import { ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { decodeFlags } from "@/lib/verdict";

export function FlagChips({ flags, className }: { flags: number; className?: string }) {
  const list = decodeFlags(flags);
  if (list.length === 0) {
    return (
      <div className={cn("inline-flex items-center gap-2 rounded-xl border border-emerald/20 bg-emerald/5 px-3 py-2 text-xs text-emerald", className)}>
        <ShieldCheck className="size-4" /> No warnings. Landmark, historic-district and special-district checks all clear.
      </div>
    );
  }
  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {list.map((f) => (
        <li key={f.key} className={cn("flex items-start gap-3 rounded-xl border px-3 py-2.5", f.tone === "rose" ? "border-rose/25 bg-rose/5" : f.tone === "amber" ? "border-amber/25 bg-amber/5" : "border-white/10 bg-white/[0.03]")}>
          <ShieldAlert className={cn("mt-0.5 size-4 shrink-0", f.tone === "rose" ? "text-rose" : f.tone === "amber" ? "text-amber" : "text-fg-muted")} />
          <div>
            <p className="text-sm font-medium text-fg">
              {f.label}
              {f.blocking ? <span className="ml-2 text-[10px] uppercase tracking-widest text-rose">blocking</span> : null}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{f.description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
