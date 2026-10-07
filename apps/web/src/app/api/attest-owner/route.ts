import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import { fail, json, errorMessage } from "@/lib/server/http";
import { SasUnavailableError, issueOwner } from "@/lib/sas";
import { plutoByBbl } from "@/lib/server/pluto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({ wallet: z.string().min(32), bbl: z.string().regex(/^\d{10}$/), docHash: z.string().optional() });

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

  // Mock title check: the lot must exist in PLUTO. A production flow would verify a deed / ACRIS record here.
  let ownerName = "";
  try {
    const lot = await plutoByBbl(parsed.data.bbl);
    if (!lot) return fail(`BBL ${parsed.data.bbl} is not a NYC tax lot`, 404);
    ownerName = lot.ownerName;
  } catch (e) {
    return fail(`Title check failed: ${errorMessage(e)}`, 502);
  }

  try {
    const res = await issueOwner(wallet, parsed.data.bbl);
    return json({ ...res, wallet: wallet.toBase58(), bbl: parsed.data.bbl, titleCheck: { ownerOfRecord: ownerName, docHash: parsed.data.docHash ?? null, status: "mock-passed" } });
  } catch (e) {
    if (e instanceof SasUnavailableError) return fail(e.message, 503);
    return fail(errorMessage(e), 502);
  }
}
