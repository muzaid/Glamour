import { createHash } from "node:crypto";
import { AppError, completeRenderJob, notFound } from "@glamotion/core";
import { api } from "@/server/api";
import { runtime } from "@/server/runtime";
import { requireWorker } from "../../../auth";

const MAX_BYTES = 80 * 1024 * 1024;
/** Upload rendered output to private storage, then mark the job complete. */
export const PUT = api<{ id: string }>(async (c, req, p) => {
  const w = requireWorker(req);
  const job = c.store.renderJobs.get(p.id);
  if (!job || job.lockedBy !== w) throw notFound("Render");
  if (req.headers.get("content-type") !== "video/webm") throw new AppError("VALIDATION_FAILED", "Only video/webm accepted");
  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) throw new AppError("VALIDATION_FAILED", "Invalid output size");
  // WebM/EBML magic number check
  if (!(buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3)) throw new AppError("VALIDATION_FAILED", "Not a WebM file");
  const seconds = Number(req.headers.get("x-render-seconds") ?? "0");
  const key = `renders/${job.organizationId}/${job.id}.webm`;
  await runtime().media.put(key, buf, "video/webm");
  const checksum = createHash("sha256").update(buf).digest("hex");
  completeRenderJob(c, job.id, w, { outputKey: key, checksum, seconds: Number.isFinite(seconds) ? seconds : 0, bytes: buf.byteLength });
  return { ok: true, checksum };
});
