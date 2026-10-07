export class HttpError extends Error {
  constructor(message: string, readonly status: number, readonly body?: unknown) {
    super(message);
    this.name = "HttpError";
  }
}

export async function fetchJson<T>(input: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const { timeoutMs = 20000, ...rest } = init ?? {};
  const res = await fetch(input, { ...rest, signal: rest.signal ?? AbortSignal.timeout(timeoutMs), headers: { accept: "application/json", ...(rest.body ? { "content-type": "application/json" } : {}), ...(rest.headers ?? {}) } });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON body
  }
  if (!res.ok) {
    const msg = (body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string") ? (body as { error: string }).error : `${res.status} ${res.statusText}`;
    throw new HttpError(msg, res.status, body);
  }
  return body as T;
}

export const postJson = <T>(url: string, data: unknown, init?: RequestInit) => fetchJson<T>(url, { ...init, method: "POST", body: JSON.stringify(data) });
