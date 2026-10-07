// Pyth PriceUpdateV2 parsing, byte-for-byte identical to the program (docs/INTERFACES.md section 7).
import { PublicKey, type Connection } from "@solana/web3.js";
import { PYTH_RECEIVER_PROGRAM_ID, PYTH_SOL_USD_FEED_ID, PYTH_SOL_USD_PRICE_ACCOUNT } from "@airspace/shared";

export const PYTH_RECEIVER = new PublicKey(PYTH_RECEIVER_PROGRAM_ID);
export const SOL_USD_PRICE_ACCOUNT = new PublicKey(PYTH_SOL_USD_PRICE_ACCOUNT);

export type PriceUpdate = {
  feedId: string; // 0x-prefixed hex
  price: bigint;
  conf: bigint;
  exponent: number;
  publishTime: number;
  prevPublishTime: number;
  emaPrice: bigint;
  emaConf: bigint;
  postedSlot: bigint;
  verificationLevel: "partial" | "full";
  /** price * 10^exponent as a JS number (display only) */
  priceUsd: number;
};

export function parsePriceUpdateV2(raw: Uint8Array): PriceUpdate {
  const buf = Buffer.from(raw);
  if (buf.length < 41 + 32 + 8 + 8 + 4 + 8 + 8 + 8 + 8 + 8) throw new Error("Price account too small");
  // [0..8] discriminator, [8..40] write_authority, [40] verification level tag
  const tag = buf[40];
  let o = tag === 0 ? 42 : 41; // Partial carries num_signatures u8 at [41]
  const feedId = "0x" + buf.subarray(o, o + 32).toString("hex"); o += 32;
  const price = buf.readBigInt64LE(o); o += 8;
  const conf = buf.readBigUInt64LE(o); o += 8;
  const exponent = buf.readInt32LE(o); o += 4;
  const publishTime = Number(buf.readBigInt64LE(o)); o += 8;
  const prevPublishTime = Number(buf.readBigInt64LE(o)); o += 8;
  const emaPrice = buf.readBigInt64LE(o); o += 8;
  const emaConf = buf.readBigUInt64LE(o); o += 8;
  const postedSlot = buf.readBigUInt64LE(o);
  return {
    feedId, price, conf, exponent, publishTime, prevPublishTime, emaPrice, emaConf, postedSlot,
    verificationLevel: tag === 0 ? "partial" : "full",
    priceUsd: Number(price) * Math.pow(10, exponent),
  };
}

/** lamports = price_usd_cents * 10^9 * 10^(-exponent) / (100 * price), computed in big integers like the program. */
export function usdCentsToLamports(priceUsdCents: bigint, price: bigint, exponent: number): bigint {
  if (price <= 0n) throw new Error("Invalid price");
  const scale = 10n ** BigInt(-exponent); // exponent is negative (e.g. -8)
  return (priceUsdCents * 1_000_000_000n * scale) / (100n * price);
}

export type SolPrice = PriceUpdate & { ageSecs: number; stale: boolean; account: string };

export async function fetchSolUsd(connection: Connection, maxAgeSecs = 3600): Promise<SolPrice> {
  const info = await connection.getAccountInfo(SOL_USD_PRICE_ACCOUNT);
  if (!info) throw new Error("Pyth SOL/USD price account not found");
  if (!info.owner.equals(PYTH_RECEIVER)) throw new Error("Price account is not owned by the Pyth receiver");
  const parsed = parsePriceUpdateV2(info.data);
  if (parsed.feedId.toLowerCase() !== PYTH_SOL_USD_FEED_ID.toLowerCase()) throw new Error("Unexpected price feed id");
  const ageSecs = Math.max(0, Math.floor(Date.now() / 1000) - parsed.publishTime);
  return { ...parsed, ageSecs, stale: ageSecs > maxAgeSecs, account: SOL_USD_PRICE_ACCOUNT.toBase58() };
}
