import Link from "next/link";
import { cn } from "@/lib/utils";

export function Glyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={cn("size-6", className)} aria-hidden>
      <rect x="4" y="9" width="3" height="15" rx="1" fill="var(--cyan)" />
      <rect x="10.5" y="4" width="3" height="20" rx="1" fill="var(--cyan)" />
      <rect x="17" y="12" width="3" height="12" rx="1" fill="var(--violet)" />
      <rect x="23.5" y="7" width="1.5" height="17" rx="0.75" fill="var(--fg)" opacity="0.5" />
    </svg>
  );
}

export function Wordmark({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)} aria-label="AirSpace home">
      <Glyph className="transition-transform duration-300 group-hover:-translate-y-0.5" />
      <span className="text-[17px] font-semibold tracking-[-0.02em] text-fg">AirSpace</span>
    </Link>
  );
}
