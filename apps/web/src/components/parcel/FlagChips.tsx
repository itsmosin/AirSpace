import { ShieldAlert, ShieldCheck } from "lucide-react";
import { resolveTone, toneText } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { decodeFlags } from "@/lib/verdict";

export function FlagChips({ flags, className }: { flags: number; className?: string }) {
  const list = decodeFlags(flags);
  if (list.length === 0) {
    return (
      <div className={cn("inline-flex items-center gap-2 rounded-2xl bg-green/10 px-4 py-2.5 text-[13px] font-medium text-green-ink", className)}>
        <ShieldCheck className="size-4" /> No warnings. Landmark, historic-district and special-district checks all clear.
      </div>
    );
  }
  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {list.map((f) => {
        const tone = resolveTone(f.tone);
        return (
          <li key={f.key} className={cn("flex items-start gap-3 rounded-2xl px-4 py-3", tone === "red" ? "bg-red/10" : tone === "yellow" ? "bg-yellow/15" : "bg-fill-2")}>
            <ShieldAlert className={cn("mt-0.5 size-4 shrink-0", toneText[tone])} />
            <div>
              <p className="text-[14px] font-medium text-fg">
                {f.label}
                {f.blocking ? <span className="ml-2 rounded-full bg-red/12 px-2 py-0.5 text-[11px] font-medium text-red-ink">blocking</span> : null}
              </p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">{f.description}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
