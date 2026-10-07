import { Badge } from "@/components/ui/Badge";
import type { VerdictView } from "@/lib/airspace/types";
import { presentVerdict } from "@/lib/verdict";

export function VerdictBadge({ verdict, listed, className }: { verdict: VerdictView | null | undefined; listed?: boolean; className?: string }) {
  if (listed) return <Badge tone="green" className={className}>Listed</Badge>;
  const p = presentVerdict(verdict);
  return <Badge tone={p.tone} dot={p.dot} className={className}>{p.label}</Badge>;
}
