import { hostname } from "node:os";
import { FrameRasterizer } from "./rasterizer";
import { renderComposition, RenderCancelled } from "./render";

/**
 * Render worker. Claims jobs from the web tier's internal API using a service
 * credential, renders in an isolated headless browser with resource caps,
 * uploads to private storage and reports completion. In production the same
 * loop claims via `app.claim_render_job()` in Postgres (ticket DM-008).
 */
const WEB = process.env.GLAMOTION_WEB_URL ?? "http://127.0.0.1:3000";
const TOKEN = process.env.WORKER_TOKEN ?? (process.env.NODE_ENV === "production" ? "" : "dev-only-worker_token-not-for-production");
const ID = (process.env.WORKER_ID ?? `w-${hostname()}`).toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 40);
const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 1000);
if (!TOKEN) throw new Error("WORKER_TOKEN is required");

const headers = { authorization: `Bearer ${TOKEN}`, "x-worker-id": ID };
const log = (msg: string, extra: Record<string, unknown> = {}) => console.log(JSON.stringify({ ts: new Date().toISOString(), worker: ID, msg, ...extra }));

async function call(path: string, init: RequestInit = {}) {
  const res = await fetch(`${WEB}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} → ${res.status} ${body?.error?.code ?? ""}`);
  return body;
}

let stopping = false;
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });

async function main() {
  const raster = new FrameRasterizer();
  log("worker started", { web: WEB });
  while (!stopping) {
    let job: { jobId: string; quality: "preview" | "final"; composition: unknown; attempt: number } | null = null;
    try { job = (await call("/api/internal/render-jobs/claim", { method: "POST" })).job; }
    catch (e) { log("claim failed", { error: (e as Error).message }); }
    if (!job) { await new Promise((r) => setTimeout(r, POLL_MS)); continue; }
    const started = Date.now();
    log("job claimed", { jobId: job.jobId, attempt: job.attempt });
    try {
      const out = await renderComposition(job.composition, job.quality, raster, async (p) => {
        const r = await call(`/api/internal/render-jobs/${job!.jobId}/heartbeat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ progress: p }) });
        return r.continue !== false;
      });
      await call(`/api/internal/render-jobs/${job.jobId}/output`, { method: "PUT", headers: { "content-type": "video/webm", "x-render-seconds": String(out.seconds) }, body: new Uint8Array(out.bytes) });
      log("job completed", { jobId: job.jobId, frames: out.frames, bytes: out.bytes.length, ms: Date.now() - started });
    } catch (e) {
      if (e instanceof RenderCancelled) { log("job cancelled", { jobId: job.jobId }); continue; }
      const message = (e as Error).message;
      const retryable = !/Preflight|cap exceeded|ZodError|Unsupported/.test(message);
      log("job failed", { jobId: job.jobId, error: message, retryable });
      await call(`/api/internal/render-jobs/${job.jobId}/fail`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: retryable ? "Rendering failed; retrying" : "Composition cannot be rendered — check render preflight", retryable }) }).catch(() => undefined);
    }
  }
  await raster.close();
  log("worker stopped");
}

main().catch((e) => { console.error(e); process.exit(1); });
