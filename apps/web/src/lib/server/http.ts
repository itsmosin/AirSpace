import "server-only";
import { NextResponse } from "next/server";

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { "cache-control": "no-store", ...(init?.headers ?? {}) } });
}

export function fail(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return json({ error: message, ...extra }, { status });
}

export function errorMessage(e: unknown) {
  if (e instanceof Error) {
    // Anchor wraps program errors with useful names; surface them.
    const anyErr = e as Error & { error?: { errorCode?: { code?: string }; errorMessage?: string }; logs?: string[] };
    const code = anyErr.error?.errorCode?.code;
    if (code) return `${code}: ${anyErr.error?.errorMessage ?? e.message}`;
    return e.message;
  }
  return String(e);
}

export function requestOrigin(req: Request) {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}
