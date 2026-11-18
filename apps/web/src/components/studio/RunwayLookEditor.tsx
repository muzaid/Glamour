"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { RunwayLook, RunwayPin } from "@glamotion/contracts";
import { apiFetch } from "../client";
import { uploadImage } from "./upload";

type Opt = { id: string; title: string; status: string; imageUrl: string | null };
const MAX_PINS = 6;

export function NewRunwayLook({ orgId, orgSlug }: { orgId: string; orgSlug: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r = await apiFetch<{ data: RunwayLook }>(`/api/v1/orgs/${orgId}/runway-looks`, { method: "POST", body: { name: f.get("name"), description: f.get("description") ?? "" } });
    if (r.ok) router.push(`/studio/${orgSlug}/runway/${r.data.data.id}`); else setErr(r.error.message);
  }
  return (
    <form onSubmit={create} className="gm-row" style={{ alignItems: "end" }} aria-label="New runway look">
      <div><label htmlFor="look-name">Look name</label><input id="look-name" name="name" className="gm-input" required maxLength={60} placeholder="Weekend Edit" data-testid="new-look-name" /></div>
      <div><label htmlFor="look-desc">Short description</label><input id="look-desc" name="description" className="gm-input" maxLength={200} placeholder="Optional" /></div>
      <button className="gm-btn gm-btn-accent" data-testid="new-look">New look</button>
      {err && <div className="gm-alert gm-alert-error" role="alert">{err}</div>}
    </form>
  );
}

export function RunwayLookEditor({ look: initial, orgId, orgSlug, products, canWrite, canPublish }: { look: RunwayLook; orgId: string; orgSlug: string; products: Opt[]; canWrite: boolean; canPublish: boolean }) {
  const router = useRouter();
  const [look, setLook] = useState(initial);
  const [pins, setPins] = useState<RunwayPin[]>(initial.pins);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [position, setPosition] = useState(initial.position + 1);
  const [placing, setPlacing] = useState<string>(products.find((p) => !initial.pins.some((x) => x.productId === p.id))?.id ?? "");
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const base = `/api/v1/orgs/${orgId}/runway-looks/${look.id}`;
  const byId = new Map(products.map((p) => [p.id, p]));
  const dirty = name !== look.name || description !== look.description || position - 1 !== look.position || JSON.stringify(pins) !== JSON.stringify(look.pins);

  async function save(extra: Record<string, unknown> = {}) {
    setBusy(true); setMsg(null);
    const r = await apiFetch<{ data: RunwayLook }>(base, { method: "PATCH", body: { name, description, position: Math.max(0, position - 1), pins, ...extra } });
    setBusy(false);
    if (!r.ok) { setMsg({ kind: "error", text: r.error.message }); return false; }
    setLook(r.data.data); setPins(r.data.data.pins);
    setMsg({ kind: "ok", text: extra.status === "published" ? "Published — it’s live on the runway." : extra.status === "draft" ? "Unpublished." : "Saved." });
    router.refresh();
    return true;
  }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setBusy(true); setMsg(null);
    const r = await uploadImage<{ data: RunwayLook }>(`${base}/image`, file);
    setBusy(false);
    if (r.ok) { setLook(r.data.data); setMsg({ kind: "ok", text: "Photo uploaded." }); } else setMsg({ kind: "error", text: r.error.message });
  }
  async function remove() {
    if (!confirm(`Delete “${look.name}”? This cannot be undone.`)) return;
    const r = await apiFetch(base, { method: "DELETE" });
    if (r.ok) router.push(`/studio/${orgSlug}/runway`); else setMsg({ kind: "error", text: r.error.message });
  }
  function place(e: React.MouseEvent<HTMLDivElement>) {
    if (!canWrite || !placing) return;
    const r = e.currentTarget.getBoundingClientRect();
    const left = Math.round(((e.clientX - r.left) / r.width) * 1000) / 10, top = Math.round(((e.clientY - r.top) / r.height) * 1000) / 10;
    setPins((ps) => {
      const i = ps.findIndex((p) => p.productId === placing);
      if (i >= 0) return ps.map((p, j) => (j === i ? { ...p, left, top } : p));
      if (ps.length >= MAX_PINS) { setMsg({ kind: "error", text: `A look can have up to ${MAX_PINS} pieces.` }); return ps; }
      return [...ps, { productId: placing, left, top, tag: null }];
    });
    const next = products.find((p) => p.id !== placing && !pins.some((x) => x.productId === p.id));
    if (next && !pins.some((x) => x.productId === placing)) setPlacing(next.id);
  }
  const move = (i: number, d: -1 | 1) => setPins((ps) => { const a = [...ps]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j]!, a[i]!]; return a; });

  return (
    <div className="gm-stack">
      <div className="gm-row gm-between">
        <div><div className="gm-eyebrow"><Link href={`/studio/${orgSlug}/runway`}>Runway</Link> · look</div><h1>{look.name}</h1><span className="gm-chip" data-testid="look-status">{look.status}</span></div>
        <div className="gm-row">
          {canWrite && <button className="gm-btn" disabled={busy || !dirty} onClick={() => save()} data-testid="save-look">Save</button>}
          {canPublish && look.status === "draft" && <button className="gm-btn gm-btn-accent" disabled={busy} onClick={() => save({ status: "published" })} data-testid="publish-look">Publish</button>}
          {canPublish && look.status === "published" && <button className="gm-btn gm-btn-ghost" disabled={busy} onClick={() => save({ status: "draft" })}>Unpublish</button>}
          <Link className="gm-btn gm-btn-ghost" href="/runway" target="_blank">View runway ↗</Link>
        </div>
      </div>
      {msg && <div className={`gm-alert ${msg.kind === "error" ? "gm-alert-error" : ""}`} role={msg.kind === "error" ? "alert" : "status"}>{msg.text}</div>}
      <div className="gm-runway-editor">
        <section className="gm-card gm-stack">
          <h2>Model photo & pins</h2>
          <div
            onClick={place}
            role="presentation"
            data-testid="pin-canvas"
            style={{ position: "relative", width: "100%", aspectRatio: "9 / 16", background: "var(--gm-surface-2)", cursor: canWrite && placing && look.imageUrl ? "crosshair" : "default", overflow: "hidden", borderRadius: 8 }}
          >
            {look.imageUrl
              ? <img src={look.imageUrl} alt={look.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", objectPosition: "50% 100%", pointerEvents: "none" }} />
              : <p className="gm-muted gm-small" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", padding: 16 }}>Upload a full-length model photo. A transparent PNG cut-out, portrait 9:16, looks best.</p>}
            {pins.map((p, i) => (
              <span key={p.productId} title={byId.get(p.productId)?.title} style={{ position: "absolute", left: `${p.left}%`, top: `${p.top}%`, transform: "translate(-50%,-50%)", width: 26, height: 26, borderRadius: "50%", background: "#fff", color: "#151413", border: p.productId === placing ? "2px solid #b23a48" : "1px solid #151413", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, pointerEvents: "none", boxShadow: "0 1px 4px #0004" }}>{i + 1}</span>
            ))}
          </div>
          {canWrite && <label className="gm-btn gm-btn-ghost" style={{ textAlign: "center" }}>{look.imageUrl ? "Replace photo" : "Upload photo"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} hidden data-testid="look-photo" /></label>}
          {canWrite && look.imageUrl && <p className="gm-small gm-muted">Choose a piece on the right, then click the photo where its pin should sit. Click again to move it.</p>}
        </section>
        <section className="gm-card gm-stack">
          <h2>Details</h2>
          <div className="gm-row" style={{ alignItems: "end" }}>
            <div style={{ flex: 2, minWidth: 180 }}><label htmlFor="ln">Name</label><input id="ln" className="gm-input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} disabled={!canWrite} /></div>
            <div style={{ width: 110 }}><label htmlFor="lp">Order</label><input id="lp" className="gm-input" type="number" min={1} max={1000} value={position} onChange={(e) => setPosition(Number(e.target.value) || 1)} disabled={!canWrite} /></div>
          </div>
          <div><label htmlFor="ld">Description</label><input id="ld" className="gm-input" value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} disabled={!canWrite} /></div>
          <h2>Pieces in this look</h2>
          {canWrite && (
            <div>
              <label htmlFor="placing">Piece to place</label>
              <select id="placing" className="gm-input" value={placing} onChange={(e) => setPlacing(e.target.value)} data-testid="pin-product">
                <option value="">Choose a product…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.title}{p.status !== "published" ? ` (${p.status} — hidden until published)` : ""}{pins.some((x) => x.productId === p.id) ? " ✓" : ""}</option>)}
              </select>
            </div>
          )}
          {pins.length === 0 ? <p className="gm-muted">No pieces pinned yet.</p> : (
            <ol className="gm-stack" style={{ paddingLeft: 0, listStyle: "none", margin: 0 }} data-testid="pin-list">
              {pins.map((p, i) => {
                const prod = byId.get(p.productId);
                return (
                  <li key={p.productId} className="gm-row" style={{ gap: 10, alignItems: "center", borderBottom: "1px solid var(--gm-border)", paddingBottom: 8 }}>
                    <strong style={{ width: 20 }}>{i + 1}</strong>
                    {prod?.imageUrl ? <img src={prod.imageUrl} alt="" width={36} height={44} style={{ objectFit: "contain" }} /> : <span style={{ width: 36, height: 44, background: "var(--gm-surface-2)", display: "inline-block" }} />}
                    <span style={{ flex: 1, minWidth: 120 }}>{prod?.title ?? "Unknown product"}{prod && prod.status !== "published" && <span className="gm-small gm-muted"> · {prod.status}, hidden</span>}<div className="gm-small gm-muted">{p.left}% × {p.top}%</div></span>
                    {canWrite && <>
                      <input aria-label={`Tag for ${prod?.title ?? "piece"}`} className="gm-input" style={{ width: 90 }} placeholder="Tag" maxLength={16} value={p.tag ?? ""} onChange={(e) => setPins((ps) => ps.map((x, j) => (j === i ? { ...x, tag: e.target.value || null } : x)))} />
                      <button className="gm-btn gm-btn-ghost gm-btn-sm" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                      <button className="gm-btn gm-btn-ghost gm-btn-sm" aria-label="Move down" onClick={() => move(i, 1)} disabled={i === pins.length - 1}>↓</button>
                      <button className="gm-btn gm-btn-ghost gm-btn-sm" aria-label={`Remove ${prod?.title ?? "piece"}`} onClick={() => setPins((ps) => ps.filter((_, j) => j !== i))}>×</button>
                    </>}
                  </li>
                );
              })}
            </ol>
          )}
          <p className="gm-small gm-muted">Up to {MAX_PINS} pieces. Only published products appear on the runway; sizes, prices and stock come from each product.</p>
          {canWrite && <div><button className="gm-btn gm-btn-ghost gm-btn-sm" onClick={remove} style={{ color: "var(--gm-danger)" }}>Delete look</button></div>}
        </section>
      </div>
    </div>
  );
}
