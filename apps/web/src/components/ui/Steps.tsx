import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Steps({ steps, current, onSelect }: { steps: string[]; current: number; onSelect?: (i: number) => void }) {
  return (
    <ol className="flex w-full items-center gap-1 overflow-x-auto scrollbar-thin">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={() => done && onSelect?.(i)}
              disabled={!done}
              className={cn("flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs transition-colors", active ? "bg-cyan/10 text-cyan" : done ? "text-fg hover:bg-white/5" : "text-fg-faint")}
            >
              <span className={cn("flex size-5 items-center justify-center rounded-full border text-[10px] font-semibold", active ? "border-cyan bg-cyan text-[#06202a]" : done ? "border-emerald/50 bg-emerald/10 text-emerald" : "border-white/15")}>
                {done ? <Check className="size-3" /> : i + 1}
              </span>
              <span className="whitespace-nowrap">{label}</span>
            </button>
            {i < steps.length - 1 ? <span className={cn("h-px w-4 shrink-0 sm:w-6", done ? "bg-emerald/40" : "bg-white/10")} /> : null}
          </li>
        );
      })}
    </ol>
  );
}
