import { BriefInput, CommentInput, ApprovalInput, SaveCompositionInput, type MotionComposition, type ProjectStatus } from "@glamotion/contracts";
import { buildPreset, type PresetId } from "@glamotion/motion";
import type { Ctx } from "./context";
import { requireOrgCap } from "./context";
import { AppError, notFound } from "./errors";
import { newId, nowIso, sha256 } from "./ids";
import { assertTransition, projectMachine } from "./state";
import { audit, emit } from "./audit";
import { randomBytes } from "node:crypto";
import type { CompositionRow, ProjectRow, ReviewSessionRow } from "./store";

export function createProject(ctx: Ctx, organizationId: string, raw: unknown) {
  const actor = requireOrgCap(ctx, organizationId, "project.write");
  const brief = BriefInput.parse(raw);
  const clientName = typeof (raw as { clientName?: unknown }).clientName === "string" ? String((raw as { clientName: string }).clientName).slice(0, 120) : "Internal";
  const now = nowIso();
  const project: ProjectRow = { id: newId(), organizationId, name: brief.title, clientName, status: "intake", createdBy: actor.userId, createdAt: now };
  ctx.store.projects.set(project.id, project);
  ctx.store.briefs.set(project.id, { id: newId(), organizationId, projectId: project.id, input: brief, confirmedByClient: false, createdAt: now });
  audit(ctx, "project.created", "project", project.id, organizationId);
  return project;
}

function orgProject(ctx: Ctx, organizationId: string, projectId: string) {
  const p = ctx.store.projects.get(projectId);
  if (!p || p.organizationId !== organizationId) throw notFound("Project");
  return p;
}

export function listProjects(ctx: Ctx, organizationId: string) {
  requireOrgCap(ctx, organizationId, "org.read");
  return [...ctx.store.projects.values()].filter((p) => p.organizationId === organizationId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getProject(ctx: Ctx, organizationId: string, projectId: string) {
  requireOrgCap(ctx, organizationId, "org.read");
  const p = orgProject(ctx, organizationId, projectId);
  return {
    project: p,
    brief: ctx.store.briefs.get(p.id)?.input ?? null,
    compositions: [...ctx.store.compositions.values()].filter((c) => c.projectId === p.id),
  };
}

export function transitionProject(ctx: Ctx, organizationId: string, projectId: string, to: ProjectStatus) {
  requireOrgCap(ctx, organizationId, "project.write");
  const p = orgProject(ctx, organizationId, projectId);
  const from = p.status;
  p.status = assertTransition(projectMachine, p.status, to, "project");
  audit(ctx, "project.status_changed", "project", p.id, organizationId, { from, to });
  return p;
}

/** Create an editable composition from a preset for a published or draft product in the same org. */
export function createCompositionFromProduct(ctx: Ctx, organizationId: string, args: { productId: string; preset: PresetId; aspectRatio?: MotionComposition["aspectRatio"]; projectId?: string | null; tagline?: string; generatedBy?: "template" | "agent" }) {
  const actor = requireOrgCap(ctx, organizationId, "creative.write");
  const product = ctx.store.products.get(args.productId);
  if (!product || product.organizationId !== organizationId) throw notFound("Product");
  if (args.projectId) orgProject(ctx, organizationId, args.projectId);
  const variants = [...ctx.store.variants.values()].filter((v) => v.productId === product.id && v.active);
  const id = newId();
  const comp = buildPreset(args.preset, {
    id, title: `${product.title} — ${args.preset}`, brandName: ctx.store.brands.get(product.brandId)?.name ?? "",
    productTitle: product.title, category: product.category, tagline: args.tagline,
    shades: variants.map((v) => ({ productVariantId: v.id, name: v.shadeName, hex: v.hex })), aspectRatio: args.aspectRatio ?? "9:16",
  });
  if (args.generatedBy) comp.provenance.generatedBy = args.generatedBy;
  const now = nowIso();
  const row: CompositionRow = { id, organizationId, projectId: args.projectId ?? null, productId: product.id, title: comp.title, headRevision: 1, createdBy: actor.userId, createdAt: now, updatedAt: now };
  ctx.store.compositions.set(id, row);
  ctx.store.sceneVersions.push({ compositionId: id, organizationId, revision: 1, doc: comp, createdBy: actor.userId, createdAt: now });
  audit(ctx, "composition.created", "motion_composition", id, organizationId, { preset: args.preset });
  return { composition: row, doc: comp };
}

export function orgComposition(ctx: Ctx, organizationId: string, compositionId: string) {
  const c = ctx.store.compositions.get(compositionId);
  if (!c || c.organizationId !== organizationId) throw notFound("Composition");
  return c;
}

export function getComposition(ctx: Ctx, organizationId: string, compositionId: string, revision?: number) {
  requireOrgCap(ctx, organizationId, "org.read");
  const c = orgComposition(ctx, organizationId, compositionId);
  const rev = revision ?? c.headRevision;
  const v = ctx.store.sceneVersions.find((s) => s.compositionId === c.id && s.revision === rev);
  if (!v) throw notFound("Revision");
  return { composition: c, revision: rev, doc: v.doc };
}

/** Immutable versions + mutable head; stale baseRevision → 409 CONFLICT. */
export function saveCompositionRevision(ctx: Ctx, organizationId: string, compositionId: string, raw: unknown) {
  const actor = requireOrgCap(ctx, organizationId, "creative.write");
  const c = orgComposition(ctx, organizationId, compositionId);
  const input = SaveCompositionInput.parse(raw);
  if (input.baseRevision !== c.headRevision) throw new AppError("CONFLICT", "This composition changed since you opened it", { headRevision: c.headRevision });
  if (input.composition.id !== c.id) throw new AppError("VALIDATION_FAILED", "Composition id mismatch");
  c.headRevision += 1;
  c.updatedAt = nowIso();
  c.title = input.composition.title;
  ctx.store.sceneVersions.push({ compositionId: c.id, organizationId, revision: c.headRevision, doc: input.composition, createdBy: actor.userId, createdAt: c.updatedAt });
  return { revision: c.headRevision };
}

// ------------------------------------------------------------- Client review

/** Mint a scoped, expiring, revocable review link. Raw token returned once; only its hash is stored. */
export function requestReview(ctx: Ctx, organizationId: string, compositionId: string, args: { reviewerName: string; canApprove: boolean; revision?: number }) {
  const actor = requireOrgCap(ctx, organizationId, "review.request");
  const c = orgComposition(ctx, organizationId, compositionId);
  if (!c.projectId) throw new AppError("VALIDATION_FAILED", "Attach the composition to a project before requesting review");
  const project = ctx.store.projects.get(c.projectId)!;
  if (project.status === "intake") transitionProject(ctx, organizationId, project.id, "active");
  if (project.status === "active") transitionProject(ctx, organizationId, project.id, "review");
  const token = randomBytes(24).toString("base64url");
  const row: ReviewSessionRow = {
    id: newId(), organizationId, projectId: c.projectId, compositionId: c.id, revision: args.revision ?? c.headRevision, tokenHash: sha256(token),
    reviewerName: args.reviewerName.slice(0, 80), canApprove: args.canApprove, expiresAt: new Date(Date.now() + ctx.config.reviewLinkTtlHours * 3600_000).toISOString(),
    revokedAt: null, createdBy: actor.userId, createdAt: nowIso(),
  };
  ctx.store.reviewSessions.set(row.id, row);
  audit(ctx, "review.requested", "review_session", row.id, organizationId, { canApprove: args.canApprove, revision: row.revision });
  return { reviewSessionId: row.id, token, url: `/review/${token}`, expiresAt: row.expiresAt };
}

export function revokeReview(ctx: Ctx, organizationId: string, reviewSessionId: string) {
  requireOrgCap(ctx, organizationId, "review.request");
  const r = ctx.store.reviewSessions.get(reviewSessionId);
  if (!r || r.organizationId !== organizationId) throw notFound("Review");
  r.revokedAt = nowIso();
  audit(ctx, "review.revoked", "review_session", r.id, organizationId);
}

/** Token resolves to exactly one session; cannot enumerate other projects. */
export function resolveReviewToken(ctx: Ctx, token: string): ReviewSessionRow {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new AppError("REVIEW_LINK_INVALID", "This review link is invalid or has expired");
  const h = sha256(token);
  const r = [...ctx.store.reviewSessions.values()].find((x) => x.tokenHash === h);
  if (!r || r.revokedAt || r.expiresAt < nowIso()) throw new AppError("REVIEW_LINK_INVALID", "This review link is invalid or has expired");
  return r;
}

export function getReview(ctx: Ctx, token: string) {
  const r = resolveReviewToken(ctx, token);
  const v = ctx.store.sceneVersions.find((s) => s.compositionId === r.compositionId && s.revision === r.revision)!;
  const project = ctx.store.projects.get(r.projectId)!;
  return {
    session: { id: r.id, reviewerName: r.reviewerName, canApprove: r.canApprove, expiresAt: r.expiresAt, revision: r.revision },
    project: { name: project.name, status: project.status },
    doc: v.doc,
    annotations: ctx.store.annotations.filter((a) => a.compositionId === r.compositionId && a.revision === r.revision),
    approvals: ctx.store.approvals.filter((a) => a.compositionId === r.compositionId && a.revision === r.revision),
  };
}

export function addReviewComment(ctx: Ctx, token: string, raw: unknown) {
  const r = resolveReviewToken(ctx, token);
  const input = CommentInput.parse(raw);
  const row = { id: newId(), organizationId: r.organizationId, reviewSessionId: r.id, compositionId: r.compositionId, revision: r.revision, frame: input.frame ?? null, elementId: input.elementId ?? null, body: input.body, authorLabel: r.reviewerName, resolved: false, createdAt: nowIso() };
  ctx.store.annotations.push(row);
  return row;
}

/** Only designated approvers decide. Feedback never mutates source editor data. */
export function decideReview(ctx: Ctx, token: string, raw: unknown) {
  const r = resolveReviewToken(ctx, token);
  if (!r.canApprove) throw new AppError("FORBIDDEN", "This reviewer can comment but not approve");
  const input = ApprovalInput.parse(raw);
  const row = { id: newId(), organizationId: r.organizationId, compositionId: r.compositionId, revision: r.revision, reviewSessionId: r.id, decision: input.decision, actorLabel: r.reviewerName, note: input.note ?? null, createdAt: nowIso() };
  ctx.store.approvals.push(row);
  const project = ctx.store.projects.get(r.projectId)!;
  const target: ProjectStatus = input.decision === "approved" ? "approved" : "active";
  if (project.status === "review") {
    assertTransition(projectMachine, project.status, target, "project");
    project.status = target;
  }
  audit(ctx, `review.${input.decision}`, "approval", row.id, r.organizationId, { revision: r.revision, actor: r.reviewerName });
  if (input.decision === "approved") emit(ctx, "creative.approved.v1", r.organizationId, { compositionId: r.compositionId, revision: String(r.revision) });
  return row;
}

export function isRevisionApproved(ctx: Ctx, compositionId: string, revision: number): boolean {
  const decisions = ctx.store.approvals.filter((a) => a.compositionId === compositionId && a.revision === revision);
  const last = decisions[decisions.length - 1];
  return last?.decision === "approved";
}
