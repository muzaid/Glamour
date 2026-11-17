import { CreateCampaignInput, WorkflowApproveInput } from "@glamotion/contracts";
import {
  AppError, notFound, requireOrgCap, newId, nowIso, sha256, audit, emit, assertTransition, workflowMachine, campaignMachine,
  createCompositionFromProduct, createRenderJob, getComposition, type Ctx, type LanguageModelProvider, type WorkflowRow, type StepRow, type CampaignRow,
} from "@glamotion/core";
import { preflight, type PresetId } from "@glamotion/motion";
import { AGENTS, type AgentId, type AgentOutput } from "./prompts";
import { deterministicCompliance } from "./policy";

export interface OrchestratorDeps { llm: LanguageModelProvider; maxRetries?: number; dailyTokenQuota?: number }

const STEP_ORDER = ["brief_interpreter", "creative_director", "gate:select_direction", "art_director", "copywriter", "motion_director", "assemble", "compliance_reviewer", "qa_evaluator", "gate:approve_output", "render"] as const;
type StepKey = (typeof STEP_ORDER)[number];

interface WfState {
  campaignId: string; productId: string; input: CreateCampaignInput; cursor: number;
  outputs: Partial<Record<AgentId, unknown>>; selectedConceptId?: string; compositionId?: string; renderJobId?: string; complianceBlocked?: boolean;
}

function wfState(w: WorkflowRow) { return w.state as unknown as WfState; }

function setWf(ctx: Ctx, w: WorkflowRow, to: WorkflowRow["status"]) {
  const from = w.status;
  if (from === to) return;
  w.status = assertTransition(workflowMachine, from, to, "workflow");
  w.updatedAt = nowIso();
  audit(ctx, "workflow.status_changed", "ai_workflow", w.id, w.organizationId, { from, to });
}
function setCampaign(ctx: Ctx, c: CampaignRow, to: string) {
  if (c.status === to) return;
  c.status = assertTransition(campaignMachine as Record<string, readonly string[]>, c.status, to, "campaign");
}

function productPayload(ctx: Ctx, productId: string) {
  const p = ctx.store.products.get(productId)!;
  const variants = [...ctx.store.variants.values()].filter((v) => v.productId === p.id && v.active);
  // Only catalog metadata — never customer images, landmarks or personal data.
  return { title: p.title, brandName: ctx.store.brands.get(p.brandId)?.name ?? "", category: p.category, description: p.description, shades: variants.map((v) => ({ name: v.shadeName, hex: v.hex })) };
}

/** WF-01 Product-to-campaign. Creates the campaign + workflow and runs until the first human gate. */
export async function startProductCampaign(ctx: Ctx, deps: OrchestratorDeps, organizationId: string, raw: unknown) {
  const actor = requireOrgCap(ctx, organizationId, "campaign.write");
  const input = CreateCampaignInput.parse(raw);
  const product = ctx.store.products.get(input.productId);
  if (!product || product.organizationId !== organizationId) throw notFound("Product");
  if (product.status !== "published") throw new AppError("VALIDATION_FAILED", "Publish the product before generating a campaign");
  const now = nowIso();
  const campaign: CampaignRow = { id: newId(), organizationId, productId: product.id, name: input.name, status: "brief", workflowId: null, compositionId: null, createdBy: actor.userId, createdAt: now, input: input as unknown as Record<string, unknown> };
  const wf: WorkflowRow = {
    id: newId(), organizationId, kind: "WF-01", status: "proposed", invokedBy: actor.userId, correlationId: ctx.requestId,
    state: { campaignId: campaign.id, productId: product.id, input, cursor: 0, outputs: {} } satisfies WfState as unknown as Record<string, unknown>,
    tokensUsed: 0, maxTokens: 60_000, createdAt: now, updatedAt: now,
  };
  campaign.workflowId = wf.id;
  ctx.store.campaigns.set(campaign.id, campaign);
  ctx.store.workflows.set(wf.id, wf);
  audit(ctx, "campaign.created", "campaign", campaign.id, organizationId);
  setWf(ctx, wf, "queued");
  await advance(ctx, deps, wf);
  return { campaign, workflow: wf };
}

function tenantTokensToday(ctx: Ctx, organizationId: string) {
  const day = nowIso().slice(0, 10);
  return ctx.store.usage.filter((u) => u.organizationId === organizationId && u.kind === "llm_tokens" && u.createdAt.startsWith(day)).reduce((n, u) => n + u.quantity, 0);
}

async function runAgent<A extends AgentId>(ctx: Ctx, deps: OrchestratorDeps, wf: WorkflowRow, agent: A, input: unknown): Promise<AgentOutput<A> | null> {
  const def = AGENTS[agent];
  const step: StepRow = { id: newId(), workflowId: wf.id, organizationId: wf.organizationId, key: agent, agent, status: "running", attempts: 0, inputHash: sha256(JSON.stringify(input)), outputHash: null, error: null, startedAt: nowIso(), finishedAt: null };
  ctx.store.steps.push(step);
  const maxRetries = deps.maxRetries ?? 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    step.attempts = attempt + 1;
    if (wf.tokensUsed >= wf.maxTokens || tenantTokensToday(ctx, wf.organizationId) >= (deps.dailyTokenQuota ?? 500_000)) {
      step.status = "failed"; step.error = "Token budget exhausted"; step.finishedAt = nowIso();
      throw new AppError("QUOTA_EXCEEDED", "AI budget reached for this workflow or workspace");
    }
    try {
      const res = await deps.llm.complete({ promptId: agent, promptVersion: def.version, system: def.system, input, jsonSchemaHint: agent, requestId: ctx.requestId, organizationId: wf.organizationId, maxTokens: 4000 });
      const used = res.inputTokens + res.outputTokens;
      wf.tokensUsed += used;
      ctx.store.usage.push({ id: newId(), organizationId: wf.organizationId, kind: "llm_tokens", quantity: used, refId: step.id, createdAt: nowIso() });
      const parsed = def.schema.safeParse(res.output);
      if (!parsed.success) { step.error = `Schema validation failed (attempt ${attempt + 1})`; continue; }
      step.status = "completed"; step.outputHash = sha256(JSON.stringify(parsed.data)); step.finishedAt = nowIso(); step.error = null;
      ctx.store.artifacts.push({ id: newId(), workflowId: wf.id, stepKey: agent, organizationId: wf.organizationId, promptId: agent, promptVersion: def.version, output: parsed.data, createdAt: nowIso() });
      return parsed.data as AgentOutput<A>;
    } catch (e) {
      if (e instanceof AppError && e.code === "QUOTA_EXCEEDED") throw e;
      step.error = `Provider error (attempt ${attempt + 1})`;
    }
  }
  // Schema-invalid or failing AI output → safe needs_review state, never public release.
  step.status = "needs_review"; step.finishedAt = nowIso();
  return null;
}

function openGate(ctx: Ctx, wf: WorkflowRow, gateId: string) {
  if (!ctx.store.humanApprovals.some((h) => h.workflowId === wf.id && h.gateId === gateId && h.status === "pending")) {
    ctx.store.humanApprovals.push({ id: newId(), workflowId: wf.id, organizationId: wf.organizationId, gateId, status: "pending", decidedBy: null, selection: null, note: null, createdAt: nowIso(), decidedAt: null });
  }
  setWf(ctx, wf, "awaiting_human");
}

async function advance(ctx: Ctx, deps: OrchestratorDeps, wf: WorkflowRow) {
  const st = wfState(wf);
  const campaign = ctx.store.campaigns.get(st.campaignId)!;
  if (wf.status === "queued" || wf.status === "awaiting_human") setWf(ctx, wf, "running");
  const product = productPayload(ctx, st.productId);
  // Hard stop condition: the DAG is finite; at most STEP_ORDER.length iterations.
  for (let guard = 0; guard < STEP_ORDER.length + 1 && st.cursor < STEP_ORDER.length; guard++) {
    const key: StepKey = STEP_ORDER[st.cursor]!;
    const fail = (msg: string) => { setWf(ctx, wf, "failed"); audit(ctx, "workflow.needs_review", "ai_workflow", wf.id, wf.organizationId, { step: key, reason: msg }); };
    let out: unknown;
    try {
      switch (key) {
        case "brief_interpreter":
          out = await runAgent(ctx, deps, wf, key, { product, objective: st.input.objective, platform: st.input.platform });
          setCampaign(ctx, campaign, "proposals");
          break;
        case "creative_director":
          out = await runAgent(ctx, deps, wf, key, { product, brief: st.outputs.brief_interpreter, objective: st.input.objective });
          break;
        case "gate:select_direction":
          openGate(ctx, wf, key);
          emit(ctx, "campaign.approval_requested.v1", wf.organizationId, { campaignId: campaign.id, gate: key });
          return;
        case "art_director":
        case "copywriter":
        case "motion_director": {
          const concept = (st.outputs.creative_director as AgentOutput<"creative_director">).concepts.find((c) => c.id === st.selectedConceptId);
          out = await runAgent(ctx, deps, wf, key, { product, concept, locales: st.input.locales, aspectRatio: st.input.aspectRatio });
          if (key === "art_director") setCampaign(ctx, campaign, "editing");
          break;
        }
        case "assemble": {
          // Code (not the model) compiles the chosen preset into an editable, schema-validated composition.
          const motion = st.outputs.motion_director as AgentOutput<"motion_director">;
          const copy = st.outputs.copywriter as AgentOutput<"copywriter">;
          const { composition } = createCompositionFromProduct({ ...ctx, actor: { userId: wf.invokedBy } }, wf.organizationId, {
            productId: st.productId, preset: motion.preset as PresetId, aspectRatio: st.input.aspectRatio, tagline: copy.tagline, generatedBy: "agent",
          });
          const pf = preflight(getComposition({ ...ctx, actor: { userId: wf.invokedBy } }, wf.organizationId, composition.id).doc);
          if (!pf.ok) { fail("preflight"); return; }
          st.compositionId = composition.id;
          campaign.compositionId = composition.id;
          out = { compositionId: composition.id };
          setCampaign(ctx, campaign, "compliance_check");
          break;
        }
        case "compliance_reviewer": {
          const copy = st.outputs.copywriter as AgentOutput<"copywriter">;
          const llmReview = await runAgent(ctx, deps, wf, key, { copy, product });
          // Deterministic rules run independently of the model and can only make the result stricter.
          const rules = deterministicCompliance([copy?.headline, copy?.caption, copy?.tagline, ...Object.values(copy?.localized ?? {}).flatMap((l) => [l.tagline, l.caption])].filter(Boolean) as string[], product.description);
          const decision = rules.blockers.length > 0 ? "block" : llmReview?.decision ?? "needs_review";
          st.complianceBlocked = decision !== "allow";
          out = { decision, findings: [...(llmReview?.findings ?? []), ...rules.blockers.map((t) => ({ severity: "blocker", text: t })), ...rules.warnings.map((t) => ({ severity: "warning", text: t }))] };
          break;
        }
        case "qa_evaluator":
          out = await runAgent(ctx, deps, wf, key, { product, concept: st.selectedConceptId, copy: st.outputs.copywriter, motion: st.outputs.motion_director });
          setCampaign(ctx, campaign, "human_approval");
          break;
        case "gate:approve_output":
          openGate(ctx, wf, key);
          emit(ctx, "campaign.approval_requested.v1", wf.organizationId, { campaignId: campaign.id, gate: key });
          return;
        case "render": {
          const comp = ctx.store.compositions.get(st.compositionId!)!;
          const { job } = createRenderJob({ ...ctx, actor: { userId: wf.invokedBy } }, wf.organizationId, { compositionId: comp.id, revision: comp.headRevision, quality: "final" }, `wf-${wf.id}`);
          st.renderJobId = job.id;
          out = { renderJobId: job.id };
          break;
        }
      }
    } catch (e) {
      if (e instanceof AppError && e.code === "QUOTA_EXCEEDED") { fail("quota"); return; }
      throw e;
    }
    if (out === null) { fail("schema"); return; }
    if (key in AGENTS) st.outputs[key as AgentId] = out;
    st.cursor++;
  }
  setWf(ctx, wf, "completed");
}

/** Resume a gated workflow. Only an authorised human (workflow.approve) can decide. */
export async function decideWorkflowGate(ctx: Ctx, deps: OrchestratorDeps, workflowId: string, raw: unknown) {
  const wf = ctx.store.workflows.get(workflowId);
  if (!wf) throw notFound("Workflow");
  const actor = requireOrgCap(ctx, wf.organizationId, "workflow.approve");
  const input = WorkflowApproveInput.parse(raw);
  const gate = ctx.store.humanApprovals.find((h) => h.workflowId === wf.id && h.gateId === input.gateId && h.status === "pending");
  if (!gate || wf.status !== "awaiting_human") throw new AppError("INVALID_TRANSITION", "No pending approval for this step");
  const st = wfState(wf);
  const campaign = ctx.store.campaigns.get(st.campaignId)!;
  gate.decidedBy = actor.userId; gate.decidedAt = nowIso(); gate.note = input.note ?? null;
  if (input.decision === "reject") {
    gate.status = "rejected";
    // Rejection routes to manual editor revision with audit trail — no automatic indefinite regeneration.
    setWf(ctx, wf, "cancelled");
    if (campaign.status === "human_approval") setCampaign(ctx, campaign, "editing");
    audit(ctx, "workflow.gate_rejected", "ai_workflow", wf.id, wf.organizationId, { gate: input.gateId });
    return wf;
  }
  if (input.gateId === "gate:select_direction") {
    const concepts = (st.outputs.creative_director as AgentOutput<"creative_director">).concepts;
    if (!input.selection || !concepts.some((c) => c.id === input.selection)) throw new AppError("VALIDATION_FAILED", "Select one of the proposed concepts");
    st.selectedConceptId = input.selection;
    gate.selection = input.selection;
  }
  if (input.gateId === "gate:approve_output" && st.complianceBlocked) {
    throw new AppError("FORBIDDEN", "Compliance found blocking issues. Edit the copy or composition before approving.");
  }
  gate.status = "approved";
  if (input.gateId === "gate:approve_output") setCampaign(ctx, campaign, "approved");
  audit(ctx, "workflow.gate_approved", "ai_workflow", wf.id, wf.organizationId, { gate: input.gateId, selection: input.selection ?? null });
  st.cursor++;
  await advance(ctx, deps, wf);
  return wf;
}

export function getWorkflowView(ctx: Ctx, workflowId: string) {
  const wf = ctx.store.workflows.get(workflowId);
  if (!wf) throw notFound("Workflow");
  requireOrgCap(ctx, wf.organizationId, "org.read");
  const st = wfState(wf);
  return {
    workflow: { id: wf.id, status: wf.status, tokensUsed: wf.tokensUsed, maxTokens: wf.maxTokens, createdAt: wf.createdAt },
    campaign: ctx.store.campaigns.get(st.campaignId)!,
    steps: STEP_ORDER.map((key, i) => {
      const s = [...ctx.store.steps].reverse().find((x) => x.workflowId === wf.id && x.key === key);
      const gate = ctx.store.humanApprovals.find((h) => h.workflowId === wf.id && h.gateId === key);
      const status = key.startsWith("gate:") ? (gate?.status ?? (i < st.cursor ? "approved" : "not_started")) : s?.status ?? (i < st.cursor ? "completed" : "not_started");
      return { key, status, attempts: s?.attempts ?? 0, error: s?.error ?? null };
    }),
    outputs: st.outputs,
    selectedConceptId: st.selectedConceptId ?? null,
    compositionId: st.compositionId ?? null,
    renderJobId: st.renderJobId ?? null,
    complianceBlocked: st.complianceBlocked ?? false,
    pendingGate: ctx.store.humanApprovals.find((h) => h.workflowId === wf.id && h.status === "pending")?.gateId ?? null,
  };
}

export function listCampaigns(ctx: Ctx, organizationId: string) {
  requireOrgCap(ctx, organizationId, "org.read");
  return [...ctx.store.campaigns.values()].filter((c) => c.organizationId === organizationId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
