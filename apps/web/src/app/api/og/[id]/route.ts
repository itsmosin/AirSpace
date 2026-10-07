import { getParcels, getVerdictByBbl } from "@/lib/server/parcels";
import { plutoByBbl } from "@/lib/server/pluto";
import { renderCollectionSvg, renderParcelSvg, sourceFromLot, sourceFromParcel } from "@/lib/metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const svg = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=120" } });

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (id === "collection") return svg(renderCollectionSvg());
  if (!/^\d{10}$/.test(id)) return svg(renderParcelSvg({ bbl: id }), 200);
  try {
    const data = await getParcels();
    const parcel = data.parcels.find((p) => p.bbl === id);
    if (parcel) return svg(renderParcelSvg(sourceFromParcel(parcel, parcel.verdict)));
    const [lot, verdict] = await Promise.all([plutoByBbl(id), getVerdictByBbl(id)]);
    if (lot) return svg(renderParcelSvg(sourceFromLot(lot, verdict)));
  } catch {
    // fall through to a generic card
  }
  return svg(renderParcelSvg({ bbl: id }));
}
