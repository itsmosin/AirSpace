import Link from "next/link";
import { cn } from "@/lib/utils";

/** Three vertical bars in blue, green and orange. */
export function Glyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={cn("size-6", className)} aria-hidden>
      <rect x="3" y="10" width="6" height="15" rx="2" fill="var(--blue)" />
      <rect x="11" y="3" width="6" height="22" rx="2" fill="var(--green)" />
      <rect x="19" y="14" width="6" height="11" rx="2" fill="var(--orange)" />
    </svg>
  );
}

export function Wordmark({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2", className)} aria-label="AirSpace home">
      <Glyph className="size-6 transition-transform duration-300 group-hover:-translate-y-0.5" />
      <span className="text-[17px] font-semibold tracking-[-0.02em] text-fg">AirSpace</span>
    </Link>
  );
}
