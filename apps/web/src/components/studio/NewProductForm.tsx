"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../client";

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

export function NewProductForm({ orgId, orgSlug, brands }: { orgId: string; orgSlug: string; brands: { id: string; name: string }[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setErr(null);
    const r = await apiFetch<{ data: { id: string } }>(`/api/v1/orgs/${orgId}/products`, { method: "POST", body: {
      brandId: f.get("brandId"), title, slug: slugTouched ? slug : slugify(title), category: f.get("category"), description: f.get("description"), instructions: f.get("instructions"), ingredients: f.get("ingredients"), warnings: f.get("warnings"),
    } });
    setBusy(false);
    if (!r.ok) { setErr(r.error.message); return; }
    router.push(`/studio/${orgSlug}/products/${r.data.data.id}`);
  }
  return (
    <form onSubmit={submit} className="gm-card" style={{ maxWidth: 720 }}>
      <div className="gm-field"><label htmlFor="brandId">Brand</label><select id="brandId" name="brandId" className="gm-input">{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
      <div className="gm-field"><label htmlFor="title">Title</label><input id="title" className="gm-input" required minLength={2} maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} data-testid="product-title" /></div>
      <div className="gm-field"><label htmlFor="slug">URL slug</label><input id="slug" className="gm-input" required pattern="[a-z0-9-]+" value={slugTouched ? slug : slugify(title)} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }} data-testid="product-slug" /></div>
      <div className="gm-field"><label htmlFor="category">Category</label><select id="category" name="category" className="gm-input">{["lipstick", "lip_gloss", "blush", "eyeshadow", "top", "outerwear", "dress", "bottoms", "footwear", "bags"].map((c) => <option key={c}>{c}</option>)}</select></div>
      <div className="gm-field"><label htmlFor="description">Description</label><textarea id="description" name="description" className="gm-input" rows={3} required maxLength={4000} data-testid="product-description" /></div>
      <div className="gm-field"><label htmlFor="instructions">How to apply</label><textarea id="instructions" name="instructions" className="gm-input" rows={2} maxLength={2000} /></div>
      <div className="gm-field"><label htmlFor="ingredients">Ingredients (brand-verified)</label><textarea id="ingredients" name="ingredients" className="gm-input" rows={2} maxLength={4000} /></div>
      <div className="gm-field"><label htmlFor="warnings">Warnings</label><textarea id="warnings" name="warnings" className="gm-input" rows={2} maxLength={2000} /></div>
      {err && <div className="gm-alert gm-alert-error" role="alert">{err}</div>}
      <button className="gm-btn gm-btn-accent" disabled={busy} data-testid="create-product">{busy ? "Creating…" : "Create draft"}</button>
    </form>
  );
}
