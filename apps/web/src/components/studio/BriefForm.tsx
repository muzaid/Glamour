"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../client";

export function BriefForm({ orgId, orgSlug, products }: { orgId: string; orgSlug: string; products: { id: string; title: string }[] }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r = await apiFetch<{ data: { id: string } }>(`/api/v1/orgs/${orgId}/projects`, { method: "POST", body: {
      title: f.get("title"), clientName: f.get("clientName"), projectType: f.get("projectType"), objective: f.get("objective"), audience: f.get("audience"),
      channels: f.getAll("channels"), aspectRatios: f.getAll("aspectRatios"), productIds: f.getAll("productIds"),
      legalClaims: String(f.get("legalClaims") ?? "").split("\n").map((s) => s.trim()).filter(Boolean), dueDate: f.get("dueDate") || undefined,
    } });
    if (!r.ok) return setErr(r.error.message);
    void apiFetch("/api/v1/analytics", { method: "POST", body: { name: "brief_submitted", props: {} } });
    router.push(`/studio/${orgSlug}/projects/${r.data.data.id}`);
  }
  return (
    <form onSubmit={submit} className="gm-card gm-stack" aria-label="New brief">
      <h2>New brief</h2>
      <div className="gm-grid" style={{ gap: 16 }}>
        <div><label htmlFor="b-title">Project title</label><input id="b-title" name="title" className="gm-input" required minLength={2} data-testid="brief-title" /></div>
        <div><label htmlFor="b-client">Client</label><input id="b-client" name="clientName" className="gm-input" defaultValue="Internal" /></div>
        <div><label htmlFor="b-type">Type</label><select id="b-type" name="projectType" className="gm-input"><option value="product_video">Product video</option><option value="social_graphics">Social graphics</option><option value="campaign">Campaign</option><option value="launch_kit">Launch kit</option></select></div>
        <div><label htmlFor="b-due">Due</label><input id="b-due" name="dueDate" type="date" className="gm-input" /></div>
      </div>
      <div><label htmlFor="b-obj">Objective</label><textarea id="b-obj" name="objective" className="gm-input" required rows={2} data-testid="brief-objective" /></div>
      <div><label htmlFor="b-aud">Audience</label><input id="b-aud" name="audience" className="gm-input" /></div>
      <fieldset><legend>Channels</legend><div className="gm-row">{["instagram", "tiktok", "youtube", "web", "email"].map((c, i) => <label key={c} className="gm-check"><input type="checkbox" name="channels" value={c} defaultChecked={i === 0} />{c}</label>)}</div></fieldset>
      <fieldset><legend>Aspect ratios</legend><div className="gm-row">{["9:16", "1:1", "4:5", "16:9"].map((c, i) => <label key={c} className="gm-check"><input type="checkbox" name="aspectRatios" value={c} defaultChecked={i === 0} />{c}</label>)}</div></fieldset>
      {products.length > 0 && <fieldset><legend>Products</legend><div className="gm-row">{products.map((p) => <label key={p.id} className="gm-check"><input type="checkbox" name="productIds" value={p.id} />{p.title}</label>)}</div></fieldset>}
      <div><label htmlFor="b-claims">Claims requiring client confirmation (one per line)</label><textarea id="b-claims" name="legalClaims" className="gm-input" rows={2} /></div>
      {err && <div className="gm-alert gm-alert-error" role="alert">{err}</div>}
      <button className="gm-btn gm-btn-accent" data-testid="create-project">Create project</button>
    </form>
  );
}
