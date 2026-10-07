import type { PlutoLot } from "@airspace/shared";
import { BOROUGH_NAME } from "@airspace/shared";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatNumber, titleCase } from "@/lib/utils";

export function PlutoFacts({ lot, loading, className }: { lot: PlutoLot | null; loading?: boolean; className?: string }) {
  const rows: Array<[string, React.ReactNode]> = lot
    ? [
        ["Address", lot.address],
        ["Borough", BOROUGH_NAME[lot.borough]],
        ["ZIP", lot.zipcode || "—"],
        ["Zoning", lot.zoning || "—"],
        ["Special district", lot.specialDistrict || "none"],
        ["Lot area", `${formatNumber(lot.lotAreaSqft)} sq ft`],
        ["Built area", `${formatNumber(lot.builtAreaSqft)} sq ft`],
        ["Residential FAR", lot.residFar.toFixed(2)],
        ["Commercial FAR", lot.commFar.toFixed(2)],
        ["Facility FAR", lot.facilFar.toFixed(2)],
        ["Max FAR", lot.maxFar.toFixed(2)],
        ["Floors", String(lot.numFloors)],
        ["Year built", lot.yearBuilt ? String(lot.yearBuilt) : "—"],
        ["Landmark", lot.landmark || "none"],
        ["Historic district", lot.historicDistrict || "none"],
        ["Owner of record", lot.ownerName ? titleCase(lot.ownerName) : "—"],
        ["Coordinates", <span key="c" className="font-mono text-xs">{lot.lat.toFixed(5)}, {lot.lng.toFixed(5)}</span>],
      ]
    : [];
  return (
    <Panel className={className}>
      <PanelHeader title="NYC PLUTO record" subtitle="Primary Land Use Tax Lot Output, Department of City Planning" />
      <div className="px-5 py-3">
        {loading ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-4" />
            ))}
          </div>
        ) : lot ? (
          <dl className="divide-y divide-white/5">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 py-2 text-sm">
                <dt className="text-fg-muted">{k}</dt>
                <dd className="truncate text-right text-fg">{v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="py-4 text-sm text-fg-muted">PLUTO record unavailable.</p>
        )}
      </div>
    </Panel>
  );
}
