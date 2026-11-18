"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isWearable, type Product } from "@glamotion/contracts";
import { PRESETS } from "@glamotion/motion";
import { StatusChip } from "@glamotion/ui";
import { apiFetch, money } from "../client";
import { uploadImage } from "./upload";

export function ProductEditor({ product: initial, orgId, orgSlug, canWrite, canPublish, canCreate, projects }: { product: Product; orgId: string; orgSlug: string; canWrite: boolean; canPublish: boolean; canCreate: boolean; projects: { id: string; name: string }[] }) {
  const [p, setP] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [preset, setPreset] = useState("reel-9x16");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const router = useRouter();
  const base = `/api/v1/orgs/${orgId}/products/${p.id}`;
  async function call(path: string, method: string, body: unknown) {
    setErr(null);
    const r = await apiFetch<{ data: Product }>(path, { method, body });
    if (r.ok) setP(r.data.data); else setErr(r.error.message);
    return r.ok;
  }
  async function addVariant(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const ok = await call(`${base}/variants`, "POST", { sku: String(f.get("sku")).toUpperCase(), shadeName: f.get("shadeName"), hex: f.get("hex"), finish: f.get("finish"), priceMinor: Math.round(Number(f.get("price")) * 100), currency: "USD", initialStock: Number(f.get("stock")), sizeLabel: f.get("size") ? String(f.get("size")) : undefined });
    if (ok) form.reset();
  }
  async function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setErr(null);
    const r = await uploadImage<{ data: Product }>(`${base}/image`, file);
    if (r.ok) setP(r.data.data); else setErr(r.error.message);
  }
  async function createMotion() {
    setErr(null);
    const r = await apiFetch<{ data: { id: string } }>(`/api/v1/orgs/${orgId}/compositions`, { method: "POST", body: { productId: p.id, preset, aspectRatio: "9:16", projectId: projectId || null } });
    if (r.ok) router.push(`/studio/${orgSlug}/motion/${r.data.data.id}`); else setErr(r.error.message);
  }
  return (
    <div className="gm-stack">
      <div className="gm-row gm-between">
        <div><div className="gm-eyebrow">{p.brandName} · {p.category}</div><h1>{p.title}</h1><StatusChip status={p.status} /> <span data-testid="product-status" className="gm-muted gm-small">{p.status}</span></div>
        <div className="gm-row">
          {canPublish && p.status !== "published" && <button className="gm-btn gm-btn-accent" onClick={() => call(base, "PATCH", { status: "published" })} data-testid="publish">Publish</button>}
          {canWrite && p.status === "published" && <button className="gm-btn gm-btn-ghost" onClick={() => call(base, "PATCH", { status: "archived" })}>Archive</button>}
          {p.status === "published" && <Link className="gm-btn gm-btn-ghost" href={`/shop/${p.slug}`}>View in store</Link>}
        </div>
      </div>
      {err && <div className="gm-alert gm-alert-error" role="alert">{err}</div>}
      <section className="gm-card gm-row" style={{ gap: 20, alignItems: "center" }}>
        {p.imageUrl ? <img src={p.imageUrl} alt={p.imageAlt} width={96} height={128} style={{ objectFit: "contain", background: "var(--gm-surface-2)" }} data-testid="product-image" /> : <span style={{ width: 96, height: 128, background: "var(--gm-surface-2)", display: "inline-block" }} />}
        <div className="gm-stack" style={{ gap: 8 }}>
          <h2 style={{ margin: 0 }}>Product photo</h2>
          <p className="gm-muted gm-small" style={{ margin: 0 }}>Used in the shop and on the runway. PNG, JPEG or WebP up to 4 MB; a plain or transparent background works best.</p>
          {canWrite && <div className="gm-row">
            <label className="gm-btn gm-btn-ghost gm-btn-sm">{p.imageUrl ? "Replace photo" : "Upload photo"}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onImage} data-testid="product-photo" /></label>
            {p.imageUrl && <button className="gm-btn gm-btn-ghost gm-btn-sm" onClick={() => call(`${base}/image`, "DELETE", undefined)}>Remove</button>}
          </div>}
        </div>
      </section>
      <section className="gm-card">
        <h2>{isWearable(p.category) ? "Sizes & inventory" : "Shades & inventory"}</h2>
        <div className="gm-table-wrap"><table className="gm-table">
          <thead><tr><th>Shade</th><th>SKU</th><th>Finish</th><th>Price</th><th>Available</th>{canWrite && <th>Adjust</th>}</tr></thead>
          <tbody>{p.variants.map((v) => (
            <tr key={v.id}>
              <td><span style={{ width: 18, height: 18, borderRadius: "50%", background: v.shade.hex, display: "inline-block", verticalAlign: "middle", marginRight: 8 }} />{v.shadeName}{v.sizeLabel ? ` · ${v.sizeLabel}` : ""}</td>
              <td>{v.sku}</td><td>{v.shade.finish}</td><td>{money(v.price.amountMinor, v.price.currency)}</td><td>{v.available}</td>
              {canWrite && <td className="gm-row"><button className="gm-btn gm-btn-ghost gm-btn-sm" onClick={() => call(base, "PATCH", { stock: { variantId: v.id, delta: 10 } })}>+10</button><button className="gm-btn gm-btn-ghost gm-btn-sm" onClick={() => call(base, "PATCH", { stock: { variantId: v.id, delta: -1 } })}>−1</button></td>}
            </tr>
          ))}</tbody>
        </table></div>
        {canWrite && (
          <form onSubmit={addVariant} className="gm-row" style={{ marginTop: 16, alignItems: "end" }} aria-label="Add shade">
            {isWearable(p.category) && <div><label htmlFor="size">Size</label><input id="size" name="size" className="gm-input" required pattern="[A-Za-z0-9./ \-]{1,12}" style={{ width: 90 }} placeholder="M" data-testid="variant-size" /></div>}
            <div><label htmlFor="shadeName">{isWearable(p.category) ? "Colour" : "Shade name"}</label><input id="shadeName" name="shadeName" className="gm-input" required maxLength={80} data-testid="variant-name" /></div>
            <div><label htmlFor="sku">SKU</label><input id="sku" name="sku" className="gm-input" required pattern="[A-Za-z0-9][A-Za-z0-9_\-]+" data-testid="variant-sku" /></div>
            <div><label htmlFor="hex">Colour</label><input id="hex" name="hex" type="color" className="gm-input" defaultValue="#b23a48" style={{ width: 70, padding: 4 }} data-testid="variant-hex" /></div>
            <div><label htmlFor="finish">Finish</label><select id="finish" name="finish" className="gm-input">{["matte", "satin", "gloss", "shimmer", "metallic", "natural"].map((f) => <option key={f}>{f}</option>)}</select></div>
            <div><label htmlFor="price">Price (USD)</label><input id="price" name="price" type="number" min="0.5" step="0.01" defaultValue="26.00" className="gm-input" style={{ width: 110 }} data-testid="variant-price" /></div>
            <div><label htmlFor="stock">Stock</label><input id="stock" name="stock" type="number" min="0" defaultValue="20" className="gm-input" style={{ width: 90 }} /></div>
            <button className="gm-btn" data-testid="add-variant">Add shade</button>
          </form>
        )}
      </section>
      {canCreate && (
        <section className="gm-card gm-stack">
          <h2>Turn into motion</h2>
          <p className="gm-muted">Create an editable motion composition from this product. Shades, names and IDs come straight from the catalog.</p>
          <div className="gm-row" style={{ alignItems: "end" }}>
            <div><label htmlFor="preset">Template</label><select id="preset" className="gm-input" value={preset} onChange={(e) => setPreset(e.target.value)}>{PRESETS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
            <div><label htmlFor="project">Project</label><select id="project" className="gm-input" value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">No project</option>{projects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
            <button className="gm-btn gm-btn-accent" onClick={createMotion} data-testid="create-motion">Create 9:16 motion</button>
          </div>
        </section>
      )}
    </div>
  );
}
