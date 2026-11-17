import { CreateRenderInput } from "@glamotion/contracts";
import { preflight } from "@glamotion/motion";
import type { Ctx } from "./context";
import { requireOrgCap, activeRoles } from "./context";
import { AppError, notFound } from "./errors";
import { newId, nowIso } from "./ids";
import { assertTransition, renderMachine } from "./state";
import { audit, emit } from "./audit";
import { isRevisionApproved } from "./agency";
import type { RenderJobRow } from "./store";

export function createRenderJob(ctx: Ctx, organizationId: string, raw: unknown, idempotencyKey: string | null) {
  const actor = requireOrgCap(ctx, organizationId, "render.create");
  if (!idempotencyKey || !/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey)) throw new AppError("VALIDATION_FAILED", "Idempotency-Key header required");
  const input = CreateRenderInput.parse(raw);
  const existing = [...ctx.store.renderJobs.values()].find((j) => j.organizationId === organizationId && j.idempotencyKey === idempotencyKey);
  if (existing) {
    if (existing.compositionId !== input.compositionId || existing.revision !== input.revision) throw new AppError("IDEMPOTENCY_REPLAY_MISMATCH", "Idempotency-Key reused with a different request");
    return { job: existing, replayed: true };
  }
  const comp = ctx.store.compositions.get(input.compositionId);
  if (!comp || comp.organizationId !== organizationId) throw notFound("Composition");
  const version = ctx.store.sceneVersions.find((v) => v.compositionId === comp.id && v.revision === input.revision);
  if (!version) throw notFound("Revision");
  const pf = preflight(version.doc);
  if (!pf.ok) throw new AppError("PREFLIGHT_FAILED", "Composition failed render preflight", { issues: pf.issues.filter((i) => i.level === "error") });
  // Quotas: concurrent jobs and rolling render-seconds budget.
  const active = [...ctx.store.renderJobs.values()].filter((j) => j.organizationId === organizationId && (j.status === "queued" || j.status === "running")).length;
  if (active >= ctx.config.maxActiveRendersPerOrg) throw new AppError("QUOTA_EXCEEDED", "Too many renders in progress for this workspace");
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const used = ctx.store.usage.filter((u) => u.organizationId === organizationId && u.kind === "render_seconds" && u.createdAt >= monthStart.toISOString()).reduce((n, u) => n + u.quantity, 0);
  if (used + pf.seconds > ctx.config.monthlyRenderSecondsPerOrg) throw new AppError("QUOTA_EXCEEDED", "Monthly render budget reached", { used, limit: ctx.config.monthlyRenderSecondsPerOrg });
  const now = nowIso();
  const job: RenderJobRow = {
    id: newId(), organizationId, compositionId: comp.id, revision: input.revision, status: "queued", quality: input.quality, idempotencyKey,
    attempts: 0, maxAttempts: 3, lockedBy: null, lockedAt: null, availableAt: now, progress: 0, outputKey: null, checksum: null, error: null,
    createdBy: actor.userId, createdAt: now, updatedAt: now,
  };
  ctx.store.renderJobs.set(job.id, job);
  emit(ctx, "render.queued.v1", organizationId, { renderJobId: job.id, compositionId: comp.id });
  audit(ctx, "render.queued", "render_job", job.id, organizationId, { revision: input.revision, frames: pf.frames });
  return { job, replayed: false };
}

export function getRenderJob(ctx: Ctx, organizationId: string, jobId: string) {
  requireOrgCap(ctx, organizationId, "org.read");
  const j = ctx.store.renderJobs.get(jobId);
  if (!j || j.organizationId !== organizationId) throw notFound("Render");
  const downloadUrl = j.status === "completed" && j.outputKey && ctx.media ? ctx.media.signDownload(j.outputKey, ctx.config.signedUrlTtlSeconds) : null;
  return { ...j, lockedBy: undefined, outputKey: undefined, downloadUrl, approved: isRevisionApproved(ctx, j.compositionId, j.revision) };
}

/** Lookup a render job by id across the caller's memberships (for /api/v1/renders/{id}). */
export function findRenderJobForActor(ctx: Ctx, jobId: string) {
  const j = ctx.store.renderJobs.get(jobId);
  if (!j || !ctx.actor || activeRoles(ctx, j.organizationId, ctx.actor.userId).length === 0) throw notFound("Render");
  return getRenderJob(ctx, j.organizationId, jobId);
}

export function cancelRenderJob(ctx: Ctx, organizationId: string, jobId: string) {
  requireOrgCap(ctx, organizationId, "render.create");
  const j = ctx.store.renderJobs.get(jobId);
  if (!j || j.organizationId !== organizationId) throw notFound("Render");
  j.status = assertTransition(renderMachine, j.status, "cancelled", "render");
  j.updatedAt = nowIso();
  audit(ctx, "render.cancelled", "render_job", j.id, organizationId);
  return j;
}

// ---------------------------------------------------- Worker-side operations (service credential)
const LEASE_MS = 60_000;

/** Idempotent claim with lease; expired leases are reclaimable. */
export function claimRenderJob(ctx: Ctx, workerId: string) {
  const now = Date.now();
  const candidates = [...ctx.store.renderJobs.values()]
    .filter((j) => (j.status === "queued" && j.availableAt <= new Date(now).toISOString()) || (j.status === "running" && j.lockedAt && Date.parse(j.lockedAt) + LEASE_MS < now))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const j = candidates[0];
  if (!j) return null;
  if (j.status === "queued") j.status = assertTransition(renderMachine, j.status, "running", "render");
  j.attempts += 1;
  j.lockedBy = workerId;
  j.lockedAt = new Date(now).toISOString();
  j.progress = 0;
  j.updatedAt = j.lockedAt;
  const doc = ctx.store.sceneVersions.find((v) => v.compositionId === j.compositionId && v.revision === j.revision)!.doc;
  // Worker re-validates tenant provenance: composition org must equal job org.
  if (ctx.store.compositions.get(j.compositionId)?.organizationId !== j.organizationId) {
    j.status = "failed"; j.error = "Tenant provenance mismatch"; return null;
  }
  return { jobId: j.id, organizationId: j.organizationId, attempt: j.attempts, quality: j.quality, composition: doc };
}

function workerJob(ctx: Ctx, jobId: string, workerId: string) {
  const j = ctx.store.renderJobs.get(jobId);
  if (!j || j.lockedBy !== workerId) throw notFound("Render");
  return j;
}

export function heartbeatRenderJob(ctx: Ctx, jobId: string, workerId: string, progress: number) {
  const j = workerJob(ctx, jobId, workerId);
  if (j.status !== "running") return { continue: false, status: j.status };
  j.progress = Math.max(0, Math.min(1, progress));
  j.lockedAt = nowIso();
  return { continue: true, status: j.status };
}

export function completeRenderJob(ctx: Ctx, jobId: string, workerId: string, args: { outputKey: string; checksum: string; seconds: number; bytes: number }) {
  const j = workerJob(ctx, jobId, workerId);
  if (j.status === "cancelled") return j;
  j.status = assertTransition(renderMachine, j.status, "completed", "render");
  j.outputKey = args.outputKey;
  j.checksum = args.checksum;
  j.progress = 1;
  j.lockedBy = null;
  j.updatedAt = nowIso();
  ctx.store.media.set(args.outputKey, { key: args.outputKey, organizationId: j.organizationId, ownerUserId: null, mime: "video/webm", bytes: args.bytes, checksum: args.checksum, privacyClass: "creative_private", createdAt: j.updatedAt });
  ctx.store.usage.push({ id: newId(), organizationId: j.organizationId, kind: "render_seconds", quantity: Math.ceil(args.seconds), refId: j.id, createdAt: j.updatedAt });
  emit(ctx, "render.completed.v1", j.organizationId, { renderJobId: j.id });
  if (isRevisionApproved(ctx, j.compositionId, j.revision) && j.quality === "final") {
    ctx.store.deliveries.push({ id: newId(), organizationId: j.organizationId, compositionId: j.compositionId, revision: j.revision, renderJobId: j.id, checksum: args.checksum, createdAt: j.updatedAt });
  }
  return j;
}

/** Retry with exponential backoff + jitter; terminal failure after maxAttempts with a human-readable error. */
export function failRenderJob(ctx: Ctx, jobId: string, workerId: string, message: string, retryable: boolean) {
  const j = workerJob(ctx, jobId, workerId);
  if (j.status !== "running") return j;
  j.lockedBy = null;
  j.updatedAt = nowIso();
  if (retryable && j.attempts < j.maxAttempts) {
    j.status = assertTransition(renderMachine, j.status, "queued", "render");
    const delay = 1000 * 2 ** j.attempts + Math.floor(Math.random() * 250);
    j.availableAt = new Date(Date.now() + delay).toISOString();
    j.error = `Retrying after error: ${message.slice(0, 200)}`;
  } else {
    j.status = assertTransition(renderMachine, j.status, "failed", "render");
    j.error = message.slice(0, 300);
    emit(ctx, "render.failed.v1", j.organizationId, { renderJobId: j.id });
  }
  return j;
}

export function listRenderJobs(ctx: Ctx, organizationId: string) {
  requireOrgCap(ctx, organizationId, "org.read");
  return [...ctx.store.renderJobs.values()].filter((j) => j.organizationId === organizationId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
