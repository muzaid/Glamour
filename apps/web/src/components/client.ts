"use client";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: { code: string; message: string; details?: Record<string, unknown> } };

function newKey() {
  return (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, "");
}

/** Fetch wrapper: JSON in/out, never throws on HTTP errors, surfaces network failures explicitly. */
export async function apiFetch<T = unknown>(url: string, opts: { method?: string; body?: unknown; idempotencyKey?: string | true } = {}): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.idempotencyKey) headers["idempotency-key"] = opts.idempotencyKey === true ? newKey() : opts.idempotencyKey;
  try {
    const res = await fetch(url, { method: opts.method ?? "GET", headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body), credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, error: data.error ?? { code: "HTTP_" + res.status, message: "Request failed" } };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, status: 0, error: { code: "NETWORK", message: "You appear to be offline. Check your connection and try again." } };
  }
}

export const money = (minor: number, currency: string) => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(minor / 100);
export { newKey };
