// Public (browser-safe) environment. Server-only values live in src/lib/server/env.ts.
import { AIRSPACE_PROGRAM_ID, DEVNET_RPC } from "@airspace/shared";

export const PUBLIC_ENV = {
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || DEVNET_RPC,
  programId: process.env.NEXT_PUBLIC_PROGRAM_ID || AIRSPACE_PROGRAM_ID,
  mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "",
};
