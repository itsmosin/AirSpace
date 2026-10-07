import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import { fail, json, errorMessage } from "@/lib/server/http";
import { registrarProgram } from "@/lib/server/registrar";
import { openVerdictIx } from "@/lib/airspace/instructions";
import { appendLog, createJob, latestJobForBbl } from "@/lib/jobs";
import { SERVER_ENV } from "@/lib/server/env";
import { runCreVerification } from "@/lib/server/cre";
import { invalidateParcels } from "@/lib/server/parcels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({
  bbl: z.string().regex(/^\d{10}$/, "BBL must be 10 digits"),
  wallet: z.string().min(32),
  submitted: z
    .object({ address: z.string().optional(), ownerName: z.string().optional(), lotAreaSqft: z.number().optional(), builtAreaSqft: z.number().optional() })
    .optional(),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = body.safeParse(await req.json());
  } catch {
    return fail("Invalid JSON body");
  }
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { bbl, wallet, submitted } = parsed.data;
  try {
    new PublicKey(wallet);
  } catch {
    return fail("Invalid wallet address");
  }

  // Idempotent: reuse an in-flight job for the same BBL.
  const existing = latestJobForBbl(bbl);
  if (existing && (existing.status === "queued" || existing.status === "running") && Date.now() - existing.updatedAt < 10 * 60 * 1000) {
    return json({ jobId: existing.id, bbl, status: existing.status, reused: true });
  }

  let openVerdictTx: string | undefined;
  try {
    const { registrar, program } = registrarProgram();
    openVerdictTx = await openVerdictIx(program, { payer: registrar.publicKey, bbl }).rpc();
    invalidateParcels();
  } catch (e) {
    const msg = errorMessage(e);
    const status = /VerdictLocked/.test(msg) ? 409 : /Registrar keypair/.test(msg) ? 503 : 502;
    return fail(`open_verdict failed: ${msg}`, status);
  }

  const job = createJob({ bbl, wallet, openVerdictTx });
  if (SERVER_ENV.hosted) {
    // Hosted mode: the Chainlink CRE cron handler polls /api/verify/pending and writes the verdict on-chain.
    const ts = new Date().toISOString();
    appendLog(job.id, `[${ts}] airspace: verdict account opened on devnet (${openVerdictTx})`);
    appendLog(job.id, `[${ts}] airspace: queued for the Chainlink CRE verifier sweep (polls every 60 s)`);
    appendLog(job.id, `[${ts}] airspace: the workflow fetches the NYC PLUTO record, audits it inside a TEE, and signs a VerdictReport`);
    appendLog(job.id, `[${ts}] airspace: this page refreshes automatically when the verdict lands`);
    return json({ jobId: job.id, bbl, status: "queued", openVerdictTx, mode: "queue" });
  }
  // Fire and forget; progress is tracked in .data/jobs.json and .data/logs/<jobId>.log
  runCreVerification(job.id, { bbl, submitted });
  return json({ jobId: job.id, bbl, status: "queued", openVerdictTx, mode: "local" });
}
