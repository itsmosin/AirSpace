import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import { fail, json, errorMessage } from "@/lib/server/http";
import { SasUnavailableError, issueKyc } from "@/lib/sas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({ wallet: z.string().min(32), level: z.number().int().min(1).max(3).default(1) });

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = body.safeParse(await req.json());
  } catch {
    return fail("Invalid JSON body");
  }
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  let wallet: PublicKey;
  try {
    wallet = new PublicKey(parsed.data.wallet);
  } catch {
    return fail("Invalid wallet address");
  }
  try {
    const res = await issueKyc(wallet, parsed.data.level);
    return json({ ...res, wallet: wallet.toBase58(), level: parsed.data.level });
  } catch (e) {
    if (e instanceof SasUnavailableError) return fail(e.message, 503);
    return fail(errorMessage(e), 502);
  }
}
