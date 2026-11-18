"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { DropColour, DropPost, DropRowKey } from "@glamotion/contracts";
import { apiFetch } from "../client";
import { uploadImage } from "./upload";

const MAX = 12;

export function Swatches({ colours }: { colours: DropColour[] }) {
  return <span className="gm-row" style={{ gap: 3 }}>{colours.map((c, i) => <span key={i} title={c.name} style={{ width: 14, height: 14, borderRadius: "50%", background: c.hex, display: "inline-block", border: "1px solid #0002" }} />)}</span>;
}

/** Same technique as the public post: white cut-out as a mask over the colour, multiplied for shading. */
function Tinted({ src, hex, size }: { src: string; hex: string; size: number }) {
  return (
    <span style={{ position: "relative", width: size, height: size, display: "inline-block", background: "#ececec", borderRadius: 6, overflow: "hidden" }}>
      <span style={{ position: "absolute", inset: 0, backgroundColor: hex, WebkitMask: `url("${src}") center/contain no-repeat`, mask: `url("${src}") center/contain no-repeat` }} />
      <img src={src} alt="" crossOrigin="anonymous" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", mixBlendMode: "multiply", filter: "url(#gm-shade)" }} />
    </span>
  );
}

export function NewDrop({ orgId, orgSlug }: { orgId: string; orgSlug: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r = await apiFetch<{ data: DropPost }>(`/api/v1/orgs/${orgId}/drops`, { method: "POST", body: { title: f.get("title") } });
    if (r.ok) router.push(`/studio/${orgSlug}/drops/${r.data.data.id}`); else setErr(r.error.message);
  }
  return (
    <form onSubmit={create} className="gm-row" style={{ alignItems: "end" }} aria-label="New drop">
      <div><label htmlFor="drop-title">Headline</label><input id="drop-title" name="title" className="gm-input" required maxLength={40} defaultValue="ARRIVING TOMORROW" data-testid="new-drop-title" /></div>
      <button className="gm-btn gm-btn-accent" data-testid="new-drop">New drop</button>
      {err && <div className="gm-alert gm-alert-error" role="alert">{err}</div>}
    </form>
  );
}

function ColourList({ label, colours, onChange, img, disabled, testid }: { label: string; colours: DropColour[]; onChange: (c: DropColour[]) => void; img: string | null; disabled: boolean; testid: string }) {
  const set = (i: number, patch: Partial<DropColour>) => onChange(colours.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const move = (i: number, d: -1 | 1) => { const a = [...colours]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j]!, a[i]!]; onChange(a); };
  return (
    <div className="gm-stack" style={{ gap: 8 }}>
      <strong>{label} — colourway order</strong>
      <ol style={{ listStyle: "none", padding: 0, margin: 0 }} className="gm-stack" data-testid={testid}>
        {colours.map((c, i) => (
          <li key={i} className="gm-row" style={{ gap: 8, alignItems: "center" }}>
            <span style={{ width: 18 }} className="gm-small gm-muted">{i + 1}</span>
            {img ? <Tinted src={img} hex={c.hex} size={44} /> : null}
            <input type="color" aria-label={`${label} colour ${i + 1}`} value={c.hex} onChange={(e) => set(i, { hex: e.target.value })} disabled={disabled} className="gm-input" style={{ width: 52, padding: 3 }} />
            <input aria-label={`${label} colour ${i + 1} name`} className="gm-input" value={c.name} maxLength={20} onChange={(e) => set(i, { name: e.target.value })} disabled={disabled} style={{ width: 120 }} />
            {!disabled && <>
              <button type="button" className="gm-btn gm-btn-ghost gm-btn-sm" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button type="button" className="gm-btn gm-btn-ghost gm-btn-sm" aria-label="Move down" onClick={() => move(i, 1)} disabled={i === colours.length - 1}>↓</button>
              <button type="button" className="gm-btn gm-btn-ghost gm-btn-sm" aria-label={`Remove ${c.name}`} onClick={() => onChange(colours.filter((_, j) => j !== i))} disabled={colours.length <= 1}>×</button>
            </>}
          </li>
        ))}
      </ol>
      {!disabled && colours.length < MAX && <div><button type="button" className="gm-btn gm-btn-ghost gm-btn-sm" onClick={() => onChange([...colours, { name: "new colour", hex: "#999999" }])}>+ Add colour</button></div>}
    </div>
  );
}

export function DropEditor({ drop: initial, orgId, orgSlug, canWrite, canPublish }: { drop: DropPost; orgId: string; orgSlug: string; canWrite: boolean; canPublish: boolean }) {
  const router = useRouter();
  const [drop, setDrop] = useState(initial);
  const [title, setTitle] = useState(initial.title);
  const [position, setPosition] = useState(initial.position + 1);
  const [top, setTop] = useState(initial.top.colours);
  const [bottom, setBottom] = useState(initial.bottom.colours);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const base = `/api/v1/orgs/${orgId}/drops/${drop.id}`;
  const dirty = title !== drop.title || position - 1 !== drop.position || JSON.stringify(top) !== JSON.stringify(drop.top.colours) || JSON.stringify(bottom) !== JSON.stringify(drop.bottom.colours);

  async function save(extra: Record<string, unknown> = {}) {
    setBusy(true); setMsg(null);
    const r = await apiFetch<{ data: DropPost }>(base, { method: "PATCH", body: { title, position: Math.max(0, position - 1), topColours: top, bottomColours: bottom, ...extra } });
    setBusy(false);
    if (!r.ok) { setMsg({ kind: "error", text: r.error.message }); return; }
    setDrop(r.data.data); setTop(r.data.data.top.colours); setBottom(r.data.data.bottom.colours);
    setMsg({ kind: "ok", text: extra.status === "published" ? "Published — it’s live." : extra.status === "draft" ? "Unpublished." : "Saved." });
    router.refresh();
  }
  async function upload(row: DropRowKey, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setBusy(true); setMsg(null);
    const r = await uploadImage<{ data: DropPost }>(`${base}/image?row=${row}`, file);
    setBusy(false);
    if (r.ok) { setDrop((d) => ({ ...d, [row]: { ...d[row], imageUrl: r.data.data[row].imageUrl } })); setMsg({ kind: "ok", text: "Photo uploaded." }); } else setMsg({ kind: "error", text: r.error.message });
  }
  async function remove() {
    if (!confirm(`Delete “${drop.title}”? This cannot be undone.`)) return;
    const r = await apiFetch(base, { method: "DELETE" });
    if (r.ok) router.push(`/studio/${orgSlug}/drops`); else setMsg({ kind: "error", text: r.error.message });
  }
  const rowCard = (row: DropRowKey, label: string, colours: DropColour[], setColours: (c: DropColour[]) => void) => (
    <section className="gm-card gm-stack">
      <h2>{label}</h2>
      <div className="gm-row" style={{ gap: 16, alignItems: "center" }}>
        {drop[row].imageUrl ? <Tinted src={drop[row].imageUrl!} hex="#ffffff" size={120} /> : <span style={{ width: 120, height: 120, background: "var(--gm-surface-2)", display: "inline-block", borderRadius: 6 }} />}
        <div className="gm-stack" style={{ gap: 6 }}>
          <p className="gm-small gm-muted" style={{ margin: 0 }}>A <strong>white</strong> garment cut-out on a transparent background (PNG, up to 4 MB). Each colourway is generated from it.</p>
          {canWrite && <label className="gm-btn gm-btn-ghost gm-btn-sm" style={{ alignSelf: "start" }}>{drop[row].imageUrl ? "Replace photo" : "Upload photo"}<input type="file" accept="image/png,image/webp" hidden onChange={(e) => upload(row, e)} data-testid={`drop-photo-${row}`} /></label>}
        </div>
      </div>
      <ColourList label={label} colours={colours} onChange={setColours} img={drop[row].imageUrl} disabled={!canWrite} testid={`colours-${row}`} />
    </section>
  );
  return (
    <div className="gm-stack">
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true"><filter id="gm-shade" colorInterpolationFilters="sRGB"><feComponentTransfer><feFuncR type="gamma" exponent="2.6" /><feFuncG type="gamma" exponent="2.6" /><feFuncB type="gamma" exponent="2.6" /></feComponentTransfer></filter></svg>
      <div className="gm-row gm-between">
        <div><div className="gm-eyebrow"><Link href={`/studio/${orgSlug}/drops`}>Drops</Link> · post</div><h1>{drop.title}</h1><span className="gm-chip" data-testid="drop-status">{drop.status}</span></div>
        <div className="gm-row">
          {canWrite && <button className="gm-btn" disabled={busy || !dirty} onClick={() => save()} data-testid="save-drop">Save</button>}
          {canPublish && drop.status === "draft" && <button className="gm-btn gm-btn-accent" disabled={busy} onClick={() => save({ status: "published" })} data-testid="publish-drop">Publish</button>}
          {canPublish && drop.status === "published" && <button className="gm-btn gm-btn-ghost" disabled={busy} onClick={() => save({ status: "draft" })}>Unpublish</button>}
          {drop.status === "published" && <Link className="gm-btn gm-btn-ghost" href={`/drop/${drop.id}`} target="_blank">View post ↗</Link>}
        </div>
      </div>
      {msg && <div className={`gm-alert ${msg.kind === "error" ? "gm-alert-error" : ""}`} role={msg.kind === "error" ? "alert" : "status"}>{msg.text}</div>}
      <section className="gm-card gm-row" style={{ alignItems: "end" }}>
        <div style={{ flex: 1, minWidth: 200 }}><label htmlFor="dt">Headline</label><input id="dt" className="gm-input" value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} disabled={!canWrite} data-testid="drop-title" /></div>
        <div style={{ width: 110 }}><label htmlFor="dp">Order</label><input id="dp" className="gm-input" type="number" min={1} max={1000} value={position} onChange={(e) => setPosition(Number(e.target.value) || 1)} disabled={!canWrite} /></div>
      </section>
      <div className="gm-grid-2">
        {rowCard("top", "Top", top, setTop)}
        {rowCard("bottom", "Bottom", bottom, setBottom)}
      </div>
      {canWrite && <div><button className="gm-btn gm-btn-ghost gm-btn-sm" onClick={remove} style={{ color: "var(--gm-danger)" }}>Delete drop</button></div>}
    </div>
  );
}
