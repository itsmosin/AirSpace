import "server-only";
import { Connection } from "@solana/web3.js";
import { SERVER_ENV } from "./env";

let cached: { url: string; connection: Connection } | null = null;

export function getServerConnection() {
  const url = SERVER_ENV.rpcUrl;
  if (!cached || cached.url !== url) cached = { url, connection: new Connection(url, { commitment: "confirmed" }) };
  return cached.connection;
}
