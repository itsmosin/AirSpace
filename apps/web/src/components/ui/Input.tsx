"use client";

import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const field =
  "h-11 w-full rounded-[14px] border border-line bg-surface px-4 text-[15px] text-fg placeholder:text-fg-faint outline-none transition-colors focus:border-line-strong focus:ring-2 focus:ring-blue/30 disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { mono?: boolean; pill?: boolean }>(function Input({ className, mono, pill, ...props }, ref) {
  return <input ref={ref} className={cn(field, mono && "font-mono text-[14px] tracking-tight", pill && "rounded-full", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        field,
        "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%236e6e73%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:12px] bg-[right_14px_center] bg-no-repeat pr-9",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export function Label({ children, hint, className }: { children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <div className={cn("mb-1.5 flex items-baseline justify-between", className)}>
      <span className="text-[13px] font-medium text-fg">{children}</span>
      {hint ? <span className="text-[12px] text-fg-faint">{hint}</span> : null}
    </div>
  );
}

/** Segmented pill group, used for filters. */
export function Segmented<T extends string>({ value, onChange, options, className, label }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }>; className?: string; label?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("no-scrollbar flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-fill p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              active ? "bg-surface text-fg shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-fg-muted hover:text-fg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
