"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../client";

export function CampaignWizard({ orgId, orgSlug, products }: { orgId: string; orgSlug: string; products: { id: string; title: string }[] }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setErr(null);
    const r = await apiFetch<{ data: { workflowId: string } }>(`/api/v1/orgs/${orgId}/campaigns`, { method: "POST", body: {
      name: f.get("name"), productId: f.get("productId"), objective: f.get("objective"), platform: f.get("platform"), locales: f.getAll("locales"), aspectRatio: "9:16",
    } });
    setBusy(false);
    if (!r.ok) return setErr(r.error.message);
    router.push(`/studio/${orgSlug}/campaigns/${r.data.data.workflowId}`);
  }
  if (products.length === 0) return <p className="gm-muted">Publish a product first — campaigns are generated from published catalog data.</p>;
  return (
    <form onSubmit={submit} className="gm-card gm-stack" aria-label="Product to campaign">
      <h2>Product → campaign</h2>
      <p className="gm-muted gm-small">AI agents draft concepts, copy and a motion timeline. Nothing is published, scheduled or spent — you approve each gate.</p>
      <div><label htmlFor="c-name">Campaign name</label><input id="c-name" name="name" className="gm-input" required minLength={2} defaultValue="Holiday launch" data-testid="campaign-name" /></div>
      <div><label htmlFor="c-prod">Product</label><select id="c-prod" name="productId" className="gm-input" data-testid="campaign-product">{products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
      <div className="gm-row">
        <div style={{ flex: 1 }}><label htmlFor="c-obj">Objective</label><select id="c-obj" name="objective" className="gm-input"><option value="launch">Launch</option><option value="awareness">Awareness</option><option value="promotion">Promotion</option><option value="seasonal">Seasonal</option></select></div>
        <div style={{ flex: 1 }}><label htmlFor="c-plat">Platform</label><select id="c-plat" name="platform" className="gm-input"><option value="instagram_reel">Instagram Reel</option><option value="tiktok">TikTok</option><option value="youtube_short">YouTube Short</option></select></div>
      </div>
      <fieldset><legend>Locales</legend><div className="gm-row">{[["en", "English"], ["ar", "العربية"], ["he", "עברית"]].map(([v, l], i) => <label key={v} className="gm-check"><input type="checkbox" name="locales" value={v} defaultChecked={i === 0} />{l}</label>)}</div></fieldset>
      {err && <div className="gm-alert gm-alert-error" role="alert">{err}</div>}
      <button className="gm-btn gm-btn-accent" disabled={busy} data-testid="start-campaign">{busy ? "Agents working…" : "Generate proposals"}</button>
    </form>
  );
}
