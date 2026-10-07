"use client";

import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  href?: string;
  external?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
};

const base =
  "group relative inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-tight transition-all duration-200 ease-out select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]";
const variants: Record<Variant, string> = {
  primary: "bg-cyan text-[#06202a] shadow-[0_8px_30px_-10px_rgba(34,211,238,0.7)] hover:shadow-[0_12px_40px_-10px_rgba(34,211,238,0.9)] hover:brightness-110",
  secondary: "glass text-fg hover:bg-white/10 hover:border-white/20",
  ghost: "text-fg-muted hover:text-fg hover:bg-white/5",
  danger: "bg-rose/10 text-rose border border-rose/30 hover:bg-rose/20",
  outline: "border border-white/15 text-fg hover:border-cyan/50 hover:text-cyan",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[13px]",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, href, external, icon, iconRight, children, disabled, ...props },
  ref,
) {
  const cls = cn(base, variants[variant], sizes[size], className);
  const content = (
    <>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      <span>{children}</span>
      {iconRight && !loading ? <span className="transition-transform duration-200 group-hover:translate-x-0.5">{iconRight}</span> : null}
    </>
  );
  if (href) {
    if (external) {
      return (
        <a href={href} target="_blank" rel="noreferrer" className={cls}>
          {content}
        </a>
      );
    }
    return (
      <Link href={href} className={cls}>
        {content}
      </Link>
    );
  }
  return (
    <button ref={ref} className={cls} disabled={disabled || loading} {...props}>
      {content}
    </button>
  );
});
