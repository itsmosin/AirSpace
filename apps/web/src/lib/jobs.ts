import "server-only";
import fs from "node:fs";
import path from "node:path";
import { SERVER_ENV } from "@/lib/server/env";
import type { JobStatus, VerifyJob } from "@/lib/airspace/types";

type Store = { jobs: Record<string, VerifyJob> };

function paths() {
  const dir = SERVER_ENV.dataDir;
  return { dir, logs: path.join(dir, "logs"), file: path.join(dir, "jobs.json") };
}

function ensureDirs() {
  const p = paths();
  fs.mkdirSync(p.logs, { recursive: true });
  return p;
}

function readStore(): Store {
  const p = ensureDirs();
  try {
    const raw = fs.readFileSync(p.file, "utf8");
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === "object" && parsed.jobs ? parsed : { jobs: {} };
  } catch {
    return { jobs: {} };
  }
}

function writeStore(store: Store) {
  const p = ensureDirs();
  const tmp = `${p.file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, p.file);
}

export function newJobId() {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createJob(input: { bbl: string; wallet: string; openVerdictTx?: string }): VerifyJob {
  const store = readStore();
  const now = Date.now();
  const job: VerifyJob = { id: newJobId(), bbl: input.bbl, wallet: input.wallet, status: "queued", createdAt: now, updatedAt: now, openVerdictTx: input.openVerdictTx };
  store.jobs[job.id] = job;
  writeStore(store);
  return job;
}

export function updateJob(id: string, patch: Partial<VerifyJob>): VerifyJob | null {
  const store = readStore();
  const job = store.jobs[id];
  if (!job) return null;
  const next = { ...job, ...patch, updatedAt: Date.now() };
  store.jobs[id] = next;
  writeStore(store);
  return next;
}

export function getJob(id: string): VerifyJob | null {
  return readStore().jobs[id] ?? null;
}

export function latestJobForBbl(bbl: string): VerifyJob | null {
  const jobs = Object.values(readStore().jobs).filter((j) => j.bbl === bbl);
  jobs.sort((a, b) => b.createdAt - a.createdAt);
  return jobs[0] ?? null;
}

export function activeJobBbls(): Set<string> {
  const active: JobStatus[] = ["queued", "running"];
  return new Set(Object.values(readStore().jobs).filter((j) => active.includes(j.status)).map((j) => j.bbl));
}

export function listJobs(limit = 50): VerifyJob[] {
  return Object.values(readStore().jobs).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

export function logPath(jobId: string) {
  return path.join(ensureDirs().logs, `${jobId}.log`);
}

export function appendLog(jobId: string, line: string) {
  fs.appendFileSync(logPath(jobId), line.endsWith("\n") ? line : line + "\n");
}

export function readLogTail(jobId: string, maxLines = 160): string {
  try {
    const raw = fs.readFileSync(logPath(jobId), "utf8");
    const lines = raw.split("\n");
    return lines.slice(Math.max(0, lines.length - maxLines)).join("\n");
  } catch {
    return "";
  }
}

export function readLog(jobId: string): string {
  try {
    return fs.readFileSync(logPath(jobId), "utf8");
  } catch {
    return "";
  }
}
