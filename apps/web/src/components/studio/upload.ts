"use client";
import type { ApiResult } from "../client";

/** Multipart image upload (PNG/JPEG/WebP ≤ 4 MB); the server re-checks the real file type. */
export async function uploadImage<T>(url: string, file: File): Promise<ApiResult<T>> {
  if (file.size > 4 * 1024 * 1024) return { ok: false, status: 413, error: { code: "VALIDATION_FAILED", message: "Images must be smaller than 4 MB" } };
  const body = new FormData();
  body.set("file", file);
  try {
    const res = await fetch(url, { method: "POST", body, credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, error: data.error ?? { code: "HTTP_" + res.status, message: "Upload failed" } };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, status: 0, error: { code: "NETWORK", message: "Upload failed. Check your connection and try again." } };
  }
}
