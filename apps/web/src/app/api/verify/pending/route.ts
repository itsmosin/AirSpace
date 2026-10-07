import { json } from "@/lib/server/http";
import { activeJobBbls } from "@/lib/jobs";
import { getParcels } from "@/lib/server/parcels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_AGE_SECS = 30;

export async function GET() {
  try {
    const data = await getParcels();
    const active = activeJobBbls();
    const now = Math.floor(Date.now() / 1000);
    const pending = data.pending
      .filter((v) => v.status === 0 && now - v.requestedAt >= MIN_AGE_SECS && !active.has(v.bbl))
      .map((v) => ({ bbl: v.bbl }));
    return json({ pending });
  } catch {
    return json({ pending: [] });
  }
}
