import { z } from "zod";
import { fail, json, errorMessage } from "@/lib/server/http";
import { plutoByAddress, plutoByBbl, plutoNearest } from "@/lib/server/pluto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bblSchema = z.string().regex(/^\d{10}$/, "BBL must be 10 digits");

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bbl = url.searchParams.get("bbl");
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");
  const address = url.searchParams.get("address");

  try {
    if (bbl) {
      const parsed = bblSchema.safeParse(bbl.trim());
      if (!parsed.success) return fail(parsed.error.issues[0].message);
      const lot = await plutoByBbl(parsed.data);
      if (!lot) return fail(`No PLUTO record for BBL ${parsed.data}`, 404);
      return json({ lot, method: "bbl" });
    }
    if (lat && lng) {
      const la = Number(lat), ln = Number(lng);
      if (!Number.isFinite(la) || !Number.isFinite(ln)) return fail("lat/lng must be numbers");
      const lot = await plutoNearest(la, ln);
      if (!lot) return fail("No tax lot found near that point", 404);
      return json({ lot, method: "nearest" });
    }
    if (address) {
      const q = address.trim();
      if (q.length < 3) return fail("Address is too short");
      const res = await plutoByAddress(q);
      if (!res.lot) return fail(`Could not match "${q}" to a NYC tax lot${res.method === "pluto-text" ? " (set MAPBOX_TOKEN for geocoded search, or enter the BBL directly)" : ""}`, 404);
      return json({ lot: res.lot, geocode: res.geocode, method: res.method });
    }
    return fail("Provide ?bbl=, ?lat=&lng= or ?address=");
  } catch (e) {
    return fail(errorMessage(e), 502);
  }
}
