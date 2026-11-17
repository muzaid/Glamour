"use client";
import { useState } from "react";
import type { MotionComposition } from "@glamotion/contracts";
import { StatusChip } from "@glamotion/ui";
import { FramePlayer } from "./FramePlayer";
import { apiFetch } from "./client";

type Review = {
  session: { reviewerName: string; canApprove: boolean; expiresAt: string; revision: number };
  project: { name: string; status: string }; doc: MotionComposition;
  annotations: { id: string; frame: number | null; body: string; authorLabel: string; createdAt: string }[];
  approvals: { id: string; decision: string; actorLabel: string; createdAt: string }[];
};

export function ReviewRoom({ token, initial }: { token: string; initial: Review }) {
  const [r, setR] = useState(initial);
  const [frame, setFrame] = useState(0);
  const [body, setBody] = useState("");
  const [err, setErr] = useState<string | null>(null);
  async function refresh() { const x = await apiFetch<{ data: Review }>(`/api/v1/reviews/${token}`); if (x.ok) setR(x.data.data); }
  async function comment(e: React.FormEvent) {
    e.preventDefault();
    const x = await apiFetch(`/api/v1/reviews/${token}/comments`, { method: "POST", body: { body, frame } });
    if (x.ok) { setBody(""); await refresh(); } else setErr(x.error.message);
  }
  async function decide(decision: "approved" | "changes_requested") {
    const x = await apiFetch(`/api/v1/reviews/${token}/approvals`, { method: "POST", body: { decision } });
    if (x.ok) await refresh(); else setErr(x.error.message);
  }
  const last = r.approvals[r.approvals.length - 1];
  return (
    <div className="gm-grid-2">
      <div className="gm-card"><FramePlayer doc={r.doc} frame={frame} onFrame={setFrame} maxHeight={560} /></div>
      <div className="gm-stack">
        <div className="gm-card">
          <div className="gm-eyebrow">Client review · revision {r.session.revision}</div>
          <h1 style={{ fontSize: 28 }}>{r.project.name}</h1>
          <p className="gm-small gm-muted">Reviewing as {r.session.reviewerName} · link expires {new Date(r.session.expiresAt).toLocaleString()}</p>
          {last && <p>Latest decision: <StatusChip status={last.decision} /> by {last.actorLabel}</p>}
          {r.session.canApprove ? (
            <div className="gm-row"><button className="gm-btn gm-btn-accent" onClick={() => decide("approved")} data-testid="client-approve">Approve this version</button><button className="gm-btn gm-btn-ghost" onClick={() => decide("changes_requested")}>Request changes</button></div>
          ) : <p className="gm-small gm-muted">You can comment; a designated approver makes the final decision.</p>}
        </div>
        <form onSubmit={comment} className="gm-card gm-stack">
          <label htmlFor="cmt">Comment at {(frame / r.doc.fps).toFixed(2)}s (frame {frame})</label>
          <textarea id="cmt" className="gm-input" rows={3} required maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} data-testid="review-comment" />
          <button className="gm-btn gm-btn-sm" data-testid="post-comment">Post comment</button>
          {err && <div className="gm-alert gm-alert-error" role="alert">{err}</div>}
        </form>
        <div className="gm-card">
          <h2>Comments</h2>
          {r.annotations.length === 0 ? <p className="gm-muted">No comments yet.</p> : <ul>{r.annotations.map((a) => <li key={a.id}><button className="gm-btn gm-btn-ghost gm-btn-sm" onClick={() => setFrame(a.frame ?? 0)}>{((a.frame ?? 0) / r.doc.fps).toFixed(2)}s</button> <strong>{a.authorLabel}</strong>: {a.body}</li>)}</ul>}
        </div>
      </div>
    </div>
  );
}
