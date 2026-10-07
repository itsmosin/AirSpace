import { FLAGS } from "@airspace/shared";
import type { BadgeTone } from "@/components/ui/Badge";
import type { VerdictView } from "@/lib/airspace/types";

export type FlagInfo = { bit: number; key: keyof typeof FLAGS; label: string; description: string; tone: BadgeTone; blocking: boolean };

export const FLAG_INFO: FlagInfo[] = [
  { bit: FLAGS.LANDMARK, key: "LANDMARK", label: "Landmark", description: "The building is a designated NYC landmark. Transfers may require LPC review.", tone: "amber", blocking: false },
  { bit: FLAGS.HISTORIC_DISTRICT, key: "HISTORIC_DISTRICT", label: "Historic district", description: "The lot sits inside a historic district, which can restrict new bulk.", tone: "amber", blocking: false },
  { bit: FLAGS.NO_UNUSED_FAR, key: "NO_UNUSED_FAR", label: "No unused FAR", description: "Built floor area already meets or exceeds the zoning maximum. Nothing to transfer.", tone: "rose", blocking: true },
  { bit: FLAGS.DATA_MISMATCH, key: "DATA_MISMATCH", label: "Data mismatch", description: "Submitted figures do not match the city's PLUTO record.", tone: "rose", blocking: true },
  { bit: FLAGS.LOW_CONFIDENCE, key: "LOW_CONFIDENCE", label: "Low confidence", description: "The audit model was not confident enough; a human review is required.", tone: "amber", blocking: false },
  { bit: FLAGS.SPECIAL_DISTRICT, key: "SPECIAL_DISTRICT", label: "Special district", description: "A special purpose district applies and may alter transfer rules.", tone: "amber", blocking: false },
  { bit: FLAGS.OWNER_MISMATCH, key: "OWNER_MISMATCH", label: "Owner mismatch", description: "The submitted owner name differs from the owner of record (informational).", tone: "neutral", blocking: false },
];

export function decodeFlags(flags: number) {
  return FLAG_INFO.filter((f) => (flags & f.bit) !== 0);
}

export type VerdictPresentation = { label: string; tone: BadgeTone; dot: boolean; description: string };

export function presentVerdict(v: VerdictView | null | undefined): VerdictPresentation {
  if (!v) return { label: "Not verified", tone: "neutral", dot: false, description: "No verification has been requested for this lot yet." };
  switch (v.status) {
    case 1:
      return { label: "Verified", tone: "cyan", dot: false, description: "Unused development rights confirmed against NYC PLUTO and recorded on-chain." };
    case 2:
      return { label: "Denied", tone: "rose", dot: false, description: "The audit found blocking issues. These rights cannot be minted." };
    case 3:
      return { label: "Needs review", tone: "amber", dot: true, description: "The audit flagged items that require a human review before minting." };
    default:
      return { label: "Pending", tone: "violet", dot: true, description: "Verification requested. Waiting for the Chainlink CRE report to land on-chain." };
  }
}

export function sourceLabel(v: VerdictView | null | undefined) {
  if (!v) return "—";
  return v.source === 1 ? "Chainlink CRE" : "Registrar";
}
