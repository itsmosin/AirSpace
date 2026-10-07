import { fail, json } from "@/lib/server/http";
import { latestJobForBbl, readLogTail } from "@/lib/jobs";
import { getVerdictByBbl } from "@/lib/server/parcels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ bbl: string }> }) {
  const { bbl } = await ctx.params;
  if (!/^\d{10}$/.test(bbl)) return fail("BBL must be 10 digits");
  const job = latestJobForBbl(bbl);
  const verdict = await getVerdictByBbl(bbl);
  return json({
    job: job ? { ...job, log: readLogTail(job.id) } : null,
    verdict,
  });
}
