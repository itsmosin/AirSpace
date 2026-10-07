"use client";

import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "accent";
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
  "group relative inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-[-0.01em] transition-all duration-200 ease-out select-none whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]";
const variants: Record<Variant, string> = {
  primary: "bg-fg text-bg hover:opacity-90 shadow-[0_1px_2px_rgba(0,0,0,0.12)]",
  secondary: "bg-fill text-fg hover:bg-fill-2",
  ghost: "text-fg-muted hover:text-fg hover:bg-fill",
  danger: "bg-red/12 text-red-ink hover:bg-red/20",
  outline: "border border-line-strong bg-transparent text-fg hover:bg-fill",
  accent: "bg-green text-[#0b1a10] hover:brightness-105 shadow-[0_1px_2px_rgba(0,0,0,0.12)]",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[13px]",
  md: "h-11 px-5 text-[15px]",
  lg: "h-12 px-6 text-[16px]",
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

/** Round 36px icon button used in the header and card corners. */
export function IconButton({ className, children, href, external, label, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { href?: string; external?: boolean; label: string }) {
  const cls = cn("inline-flex size-9 items-center justify-center rounded-full border border-line bg-surface text-fg transition-colors hover:bg-fill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/50", className);
  if (href) {
    return (
      <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className={cls} aria-label={label} title={label}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={cls} aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}
