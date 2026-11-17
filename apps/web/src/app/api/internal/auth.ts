import "server-only";
import { timingSafeEqual } from "node:crypto";
import { AppError } from "@glamotion/core";
import { secret } from "@/server/runtime";

/** Service credential for the render worker. Never exposed to browsers. */
export function requireWorker(req: Request): string {
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret("WORKER_TOKEN")}`;
  if (auth.length !== expected.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) throw new AppError("UNAUTHENTICATED", "Worker credential required");
  const id = req.headers.get("x-worker-id") ?? "";
  if (!/^[a-z0-9-]{3,40}$/.test(id)) throw new AppError("VALIDATION_FAILED", "x-worker-id required");
  return id;
}
