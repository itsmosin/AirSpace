import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Steps({ steps, current, onSelect }: { steps: string[]; current: number; onSelect?: (i: number) => void }) {
  return (
    <ol className="no-scrollbar flex w-full items-center gap-1 overflow-x-auto">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={() => done && onSelect?.(i)}
              disabled={!done}
              className={cn("flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-[13px] font-medium transition-colors", active ? "bg-fg text-bg" : done ? "bg-fill text-fg hover:bg-fill-2" : "text-fg-faint")}
            >
              <span className={cn("flex size-5 items-center justify-center rounded-full text-[11px] font-semibold", active ? "bg-bg/20 text-bg" : done ? "bg-green text-[#0b1a10]" : "bg-fill text-fg-faint")}>
                {done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
              </span>
              <span className="whitespace-nowrap">{label}</span>
            </button>
            {i < steps.length - 1 ? <span className={cn("h-px w-4 shrink-0 sm:w-6", done ? "bg-green" : "bg-line-strong")} /> : null}
          </li>
        );
      })}
    </ol>
  );
}
