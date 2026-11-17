"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { DesignLayer, MotionComposition, MotionElement } from "@glamotion/contracts";
import { locateFrame, preflight, totalFrames } from "@glamotion/motion";
import { StatusChip } from "@glamotion/ui";
import { FramePlayer } from "../FramePlayer";
import { apiFetch, newKey } from "../client";

interface RenderView { id: string; status: string; progress: number; error: string | null; downloadUrl: string | null; approved: boolean; attempts: number }

export function MotionEditor({ orgId, compositionId, initialDoc, initialRevision, projectId, canRender, canReview }: { orgId: string; compositionId: string; initialDoc: MotionComposition; initialRevision: number; projectId: string | null; canRender: boolean; canReview: boolean }) {
  const [doc, setDoc] = useState(initialDoc);
  const [rev, setRev] = useState(initialRevision);
  const [savedDoc, setSavedDoc] = useState(JSON.stringify(initialDoc));
  const [past, setPast] = useState<MotionComposition[]>([]);
  const [future, setFuture] = useState<MotionComposition[]>([]);
  const [frame, setFrame] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [safe, setSafe] = useState(true);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: React.ReactNode } | null>(null);
  const [render, setRender] = useState<RenderView | null>(null);
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  const dirty = JSON.stringify(doc) !== savedDoc;
  const pf = useMemo(() => preflight(doc), [doc]);
  const { scene, local } = locateFrame(doc, frame);
  const sceneStart = useMemo(() => { let s = 0; for (const sc of doc.scenes) { if (sc.id === scene.id) return s; s += sc.durationInFrames; } return 0; }, [doc, scene.id]);
  const el = scene.elements.find((e) => e.layer.id === sel) ?? null;

  const update = useCallback((fn: (d: MotionComposition) => void) => {
    setDoc((d) => { const next = structuredClone(d); fn(next); setPast((p) => [...p.slice(-49), d]); setFuture([]); return next; });
  }, []);
  const editEl = (fn: (e: MotionElement) => void) => update((d) => { const e = d.scenes.find((s) => s.id === scene.id)?.elements.find((x) => x.layer.id === sel); if (e) fn(e); });
  const undo = useCallback(() => setPast((p) => { if (!p.length) return p; setFuture((f) => [doc, ...f]); setDoc(p[p.length - 1]!); return p.slice(0, -1); }), [doc]);
  const redo = useCallback(() => setFuture((f) => { if (!f.length) return f; setPast((p) => [...p, doc]); setDoc(f[0]!); return f.slice(1); }), [doc]);

  async function save() {
    setMsg(null);
    const r = await apiFetch<{ data: { revision: number } }>(`/api/v1/orgs/${orgId}/compositions/${compositionId}`, { method: "PUT", body: { baseRevision: rev, composition: doc } });
    if (r.ok) { setRev(r.data.data.revision); setSavedDoc(JSON.stringify(doc)); setMsg({ tone: "ok", text: `Saved revision ${r.data.data.revision}.` }); }
    else if (r.status === 409) setMsg({ tone: "error", text: "Someone else saved a newer revision. Reload to see their changes before saving again." });
    else setMsg({ tone: "error", text: r.error.message });
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      if (e.key === "s") { e.preventDefault(); void save(); }
    };
    window.addEventListener("keydown", onKey);
    const warn = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("beforeunload", warn); };
  });

  async function startRender(quality: "preview" | "final") {
    if (dirty) { setMsg({ tone: "error", text: "Save your changes before rendering." }); return; }
    const r = await apiFetch<{ data: { id: string } }>("/api/v1/renders", { method: "POST", idempotencyKey: newKey(), body: { compositionId, revision: rev, quality } });
    if (!r.ok) { setMsg({ tone: "error", text: r.error.message }); return; }
    void apiFetch("/api/v1/analytics", { method: "POST", body: { name: "render_started", props: { quality } } });
    setRender({ id: r.data.data.id, status: "queued", progress: 0, error: null, downloadUrl: null, approved: false, attempts: 0 });
  }
  useEffect(() => {
    if (!render || ["completed", "failed", "cancelled"].includes(render.status)) return;
    const t = setInterval(async () => {
      const r = await apiFetch<{ data: RenderView }>(`/api/v1/renders/${render.id}`);
      if (r.ok) setRender(r.data.data);
    }, 1000);
    return () => clearInterval(t);
  }, [render]);

  async function requestReview(canApprove: boolean) {
    if (!projectId) return;
    if (dirty) { setMsg({ tone: "error", text: "Save before requesting review." }); return; }
    const r = await apiFetch<{ data: { url: string } }>(`/api/v1/projects/${projectId}/reviews`, { method: "POST", body: { compositionId, reviewerName: canApprove ? "Client approver" : "Client viewer", canApprove } });
    if (r.ok) setReviewUrl(new URL(r.data.data.url, window.location.origin).toString()); else setMsg({ tone: "error", text: r.error.message });
  }

  const total = totalFrames(doc);
  const pct = (f: number) => `${(f / Math.max(1, scene.durationInFrames)) * 100}%`;
  const layer = el?.layer;
  const setLayer = (fn: (l: DesignLayer) => void) => editEl((e) => fn(e.layer));

  return (
    <div className="gm-stack">
      <div className="gm-row gm-between">
        <div><div className="gm-eyebrow">Motion · {doc.aspectRatio} · {doc.fps} fps · {total} frames</div><h1 style={{ fontSize: 28 }}>{doc.title}</h1></div>
        <div className="gm-row">
          <span className="gm-small gm-muted" aria-live="polite">{dirty ? "Unsaved changes" : `Saved · rev ${rev}`}</span>
          <button className="gm-btn gm-btn-ghost gm-btn-sm" onClick={undo} disabled={!past.length} aria-keyshortcuts="Control+Z">Undo</button>
          <button className="gm-btn gm-btn-ghost gm-btn-sm" onClick={redo} disabled={!future.length} aria-keyshortcuts="Control+Shift+Z">Redo</button>
          <button className="gm-btn gm-btn-sm" onClick={save} disabled={!dirty} data-testid="save-composition" aria-keyshortcuts="Control+S">Save</button>
        </div>
      </div>
      {msg && <div className={`gm-alert gm-alert-${msg.tone}`} role="status">{msg.text}</div>}
      <p className="gm-mobile-only gm-muted">The full editor needs a larger screen. On mobile you can preview, scrub and request review.</p>
      <div className="gm-editor">
        <aside className="gm-panel gm-desktop-only" aria-label="Layers">
          <h3>Scenes & layers</h3>
          {doc.scenes.map((s, si) => (
            <div key={s.id}>
              <div className="gm-small gm-muted" style={{ marginTop: 8 }}>{si + 1}. {s.name} · {(s.durationInFrames / doc.fps).toFixed(1)}s</div>
              {s.elements.map((e) => (
                <button key={e.layer.id} className="gm-layer" aria-pressed={sel === e.layer.id && s.id === scene.id} onClick={() => { const start = doc.scenes.slice(0, si).reduce((n, x) => n + x.durationInFrames, 0); setFrame(start + e.startFrame + 1 < start + s.durationInFrames ? start + Math.min(e.startFrame + 20, s.durationInFrames - 1) : start); setSel(e.layer.id); }}>
                  <span aria-hidden="true">{e.layer.type === "text" ? "T" : e.layer.type === "image" ? "◈" : e.layer.type === "swatch" ? "●" : "▭"}</span>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.layer.name}</span>
                  {!e.layer.visible && <span className="gm-small gm-muted">hidden</span>}
                </button>
              ))}
            </div>
          ))}
        </aside>
        <section className="gm-panel" aria-label="Preview">
          <FramePlayer doc={doc} frame={frame} onFrame={setFrame} showSafeArea={safe} />
          <label className="gm-check gm-small" style={{ marginTop: 8 }}><input type="checkbox" checked={safe} onChange={(e) => setSafe(e.target.checked)} />Show platform safe area</label>
          <div className="gm-timeline gm-desktop-only" aria-label={`Timeline for scene ${scene.name}`}>
            <div className="gm-small gm-muted">Scene timeline · {scene.name}</div>
            {scene.elements.map((e) => (
              <div key={e.layer.id} className="gm-lane" title={e.layer.name} onClick={() => setSel(e.layer.id)}>
                <div className="gm-lane-bar" style={{ left: pct(e.startFrame), width: `calc(${pct(Math.min(e.endFrame, scene.durationInFrames))} - ${pct(e.startFrame)})`, outline: sel === e.layer.id ? "2px solid var(--gm-accent)" : undefined }} />
                {e.tracks.flatMap((t) => t.keyframes.map((k, i) => <span key={`${t.property}-${i}`} className="gm-lane-kf" style={{ left: pct(e.startFrame + k.frame) }} title={`${t.property} @ ${e.startFrame + k.frame}: ${k.value}`} />))}
                <div className="gm-playhead" style={{ left: pct(local) }} />
              </div>
            ))}
          </div>
        </section>
        <aside className="gm-panel gm-stack" aria-label="Inspector">
          <h3>Inspector</h3>
          {!layer ? <p className="gm-muted gm-small">Select a layer to edit it.</p> : (
            <div className="gm-stack">
              <div className="gm-small"><strong>{layer.name}</strong> · {layer.type}</div>
              {layer.type === "text" && <div><label htmlFor="i-text">Text</label><textarea id="i-text" className="gm-input" rows={2} maxLength={500} value={layer.text} onChange={(e) => setLayer((l) => { if (l.type === "text") l.text = e.target.value; })} data-testid="inspector-text" /></div>}
              {layer.type === "text" && <div><label htmlFor="i-size">Font size {Math.round(layer.fontSize)}</label><input id="i-size" type="range" min={12} max={200} value={layer.fontSize} onChange={(e) => setLayer((l) => { if (l.type === "text") l.fontSize = Number(e.target.value); })} /></div>}
              {(layer.type === "text" || layer.type === "rect" || layer.type === "ellipse") && <div><label htmlFor="i-color">Colour</label><input id="i-color" type="color" className="gm-input" style={{ padding: 4 }} value={layer.type === "text" ? layer.color : layer.fill} onChange={(e) => setLayer((l) => { const v = e.target.value.toUpperCase(); if (l.type === "text") l.color = v; else if (l.type === "rect" || l.type === "ellipse") l.fill = v; })} /></div>}
              <div className="gm-row">
                <div style={{ flex: 1 }}><label htmlFor="i-x">X</label><input id="i-x" type="number" className="gm-input" value={Math.round(layer.transform.x)} onChange={(e) => setLayer((l) => { l.transform.x = Number(e.target.value); })} /></div>
                <div style={{ flex: 1 }}><label htmlFor="i-y">Y</label><input id="i-y" type="number" className="gm-input" value={Math.round(layer.transform.y)} onChange={(e) => setLayer((l) => { l.transform.y = Number(e.target.value); })} /></div>
              </div>
              <div><label htmlFor="i-op">Opacity {Math.round(layer.opacity * 100)}%</label><input id="i-op" type="range" min={0} max={100} value={Math.round(layer.opacity * 100)} onChange={(e) => setLayer((l) => { l.opacity = Number(e.target.value) / 100; })} /></div>
              <div className="gm-row">
                <div style={{ flex: 1 }}><label htmlFor="i-start">Start frame</label><input id="i-start" type="number" min={0} className="gm-input" value={el!.startFrame} onChange={(e) => editEl((x) => { x.startFrame = Math.max(0, Math.min(Number(e.target.value), x.endFrame - 1)); })} /></div>
                <div style={{ flex: 1 }}><label htmlFor="i-end">End frame</label><input id="i-end" type="number" min={1} className="gm-input" value={el!.endFrame} onChange={(e) => editEl((x) => { x.endFrame = Math.max(x.startFrame + 1, Number(e.target.value)); })} /></div>
              </div>
              <div className="gm-row">
                <button className="gm-btn gm-btn-ghost gm-btn-sm" onClick={() => editEl((x) => { x.tracks = x.tracks.filter((t) => t.property !== "opacity"); x.tracks.push({ property: "opacity", keyframes: [{ frame: 0, value: 0, easing: "linear" }, { frame: 15, value: 1, easing: "luxe" }] }); })}>Fade in</button>
                <button className="gm-btn gm-btn-ghost gm-btn-sm" onClick={() => editEl((x) => { x.tracks = x.tracks.filter((t) => t.property !== "scale"); x.tracks.push({ property: "scale", keyframes: [{ frame: 0, value: 0.8, easing: "linear" }, { frame: 24, value: 1, easing: "luxe" }] }); })}>Scale in</button>
                <button className="gm-btn gm-btn-ghost gm-btn-sm" onClick={() => setLayer((l) => { l.visible = !l.visible; })}>{layer.visible ? "Hide" : "Show"}</button>
              </div>
            </div>
          )}
          <h3>Render preflight</h3>
          {pf.issues.length === 0 ? <p className="gm-small" style={{ color: "var(--gm-success)" }}>All checks passed · {pf.seconds.toFixed(1)}s</p> :
            <ul className="gm-small">{pf.issues.map((i, k) => <li key={k} style={{ color: i.level === "error" ? "var(--gm-danger)" : "var(--gm-warning)" }}>{i.level}: {i.message}</li>)}</ul>}
          {canRender && <div className="gm-row"><button className="gm-btn gm-btn-accent gm-btn-sm" disabled={!pf.ok} onClick={() => startRender("preview")} data-testid="render-preview">Render preview</button><button className="gm-btn gm-btn-ghost gm-btn-sm" disabled={!pf.ok} onClick={() => startRender("final")} data-testid="render-final">Render final</button></div>}
          {render && (
            <div className="gm-stack gm-small" data-testid="render-status">
              <div>Render <StatusChip status={render.status} /> {render.status === "running" && `${Math.round(render.progress * 100)}%`} {render.attempts > 1 && `(attempt ${render.attempts})`}</div>
              {render.error && <div style={{ color: "var(--gm-danger)" }}>{render.error}</div>}
              {render.downloadUrl && <><video src={render.downloadUrl} controls muted playsInline style={{ maxHeight: 280, background: "#000", borderRadius: 8 }} data-testid="render-video" /><a href={render.downloadUrl} className="gm-btn gm-btn-sm" download onClick={() => void apiFetch("/api/v1/analytics", { method: "POST", body: { name: "export_downloaded", props: {} } })}>Download (link expires in 5 min)</a></>}
            </div>
          )}
          {canReview && projectId && (
            <>
              <h3>Client review</h3>
              <div className="gm-row"><button className="gm-btn gm-btn-ghost gm-btn-sm" onClick={() => requestReview(true)} data-testid="request-review">Create approver link</button><button className="gm-btn gm-btn-ghost gm-btn-sm" onClick={() => requestReview(false)}>Comment-only link</button></div>
              {reviewUrl && <div className="gm-alert gm-small" style={{ wordBreak: "break-all" }}>Scoped, expiring link (shown once): <a href={reviewUrl} data-testid="review-url">{reviewUrl}</a></div>}
            </>
          )}
          {!projectId && <p className="gm-small gm-muted">Attach to a project to request client review. <Link href="../projects">Projects</Link></p>}
        </aside>
      </div>
    </div>
  );
}
