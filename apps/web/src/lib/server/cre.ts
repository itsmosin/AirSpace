import "server-only";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { SERVER_ENV } from "./env";
import { appendLog, logPath, payloadPath, readLog, updateJob } from "@/lib/jobs";

const TX_RE = /explorer\.solana\.com\/tx\/([1-9A-HJ-NP-Za-km-z]{43,90})/;
// e.g. "Verdict 1008350041: status=1 confidence=9100 flags=0 unused=1234 value=432000"
const VERDICT_RE = /Verdict\s+(\d{10}):\s*status=(\d)[^\n]*/;
const JOB_TIMEOUT_MS = 8 * 60 * 1000;

export type CrePayload = {
  bbl: string;
  submitted?: { address?: string; ownerName?: string; lotAreaSqft?: number; builtAreaSqft?: number };
};

export function extractTxSignature(log: string): string | null {
  const m = log.match(TX_RE);
  return m ? m[1] : null;
}

export function extractVerdictLine(log: string): { line: string; bbl: string; status: number } | null {
  const m = log.match(VERDICT_RE);
  return m ? { line: m[0].trim(), bbl: m[1], status: Number(m[2]) } : null;
}

/** Spawn `cre workflow simulate … --broadcast` for the job and stream output to .data/logs/<jobId>.log. */
export function runCreVerification(jobId: string, payload: CrePayload) {
  const bin = SERVER_ENV.creBin;
  const cwd = SERVER_ENV.creDir;
  const ts = () => new Date().toISOString();

  appendLog(jobId, `[${ts()}] airspace: preparing Chainlink CRE verification for BBL ${payload.bbl}`);
  appendLog(jobId, `[${ts()}] airspace: cwd=${cwd}`);

  if (!fs.existsSync(bin)) {
    appendLog(jobId, `[${ts()}] error: CRE binary not found at ${bin} (set CRE_BIN)`);
    updateJob(jobId, { status: "failed", error: `CRE binary not found at ${bin}` });
    return;
  }
  if (!fs.existsSync(cwd)) {
    appendLog(jobId, `[${ts()}] error: CRE project directory not found at ${cwd} (set CRE_DIR)`);
    updateJob(jobId, { status: "failed", error: `CRE directory not found at ${cwd}` });
    return;
  }

  // The CRE CLI takes a plain file path for --http-payload.
  const payloadFile = payloadPath(jobId);
  fs.writeFileSync(payloadFile, JSON.stringify(payload, null, 2));
  appendLog(jobId, `[${ts()}] airspace: payload written to ${payloadFile}`);

  const args = [
    "workflow", "simulate", "./airspace-verifier",
    "--target", "staging-settings",
    "--non-interactive",
    "--trigger-index", "0",
    "--http-payload", payloadFile,
    "--broadcast",
  ];
  appendLog(jobId, `[${ts()}] $ cre ${args.map((a) => (a.includes(" ") ? JSON.stringify(a) : a)).join(" ")}`);

  let child;
  try {
    child = spawn(bin, args, { cwd, env: { ...process.env, CI: "1", NO_COLOR: "1" }, stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    appendLog(jobId, `[${ts()}] error: failed to spawn cre: ${msg}`);
    updateJob(jobId, { status: "failed", error: msg });
    return;
  }

  updateJob(jobId, { status: "running" });
  const out = fs.createWriteStream(logPath(jobId), { flags: "a" });
  child.stdout?.pipe(out, { end: false });
  child.stderr?.pipe(out, { end: false });

  let buffered = "";
  const watch = (chunk: Buffer) => {
    buffered += chunk.toString("utf8");
    const sig = extractTxSignature(buffered);
    const verdict = extractVerdictLine(buffered);
    if (sig || verdict) {
      updateJob(jobId, {
        ...(sig ? { txSignature: sig, explorerUrl: `https://explorer.solana.com/tx/${sig}?cluster=devnet` } : {}),
        ...(verdict ? { verdictLine: verdict.line, verdictStatus: verdict.status } : {}),
      });
      if (sig && verdict) buffered = "";
    }
    if (buffered.length > 64_000) buffered = buffered.slice(-16_000);
  };
  child.stdout?.on("data", watch);
  child.stderr?.on("data", watch);

  const timer = setTimeout(() => {
    appendLog(jobId, `[${ts()}] error: timed out after ${JOB_TIMEOUT_MS / 1000}s, killing cre`);
    child.kill("SIGKILL");
  }, JOB_TIMEOUT_MS);

  child.on("error", (err) => {
    clearTimeout(timer);
    appendLog(jobId, `[${ts()}] error: ${err.message}`);
    updateJob(jobId, { status: "failed", error: err.message });
    out.end();
  });

  child.on("close", (code) => {
    clearTimeout(timer);
    out.end();
    const log = readLog(jobId);
    const sig = extractTxSignature(log);
    const verdict = extractVerdictLine(log);
    const patch: Parameters<typeof updateJob>[1] = { exitCode: code };
    if (sig) {
      patch.txSignature = sig;
      patch.explorerUrl = `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
    }
    if (verdict) {
      patch.verdictLine = verdict.line;
      patch.verdictStatus = verdict.status;
    }
    if (code === 0 || sig) {
      appendLog(jobId, `[${ts()}] airspace: CRE run finished (exit ${code})${sig ? `, verdict tx ${sig}` : ""}`);
      updateJob(jobId, { ...patch, status: "done" });
    } else {
      appendLog(jobId, `[${ts()}] airspace: CRE run failed (exit ${code})`);
      updateJob(jobId, { ...patch, status: "failed", error: `cre exited with code ${code}` });
    }
  });
}
