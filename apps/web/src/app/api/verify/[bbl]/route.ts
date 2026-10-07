import { fail, json } from "@/lib/server/http";
import { appendLog, latestJobForBbl, readLogTail, updateJob } from "@/lib/jobs";
import { getVerdictByBbl } from "@/lib/server/parcels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ bbl: string }> }) {
  const { bbl } = await ctx.params;
  if (!/^\d{10}$/.test(bbl)) return fail("BBL must be 10 digits");
  let job = latestJobForBbl(bbl);
  const verdict = await getVerdictByBbl(bbl);
  // Queued jobs complete when the on-chain verdict is recorded after the request.
  if (job && job.status === "queued" && verdict && verdict.status !== 0 && verdict.recordedAt * 1000 >= job.createdAt - 5000) {
    appendLog(job.id, `[${new Date().toISOString()}] airspace: verdict recorded on-chain (status ${verdict.status}, source ${verdict.source === 1 ? "Chainlink CRE" : "registrar"})`);
    job = updateJob(job.id, { status: "done" }) ?? job;
  }
  return json({
    job: job ? { ...job, log: readLogTail(job.id) } : null,
    verdict,
  });
}
