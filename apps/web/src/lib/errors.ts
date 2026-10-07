/** Human-readable message for wallet / Anchor / RPC errors. */
export function describeError(e: unknown): string {
  if (!e) return "Unknown error";
  const err = e as { message?: string; name?: string; error?: { errorCode?: { code?: string }; errorMessage?: string }; logs?: string[]; code?: number };
  const code = err.error?.errorCode?.code;
  if (code) return `${code}${err.error?.errorMessage ? ` — ${err.error.errorMessage}` : ""}`;
  const msg = err.message ?? String(e);
  if (/user rejected|rejected the request|WalletSignTransactionError/i.test(msg)) return "Transaction rejected in wallet.";
  if (/insufficient (lamports|funds)/i.test(msg) || /0x1\b/.test(msg)) return "Insufficient SOL for this transaction. Airdrop some devnet SOL and retry.";
  if (/AccountNotInitialized|could not find account|Account does not exist/i.test(msg)) return "A required on-chain account does not exist yet.";
  if (/blockhash not found|block height exceeded/i.test(msg)) return "The network dropped the transaction. Please retry.";
  const custom = msg.match(/custom program error: 0x([0-9a-f]+)/i);
  if (custom) return `Program error 0x${custom[1]} (${parseInt(custom[1], 16)}).`;
  if (err.logs?.length) {
    const line = err.logs.find((l) => /Error|failed/i.test(l));
    if (line) return `${msg} — ${line}`;
  }
  return msg.length > 220 ? msg.slice(0, 220) + "…" : msg;
}
