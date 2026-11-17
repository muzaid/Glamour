"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { MotionComposition } from "@glamotion/contracts";
import { StatusChip } from "@glamotion/ui";
import { FramePlayer } from "../FramePlayer";
import { apiFetch } from "../client";

type View = {
  workflow: { id: string; status: string; tokensUsed: number; maxTokens: number };
  campaign: { id: string; name: string; status: string };
  steps: { key: string; status: string; attempts: number; error: string | null }[];
  outputs: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  selectedConceptId: string | null; compositionId: string | null; renderJobId: string | null; complianceBlocked: boolean; pendingGate: string | null;
};
const LABEL: Record<string, string> = {
  brief_interpreter: "Brief Interpreter", creative_director: "Creative Director", "gate:select_direction": "You: choose direction", art_director: "Art Director",
  copywriter: "Copywriter", motion_director: "Motion Director", assemble: "Compose timeline", compliance_reviewer: "Compliance", qa_evaluator: "QA Evaluator",
  "gate:approve_output": "You: approve output", render: "Render worker",
};

export function WorkflowRoom({ initial, orgSlug, canApprove, previewDoc }: { initial: View; orgSlug: string; canApprove: boolean; previewDoc: MotionComposition | null }) {
  const [v, setV] = useState(initial);
  const [choice, setChoice] = useState<string>(initial.outputs.creative_director?.concepts?.[0]?.id ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [render, setRender] = useState<{ status: string; downloadUrl: string | null; progress: number } | null>(null);
  async function decide(gateId: string, decision: "approve" | "reject") {
    setBusy(true); setErr(null);
    const r = await apiFetch<{ data: View }>(`/api/v1/workflows/${v.workflow.id}/approve`, { method: "POST", body: { gateId, decision, selection: gateId === "gate:select_direction" ? choice : undefined } });
    setBusy(false);
    if (r.ok) { setV(r.data.data); if (gateId === "gate:select_direction") window.location.reload(); } else setErr(r.error.message);
  }
  useEffect(() => {
    if (!v.renderJobId) return;
    const t = setInterval(async () => {
      const r = await apiFetch<{ data: { status: string; downloadUrl: string | null; progress: number } }>(`/api/v1/renders/${v.renderJobId}`);
      if (r.ok) { setRender(r.data.data); if (["completed", "failed", "cancelled"].includes(r.data.data.status)) clearInterval(t); }
    }, 1200);
    return () => clearInterval(t);
  }, [v.renderJobId]);
  const concepts = v.outputs.creative_director?.concepts ?? [];
  const compliance = v.outputs.compliance_reviewer;
  const copy = v.outputs.copywriter;
  return (
    <div className="gm-stack">
      <div className="gm-row gm-between">
        <div><div className="gm-eyebrow">WF-01 Product → campaign</div><h1>{v.campaign.name}</h1></div>
        <div className="gm-row"><StatusChip status={v.workflow.status} /><span data-testid="workflow-status" className="gm-small gm-muted">{v.workflow.status}</span><span className="gm-small gm-muted">tokens {v.workflow.tokensUsed.toLocaleString()} / {v.workflow.maxTokens.toLocaleString()}</span></div>
      </div>
      <section className="gm-card" aria-label="Agent run graph">
        <div className="gm-graph">
          {v.steps.map((s, i) => (
            <span key={s.key} className="gm-row" style={{ gap: 8 }}>
              <span className="gm-node" data-human={s.key.startsWith("gate:")}>
                <div style={{ fontWeight: 600 }}>{LABEL[s.key] ?? s.key}</div>
                <StatusChip status={s.status} />{s.attempts > 1 && <span className="gm-small gm-muted"> ×{s.attempts}</span>}
                {s.error && <div className="gm-small" style={{ color: "var(--gm-danger)" }}>{s.error}</div>}
              </span>
              {i < v.steps.length - 1 && <span className="gm-arrow" aria-hidden="true">→</span>}
            </span>
          ))}
        </div>
      </section>
      {err && <div className="gm-alert gm-alert-error" role="alert">{err}</div>}

      {v.outputs.brief_interpreter && (
        <details className="gm-card"><summary><strong>Brief interpretation</strong> <span className="gm-small gm-muted">(AI suggestion — verify facts)</span></summary>
          <ul>{v.outputs.brief_interpreter.verifiedClaims.map((x: string) => <li key={x}>{x}</li>)}</ul>
          <p className="gm-small gm-muted">Missing: {v.outputs.brief_interpreter.missingInfo.join("; ")}</p>
        </details>
      )}

      {v.pendingGate === "gate:select_direction" && (
        <section className="gm-card gm-stack" aria-labelledby="g1">
          <h2 id="g1">Choose a creative direction</h2>
          <div className="gm-grid">
            {concepts.map((c: { id: string; title: string; logline: string; preset: string; tagline: string }) => (
              <label key={c.id} className="gm-card gm-card-tight" style={{ cursor: "pointer", borderColor: choice === c.id ? "var(--gm-accent)" : undefined }}>
                <input type="radio" name="concept" value={c.id} checked={choice === c.id} onChange={() => setChoice(c.id)} data-testid={`concept-${c.id}`} /> <strong>{c.title}</strong>
                <p className="gm-small">{c.logline}</p><p className="gm-small gm-muted">Template: {c.preset} · “{c.tagline}”</p>
              </label>
            ))}
          </div>
          {canApprove ? <div className="gm-row"><button className="gm-btn gm-btn-accent" disabled={busy || !choice} onClick={() => decide("gate:select_direction", "approve")} data-testid="approve-direction">Use this direction</button><button className="gm-btn gm-btn-ghost" disabled={busy} onClick={() => decide("gate:select_direction", "reject")}>Reject all</button></div> : <p className="gm-muted">Waiting for an approver.</p>}
        </section>
      )}

      {(v.pendingGate === "gate:approve_output" || v.workflow.status === "completed") && previewDoc && (
        <section className="gm-grid-2">
          <div className="gm-card"><h2>Draft output</h2><FramePlayer doc={previewDoc} maxHeight={460} /></div>
          <div className="gm-card gm-stack">
            {copy && <><h3>Copy</h3><p><strong>{copy.headline}</strong></p><p className="gm-small">{copy.caption}</p>
              {Object.entries(copy.localized ?? {}).map(([loc, x]) => <p key={loc} className="gm-small" dir={loc === "en" ? "ltr" : "rtl"} lang={loc}><span className="gm-chip gm-chip-neutral">{loc}</span> {(x as { tagline: string }).tagline}</p>)}</>}
            {compliance && <><h3>Compliance <StatusChip status={compliance.decision} /></h3><ul className="gm-small">{compliance.findings.map((f: { severity: string; text: string }, i: number) => <li key={i}><strong>{f.severity}</strong>: {f.text}</li>)}</ul><p className="gm-small gm-muted">Automated review supports — and does not replace — legal review.</p></>}
            {v.outputs.qa_evaluator && <p className="gm-small">QA confidence: {Math.round(v.outputs.qa_evaluator.confidence * 100)}%</p>}
            {v.compositionId && <Link className="gm-btn gm-btn-ghost gm-btn-sm" href={`/studio/${orgSlug}/motion/${v.compositionId}`}>Open in motion editor</Link>}
            {v.pendingGate === "gate:approve_output" && (canApprove ? (
              <div className="gm-row">
                <button className="gm-btn gm-btn-accent" disabled={busy || v.complianceBlocked} onClick={() => decide("gate:approve_output", "approve")} data-testid="approve-output">Approve & render</button>
                <button className="gm-btn gm-btn-ghost" disabled={busy} onClick={() => decide("gate:approve_output", "reject")}>Send back to editing</button>
                {v.complianceBlocked && <span className="gm-small" style={{ color: "var(--gm-danger)" }}>Blocked by compliance — edit first.</span>}
              </div>) : <p className="gm-muted">Waiting for an approver.</p>)}
            {v.renderJobId && <div className="gm-small" data-testid="campaign-render">Render: <StatusChip status={render?.status ?? "queued"} /> {render?.status === "running" && `${Math.round(render.progress * 100)}%`}
              {render?.downloadUrl && <video src={render.downloadUrl} controls muted playsInline style={{ display: "block", maxHeight: 320, marginTop: 8, background: "#000" }} />}</div>}
          </div>
        </section>
      )}
      {v.workflow.status === "failed" && <div className="gm-alert gm-alert-error">This workflow stopped safely and needs review. Nothing was published. You can build the campaign manually from a template in the motion editor.</div>}
    </div>
  );
}
