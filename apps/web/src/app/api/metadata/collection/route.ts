import { json, requestOrigin } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const origin = requestOrigin(req);
  return json({
    name: "AirSpace Air Rights",
    symbol: "AIR",
    description: "Verified, transferable development rights above New York City buildings. Each asset is a tax lot's unused floor area, audited by Chainlink CRE and settled on Solana.",
    image: `${origin}/api/og/collection`,
    external_url: origin,
    properties: { category: "image", files: [{ uri: `${origin}/api/og/collection`, type: "image/svg+xml" }] },
  });
}
