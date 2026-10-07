import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CLUSTER = "devnet";

export function explorerAddress(address: string) {
  return `https://explorer.solana.com/address/${address}?cluster=${CLUSTER}`;
}
export function explorerTx(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=${CLUSTER}`;
}

export function shortAddress(address: string, chars = 4) {
  if (!address) return "";
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const num0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatUsd(value: number, cents = false) {
  if (!Number.isFinite(value)) return "—";
  return cents ? usd2.format(value) : usd0.format(value);
}

export function formatCompactUsd(value: number) {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return usd0.format(value);
}

export function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "—";
  return num0.format(value);
}

export function formatCompact(value: number) {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return num0.format(value);
}

export function formatSol(lamports: bigint | number) {
  const n = typeof lamports === "bigint" ? Number(lamports) : lamports;
  return `${(n / 1e9).toLocaleString("en-US", { maximumFractionDigits: 4 })} SOL`;
}

export function timeAgo(unixSeconds: number) {
  if (!unixSeconds) return "—";
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function formatDate(unixSeconds: number) {
  if (!unixSeconds) return "—";
  return new Date(unixSeconds * 1000).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function isBbl(value: string) {
  return /^\d{10}$/.test(value);
}

export function titleCase(s: string) {
  return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
