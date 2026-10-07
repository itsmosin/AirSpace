import { fail, json, requestOrigin } from "@/lib/server/http";
import { getParcels, getVerdictByBbl } from "@/lib/server/parcels";
import { plutoByBbl } from "@/lib/server/pluto";
import { buildMetadata, sourceFromLot, sourceFromParcel } from "@/lib/metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ bbl: string }> }) {
  const { bbl } = await ctx.params;
  if (!/^\d{10}$/.test(bbl)) return fail("BBL must be 10 digits");
  const origin = requestOrigin(req);
  try {
    const data = await getParcels();
    const parcel = data.parcels.find((p) => p.bbl === bbl);
    if (parcel) return json(buildMetadata(sourceFromParcel(parcel, parcel.verdict), origin), { headers: { "cache-control": "public, max-age=60" } });
    const [lot, verdict] = await Promise.all([plutoByBbl(bbl), getVerdictByBbl(bbl)]);
    if (!lot) return fail(`No parcel or PLUTO record for BBL ${bbl}`, 404);
    return json(buildMetadata(sourceFromLot(lot, verdict), origin), { headers: { "cache-control": "public, max-age=60" } });
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e), 502);
  }
}
