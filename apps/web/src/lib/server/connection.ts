import "server-only";
import { Connection } from "@solana/web3.js";
import { SERVER_ENV } from "./env";
import { createThrottledFetch } from "@/lib/rpcFetch";

const throttledFetch = createThrottledFetch(6);

let cached: { url: string; connection: Connection } | null = null;

export function getServerConnection() {
  const url = SERVER_ENV.rpcUrl;
  if (!cached || cached.url !== url) cached = { url, connection: new Connection(url, { commitment: "confirmed", fetch: throttledFetch }) };
  return cached.connection;
}
