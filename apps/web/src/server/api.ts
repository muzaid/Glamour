import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, toErrorBody, type Ctx } from "@glamotion/core";
import { ctx as makeCtx, flushState } from "./runtime";

type Handler<P> = (c: Ctx, req: Request, params: P) => Promise<unknown> | unknown;

/**
 * Wraps a route handler: builds the request context, maps domain/validation
 * errors to the `{ error: { code, message, requestId, details } }` shape and
 * never leaks stack traces or internal identifiers.
 */
export function api<P = Record<string, string>>(fn: Handler<P>, opts: { status?: number } = {}) {
  return async (req: Request, routeCtx: { params: Promise<P> }) => {
    const c = await makeCtx();
    try {
      if (req.method !== "GET" && req.method !== "HEAD") assertSameOrigin(req);
      const result = await fn(c, req, (await routeCtx.params) as P);
      // Persist before responding so the next request (possibly on another instance) sees the change.
      await flushState();
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true }, { status: opts.status ?? 200, headers: { "x-request-id": c.requestId } });
    } catch (e) {
      const err = e instanceof ZodError
        ? new AppError("VALIDATION_FAILED", "Invalid request", { issues: e.issues.slice(0, 10).map((i) => ({ path: i.path.join("."), message: i.message })) })
        : e;
      if (!(err instanceof AppError)) console.error(JSON.stringify({ level: "error", requestId: c.requestId, msg: "unhandled", name: (e as Error)?.name }));
      const { status, body } = toErrorBody(err, c.requestId);
      return NextResponse.json(body, { status, headers: { "x-request-id": c.requestId } });
    }
  };
}

/** CSRF defence for cookie-authenticated mutations: require same-origin. */
function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients (no ambient cookies via CORS)
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (new URL(origin).host !== host) throw new AppError("FORBIDDEN", "Cross-origin request blocked");
}

export async function json(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > 512 * 1024) throw new AppError("VALIDATION_FAILED", "Payload too large");
  try { return text ? JSON.parse(text) : {}; } catch { throw new AppError("VALIDATION_FAILED", "Malformed JSON"); }
}

/** Read one image file from a multipart upload ("file" field), bounded before buffering. */
export async function imageUpload(req: Request): Promise<Uint8Array> {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > 4.2 * 1024 * 1024) throw new AppError("VALIDATION_FAILED", "Images must be smaller than 4 MB");
  let form: FormData;
  try { form = await req.formData(); } catch { throw new AppError("VALIDATION_FAILED", "Send the image as multipart/form-data"); }
  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) throw new AppError("VALIDATION_FAILED", "Choose an image file");
  if (file.size > 4 * 1024 * 1024) throw new AppError("VALIDATION_FAILED", "Images must be smaller than 4 MB");
  return new Uint8Array(await file.arrayBuffer());
}
