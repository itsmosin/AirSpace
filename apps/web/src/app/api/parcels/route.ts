import { json } from "@/lib/server/http";
import { getParcels } from "@/lib/server/parcels";
import { PROGRAM_ID } from "@/lib/airspace/pdas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  try {
    const data = await getParcels(force);
    return json(data);
  } catch (e) {
    return json({
      programId: PROGRAM_ID.toBase58(), registry: null, parcels: [], pending: [],
      stats: { parcelsVerified: 0, parcelsMinted: 0, listed: 0, sqftTokenized: 0, totalValueUsd: 0 },
      updatedAt: Date.now(), error: e instanceof Error ? e.message : String(e),
    });
  }
}
