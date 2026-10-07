"use client";

import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const field =
  "h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-fg placeholder:text-fg-faint outline-none transition-colors focus:border-cyan/50 focus:bg-white/[0.06] disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }>(function Input({ className, mono, ...props }, ref) {
  return <input ref={ref} className={cn(field, mono && "font-mono tracking-tight", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(field, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%238b93a7%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:12px] bg-[right_14px_center] bg-no-repeat pr-9", className)} {...props}>
      {children}
    </select>
  );
});

export function Label({ children, hint, className }: { children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <div className={cn("mb-1.5 flex items-baseline justify-between", className)}>
      <span className="text-xs font-medium text-fg-muted">{children}</span>
      {hint ? <span className="text-[11px] text-fg-faint">{hint}</span> : null}
    </div>
  );
}
