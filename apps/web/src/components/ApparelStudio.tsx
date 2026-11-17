"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { compareSizes, type ApparelCategory } from "@glamotion/contracts";
import { BUILTIN_ASSETS } from "@glamotion/motion";
import {
  assessPoses, demoBodyPose, demoBodySvg, DEMO_BODY, garmentAsset, garmentTransform, MAX_PROCESS_DIMENSION, POSE_ISSUE_MESSAGES, validateUpload,
  type Pose, type PoseIssue,
} from "@glamotion/tryon";
import { ShadeSwatch } from "@glamotion/ui";
import { apiFetch, money } from "./client";

export interface GarmentVariant { variantId: string; colour: string; hex: string; size: string; priceMinor: number; currency: string; available: number }
export interface GarmentProduct { productId: string; slug: string; title: string; brandName: string; category: ApparelCategory; variants: GarmentVariant[] }
type Slot = "base" | "outer";
type Sel = { productId: string; colour: string; size: string | null; fitScale: number; offsetY: number };
type Source = "demo" | "upload" | "camera";
type PoseLandmarkerT = { detect(img: TexImageSource): { landmarks: { x: number; y: number; visibility?: number }[][] }; detectForVideo(v: HTMLVideoElement, t: number): { landmarks: { x: number; y: number; visibility?: number }[][] }; setOptions(o: object): Promise<void>; close(): void };

const slotOf = (c: ApparelCategory): Slot => (c === "outerwear" ? "outer" : "base");
const CONSENT_VERSION = "2026-11-apparel-v1";
const CLOUD_CONSENT_VERSION = "2026-11-apparel-cloud-v1";

export function ApparelStudio({ products, initialVariantId, signedIn, poseModelUrl }: { products: GarmentProduct[]; initialVariantId?: string; signedIn: boolean; poseModelUrl: string }) {
  const initial = useMemo(() => {
    const out: Partial<Record<Slot, Sel>> = {};
    for (const p of products) for (const v of p.variants) if (v.variantId === initialVariantId) out[slotOf(p.category)] = { productId: p.productId, colour: v.colour, size: v.size, fitScale: 1, offsetY: 0 };
    if (!out.base && !out.outer && products[0]) out[slotOf(products[0].category)] = { productId: products[0].productId, colour: products[0].variants[0]!.colour, size: null, fitScale: 1, offsetY: 0 };
    return out;
  }, [products, initialVariantId]);
  const [sel, setSel] = useState<Partial<Record<Slot, Sel>>>(initial);
  const [phase, setPhase] = useState<"consent" | "loading" | "ready" | "error">("consent");
  const [source, setSource] = useState<Source | null>(null);
  const [ack, setAck] = useState(false);
  const [issue, setIssue] = useState<string | null>(null);
  const [split, setSplit] = useState(0.35);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: React.ReactNode } | null>(null);
  const [cloud, setCloud] = useState<{ step: "idle" | "checking" | "unavailable" | "consent" | "sending" | "done" | "error"; text?: string; disclosure?: { processor: string; retention: string }; url?: string }>({ step: "idle" });
  const [cloudAck, setCloudAck] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const srcRef = useRef<HTMLCanvasElement | null>(null);
  const poseRef = useRef<Pose | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lmRef = useRef<PoseLandmarkerT | null>(null);
  const imgCache = useRef(new Map<string, HTMLImageElement>());
  const selRef = useRef(sel); selRef.current = sel;
  const splitRef = useRef(split); splitRef.current = split;

  const byId = useMemo(() => new Map(products.map((p) => [p.productId, p])), [products]);
  const variantFor = useCallback((s: Sel | undefined) => {
    const p = s && byId.get(s.productId);
    return p?.variants.find((v) => v.colour === s!.colour && v.size === s!.size) ?? null;
  }, [byId]);

  // Rasterise tinted garment templates once per (asset, colour).
  const garmentImage = useCallback((category: ApparelCategory, hex: string): HTMLImageElement | null => {
    const asset = garmentAsset(category);
    if (!asset) return null;
    const key = `${asset.id}${hex}`;
    let img = imgCache.current.get(key);
    if (!img) {
      const [w, h] = asset.viewBox;
      img = new Image();
      img.onload = () => draw();
      img.src = URL.createObjectURL(new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${asset.svg(hex).replace(/gm-/g, `gm-${key.replace(/[^a-z0-9]/gi, "")}-`)}</svg>`], { type: "image/svg+xml" }));
      imgCache.current.set(key, img);
    }
    return img.complete && img.naturalWidth ? img : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draw = useCallback(() => {
    const cv = canvasRef.current, src = srcRef.current;
    if (!cv || !src) return;
    if (cv.width !== src.width || cv.height !== src.height) { cv.width = src.width; cv.height = src.height; }
    const g = cv.getContext("2d")!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(src, 0, 0);
    const pose = poseRef.current;
    if (!pose) return;
    const x = Math.round(src.width * splitRef.current);
    g.save();
    g.beginPath(); g.rect(x, 0, src.width - x, src.height); g.clip();
    for (const slot of ["base", "outer"] as const) {
      const s = selRef.current[slot]; const p = s && byId.get(s.productId);
      if (!s || !p) continue;
      const hex = p.variants.find((v) => v.colour === s.colour)?.hex ?? "#888888";
      const img = garmentImage(p.category, hex);
      const asset = garmentAsset(p.category);
      if (!img || !asset) continue;
      const m = garmentTransform(asset, pose, src.width, src.height, { fitScale: s.fitScale, offsetY: s.offsetY });
      if (!m) continue;
      g.setTransform(...m);
      g.globalAlpha = 0.98;
      g.drawImage(img, 0, 0, asset.viewBox[0], asset.viewBox[1]);
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
    g.restore();
    g.globalAlpha = 1;
  }, [byId, garmentImage]);
  useEffect(() => { draw(); }, [sel, split, draw]);

  const stopAll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) { videoRef.current.srcObject = null; videoRef.current = null; }
    srcRef.current = null; poseRef.current = null;
    const cv = canvasRef.current; cv?.getContext("2d")?.clearRect(0, 0, cv.width, cv.height);
  }, []);
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden" && streamRef.current) { stopAll(); setPhase("consent"); setSource(null); } };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", stopAll);
    const cache = imgCache.current;
    return () => {
      document.removeEventListener("visibilitychange", onHide); window.removeEventListener("pagehide", stopAll);
      stopAll(); lmRef.current?.close(); lmRef.current = null;
      for (const img of cache.values()) URL.revokeObjectURL(img.src);
    };
  }, [stopAll]);

  async function loadLandmarker(mode: "IMAGE" | "VIDEO"): Promise<PoseLandmarkerT> {
    if (lmRef.current) { await lmRef.current.setOptions({ runningMode: mode }); return lmRef.current; }
    const vision = await import("@mediapipe/tasks-vision");
    const fileset = await vision.FilesetResolver.forVisionTasks("/mediapipe/wasm");
    const make = (delegate: "GPU" | "CPU") => vision.PoseLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: poseModelUrl, delegate }, runningMode: mode, numPoses: 2, minPoseDetectionConfidence: 0.5 });
    let lm: PoseLandmarkerT;
    try { lm = (await make("GPU")) as unknown as PoseLandmarkerT; } catch { lm = (await make("CPU")) as unknown as PoseLandmarkerT; }
    lmRef.current = lm;
    return lm;
  }
  const fail = (text: string) => { stopAll(); setIssue(text); setPhase("error"); };
  const started = (src: Source) => { void apiFetch("/api/v1/tryon/sessions", { method: "POST", body: { source: src, consentVersion: CONSENT_VERSION } }); void apiFetch("/api/v1/analytics", { method: "POST", body: { name: "tryon_started", props: { source: src, kind: "apparel" } } }); };

  async function useDemo() {
    setSource("demo"); setPhase("loading"); setIssue(null); setCloud({ step: "idle" }); started("demo");
    const img = new Image();
    const url = URL.createObjectURL(new Blob([demoBodySvg()], { type: "image/svg+xml" }));
    try {
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("load")); img.src = url; });
      const c = document.createElement("canvas"); c.width = DEMO_BODY.width; c.height = DEMO_BODY.height;
      c.getContext("2d")!.drawImage(img, 0, 0);
      srcRef.current = c; poseRef.current = demoBodyPose();
      setPhase("ready"); draw();
    } finally { URL.revokeObjectURL(url); }
  }

  async function useUpload(file: File) {
    const bad = validateUpload(file);
    if (bad) return fail(bad);
    setSource("upload"); setPhase("loading"); setIssue(null); setCloud({ step: "idle" }); started("upload");
    let bmp: ImageBitmap;
    try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { return fail("We couldn't read that image. Try a JPEG or PNG."); }
    const scale = Math.min(1, MAX_PROCESS_DIMENSION / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height); bmp.close();
    let lm: PoseLandmarkerT;
    try { lm = await loadLandmarker("IMAGE"); } catch { return fail("The body model couldn't load (offline or blocked). You can still use the illustrated demo figure."); }
    const poses = lm.detect(c).landmarks;
    const a = assessPoses(poses);
    if (!a.ok) return fail(POSE_ISSUE_MESSAGES[a.blocking as PoseIssue]);
    srcRef.current = c; poseRef.current = poses[0]!;
    setPhase("ready"); draw();
  }

  async function useCamera() {
    if (!navigator.mediaDevices?.getUserMedia) return fail("This browser doesn't support camera access. Upload a photo instead.");
    setSource("camera"); setPhase("loading"); setIssue(null); setCloud({ step: "idle" });
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } }, audio: false }); }
    catch (e) { return fail((e as DOMException).name === "NotAllowedError" ? "Camera permission was declined. You can upload a photo or use the demo figure instead." : "No camera was found. Upload a photo instead."); }
    streamRef.current = stream; started("camera");
    const video = document.createElement("video"); video.muted = true; video.playsInline = true; video.srcObject = stream; videoRef.current = video;
    await video.play().catch(() => undefined);
    let lm: PoseLandmarkerT;
    try { lm = await loadLandmarker("VIDEO"); } catch { return fail("The body model couldn't load. Try the demo figure or upload a photo."); }
    const work = document.createElement("canvas");
    let last = 0;
    setPhase("ready");
    const tick = () => {
      const v = videoRef.current;
      if (!v || !streamRef.current) return;
      if (v.videoWidth) {
        if (work.width !== v.videoWidth) { work.width = v.videoWidth; work.height = v.videoHeight; }
        const g = work.getContext("2d")!;
        g.save(); g.scale(-1, 1); g.drawImage(v, -work.width, 0); g.restore();
        const now = performance.now();
        if (now - last > 66) {
          last = now;
          const poses = lm.detectForVideo(v, now).landmarks.map((p) => p.map((q) => ({ ...q, x: 1 - q.x })));
          const a = assessPoses(poses);
          if (!a.ok) { poseRef.current = null; setIssue(POSE_ISSUE_MESSAGES[a.blocking as PoseIssue]); }
          else {
            // Light smoothing (EMA) against landmark jitter.
            const prev = poseRef.current as { x: number; y: number; visibility?: number }[] | null;
            poseRef.current = prev ? poses[0]!.map((q, i) => (prev[i] ? { ...q, x: prev[i]!.x * 0.5 + q.x * 0.5, y: prev[i]!.y * 0.5 + q.y * 0.5 } : q)) : poses[0]!;
            setIssue(null);
          }
        }
        srcRef.current = work;
        draw();
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }
  function close() { stopAll(); setSource(null); setPhase("consent"); setIssue(null); setCloud({ step: "idle" }); }

  // ---------------------------------------------------------------- selection
  function pick(p: GarmentProduct, colour: string) {
    const slot = slotOf(p.category);
    setSel((cur) => {
      const next = { ...cur };
      if (cur[slot]?.productId === p.productId && cur[slot]?.colour === colour) delete next[slot];
      else {
        next[slot] = { productId: p.productId, colour, size: cur[slot]?.productId === p.productId ? cur[slot]!.size : null, fitScale: cur[slot]?.fitScale ?? 1, offsetY: cur[slot]?.offsetY ?? 0 };
        if (p.category === "dress") delete next.outer; // keep looks simple: dress worn alone
      }
      return next;
    });
    void apiFetch("/api/v1/analytics", { method: "POST", body: { name: "tryon_effect_applied", props: { region: "garment", productId: p.productId } } });
  }
  const chosen = (["base", "outer"] as const).flatMap((slot) => { const s = sel[slot]; const p = s && byId.get(s.productId); return s && p ? [{ slot, s, p, v: variantFor(s) }] : []; });

  async function addToCart() {
    if (!signedIn) return setNotice({ tone: "error", text: <>Sign in to add to cart. <Link href="/sign-in?next=/try-on?mode=clothes">Sign in</Link></> });
    if (chosen.some((c) => !c.v)) return setNotice({ tone: "error", text: "Choose a size for each item first." });
    for (const c of chosen) {
      const r = await apiFetch("/api/v1/cart/items", { method: "POST", body: { productVariantId: c.v!.variantId, quantity: 1 } });
      if (!r.ok) return setNotice({ tone: "error", text: `${c.p.title}: ${r.error.message}` });
    }
    setNotice({ tone: "ok", text: <>Added {chosen.length} item{chosen.length === 1 ? "" : "s"} to your cart. <Link href="/cart">View cart</Link></> });
  }
  async function saveLook() {
    if (!signedIn) return setNotice({ tone: "error", text: <>Sign in to save looks. <Link href="/sign-in?next=/try-on?mode=clothes">Sign in</Link></> });
    if (chosen.some((c) => !c.v)) return setNotice({ tone: "error", text: "Choose a size for each item first." });
    const r = await apiFetch("/api/v1/looks", { method: "POST", body: { name: "Outfit", recipe: { version: 1, garments: chosen.map((c) => ({ productVariantId: c.v!.variantId, fitScale: c.s.fitScale, offsetY: c.s.offsetY })), engine: "glamotion-apparel@1" } } });
    setNotice(r.ok ? { tone: "ok", text: <>Outfit saved (items and fit settings only — no photo). <Link href="/saved-looks">View saved looks</Link></> } : { tone: "error", text: r.error.message });
  }

  // ---------------------------------------------------------------- opt-in cloud preview
  async function startCloud() {
    setCloud({ step: "checking" });
    const r = await apiFetch<{ available: boolean; disclosure: { processor: string; retention: string } | null }>("/api/v1/tryon/generative");
    if (!r.ok) return setCloud({ step: "error", text: r.error.message });
    if (!r.data.available || !r.data.disclosure) return setCloud({ step: "unavailable", text: "Realistic AI try-on isn't configured for this store yet. Nothing was uploaded — the on-device preview above is unchanged." });
    setCloudAck(false);
    setCloud({ step: "consent", disclosure: r.data.disclosure });
  }
  async function sendCloud() {
    const src = srcRef.current; const first = chosen[0];
    if (!src || !first?.v) return setCloud({ step: "error", text: "Choose an item and size first." });
    if (!signedIn) return setCloud({ step: "error", text: "Sign in to use AI previews." });
    setCloud((c) => ({ ...c, step: "sending" }));
    const person = await new Promise<Blob | null>((res) => src.toBlob(res, "image/jpeg", 0.9));
    const asset = garmentAsset(first.p.category)!; const [w, h] = asset.viewBox;
    const gc = document.createElement("canvas"); gc.width = w; gc.height = h;
    const gi = garmentImage(first.p.category, first.v.hex); if (gi) gc.getContext("2d")!.drawImage(gi, 0, 0, w, h);
    const garment = await new Promise<Blob | null>((res) => gc.toBlob(res, "image/png"));
    if (!person || !garment) return setCloud({ step: "error", text: "Couldn't prepare the images." });
    const form = new FormData();
    form.set("person", person, "person.jpg"); form.set("garment", garment, "garment.png");
    form.set("productVariantId", first.v.variantId); form.set("consent", "true"); form.set("consentVersion", CLOUD_CONSENT_VERSION);
    try {
      const res = await fetch("/api/v1/tryon/generative", { method: "POST", body: form, credentials: "same-origin" });
      if (!res.ok) { const e = await res.json().catch(() => ({})); return setCloud({ step: "error", text: e?.error?.message ?? "AI preview failed." }); }
      setCloud({ step: "done", url: URL.createObjectURL(await res.blob()) });
    } catch { setCloud({ step: "error", text: "You appear to be offline." }); }
  }

  const onStagePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1 && e.type !== "pointerdown") return;
    const r = e.currentTarget.getBoundingClientRect();
    setSplit(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
  };

  return (
    <div className="gm-tryon">
      <div className="gm-stack">
        {(phase === "consent" || phase === "error") && (
          <div className="gm-card gm-stack">
            <h2>Before we start</h2>
            <ul className="gm-small">
              <li><strong>On-device:</strong> body points are found in this browser. Your photo or camera never leaves your device for this preview.</li>
              <li><strong>Approximate:</strong> garments are drawn over your shoulders and hips as a 2D preview — not a measurement, and not a fit guarantee. Use the size guide to choose a size.</li>
              <li>No body measurements, shape analysis or identity recognition.</li>
            </ul>
            <label className="gm-check"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} data-testid="apparel-consent" />I&apos;m 18 or older and the photo or camera shows me, or someone who has agreed to this.</label>
            {issue && <div className="gm-alert gm-alert-error" role="alert" data-testid="apparel-issue">{issue}</div>}
            <div className="gm-row">
              <button className="gm-btn gm-btn-accent" onClick={useDemo} data-testid="use-demo-body">Use illustrated demo figure</button>
              <label className="gm-btn gm-btn-ghost" style={{ marginBottom: 0, opacity: ack ? 1 : 0.45, cursor: ack ? "pointer" : "not-allowed" }}>
                Upload a photo
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={!ack} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void useUpload(f); }} />
              </label>
              <button className="gm-btn gm-btn-ghost" disabled={!ack} onClick={useCamera} data-testid="apparel-camera">Use camera</button>
            </div>
            <p className="gm-muted gm-small">Best results: a front-facing photo from the waist up, arms slightly away from the body.</p>
          </div>
        )}
        <div className="gm-stage" onPointerDown={onStagePointer} onPointerMove={onStagePointer} hidden={phase !== "ready" && phase !== "loading"} aria-label="Before and after outfit preview">
          {phase === "loading" && <div className="gm-skeleton" style={{ width: "100%", aspectRatio: "2/3" }} aria-label="Loading preview" />}
          <canvas ref={canvasRef} data-testid="apparel-canvas" role="img" aria-label="Outfit preview: left side original, right side wearing the selected items" hidden={phase !== "ready"} />
          {phase === "ready" && <>
            <div className="gm-ba-handle" style={{ left: `${split * 100}%` }} />
            <span className="gm-ba-label" style={{ left: 10 }}>Before</span><span className="gm-ba-label" style={{ right: 10 }}>Wearing</span>
            <span className="gm-status-pill">{source === "camera" ? "Live · on-device" : source === "demo" ? "Illustrated demo figure" : "Your photo · on-device"}{issue ? ` · ${issue}` : ""}</span>
          </>}
        </div>
        {phase === "ready" && (
          <div className="gm-row">
            <label htmlFor="a-split" style={{ margin: 0 }}>Compare</label>
            <input id="a-split" type="range" min={0} max={100} value={Math.round(split * 100)} onChange={(e) => setSplit(Number(e.target.value) / 100)} style={{ flex: 1 }} />
            <button className="gm-btn gm-btn-ghost gm-btn-sm" onClick={close}>Close mirror</button>
          </div>
        )}
        {phase === "ready" && (
          <section className="gm-card gm-stack" aria-labelledby="cloud-h">
            <h3 id="cloud-h">Realistic preview (AI, optional)</h3>
            <p className="gm-small gm-muted">Generates a photo-realistic image of you wearing the first selected item. Unlike the preview above, this sends your photo to an AI service — only if you agree on the next step.</p>
            {cloud.step === "idle" && <button className="gm-btn gm-btn-ghost gm-btn-sm" onClick={startCloud} data-testid="cloud-start">Try realistic preview</button>}
            {cloud.step === "checking" && <p className="gm-small">Checking availability…</p>}
            {cloud.step === "unavailable" && <div className="gm-alert" role="status" data-testid="cloud-unavailable">{cloud.text}</div>}
            {cloud.step === "consent" && cloud.disclosure && (
              <div className="gm-stack">
                <ul className="gm-small">
                  <li>Your photo and the garment image are sent to <strong>{cloud.disclosure.processor}</strong> to generate one image.</li>
                  <li>GLAMOTION does not store your photo or the result. Processor retention: {cloud.disclosure.retention}</li>
                  <li>The result is an AI illustration, not a guarantee of fit or colour.</li>
                </ul>
                <label className="gm-check"><input type="checkbox" checked={cloudAck} onChange={(e) => setCloudAck(e.target.checked)} />I agree to send this photo for AI processing.</label>
                <div className="gm-row"><button className="gm-btn gm-btn-accent gm-btn-sm" disabled={!cloudAck} onClick={sendCloud}>Generate</button><button className="gm-btn gm-btn-ghost gm-btn-sm" onClick={() => setCloud({ step: "idle" })}>Cancel</button></div>
              </div>
            )}
            {cloud.step === "sending" && <div className="gm-skeleton" style={{ height: 200 }} aria-label="Generating" />}
            {cloud.step === "done" && cloud.url && <img src={cloud.url} alt="AI-generated preview of the selected item" style={{ maxWidth: "100%", borderRadius: 8 }} />}
            {cloud.step === "error" && <div className="gm-alert gm-alert-error" role="alert">{cloud.text}</div>}
          </section>
        )}
      </div>

      <aside className="gm-card" aria-label="Outfit controls">
        {products.length === 0 && <p className="gm-muted">No clothing published yet.</p>}
        {products.map((p) => {
          const slot = slotOf(p.category); const s = sel[slot]?.productId === p.productId ? sel[slot]! : null;
          const colours = [...new Map(p.variants.map((v) => [v.colour, v.hex])).entries()];
          const sizes = [...new Set(p.variants.map((v) => v.size))].sort(compareSizes);
          const v = s ? variantFor(s) : null;
          return (
            <section key={p.productId} className="gm-region" aria-labelledby={`g-${p.productId}`}>
              <h3 id={`g-${p.productId}`}>{p.title}</h3>
              <div className="gm-muted gm-small">{p.brandName} · {p.category} · {money(p.variants[0]!.priceMinor, p.variants[0]!.currency)}</div>
              <div className="gm-swatch-rail" role="group" aria-label={`${p.title} colours`}>
                {colours.map(([c, hex]) => <ShadeSwatch key={c} hex={hex} name={`${p.title} — ${c}`} selected={s?.colour === c} onSelect={() => pick(p, c)} />)}
              </div>
              {s && (
                <div className="gm-stack">
                  <div className="gm-row" role="group" aria-label="Size">
                    {sizes.map((z) => {
                      const sv = p.variants.find((x) => x.colour === s.colour && x.size === z);
                      const out = !sv || sv.available <= 0;
                      return <button key={z} type="button" className={`gm-btn gm-btn-sm ${s.size === z ? "" : "gm-btn-ghost"}`} aria-pressed={s.size === z} disabled={out} title={out ? "Out of stock" : undefined}
                        onClick={() => setSel((cur) => ({ ...cur, [slot]: { ...s, size: z } }))} data-testid={`size-${p.slug}-${z}`}>{z}</button>;
                    })}
                  </div>
                  {v && <div className="gm-small">{s.colour} · {v.size} · {v.available < 5 ? `only ${v.available} left` : "in stock"}</div>}
                  <label htmlFor={`fit-${p.productId}`} className="gm-small">Preview width {Math.round(s.fitScale * 100)}%</label>
                  <input id={`fit-${p.productId}`} type="range" min={80} max={130} value={Math.round(s.fitScale * 100)} onChange={(e) => setSel((cur) => ({ ...cur, [slot]: { ...s, fitScale: Number(e.target.value) / 100 } }))} />
                  <label htmlFor={`off-${p.productId}`} className="gm-small">Preview position</label>
                  <input id={`off-${p.productId}`} type="range" min={-30} max={30} value={Math.round(s.offsetY * 100)} onChange={(e) => setSel((cur) => ({ ...cur, [slot]: { ...s, offsetY: Number(e.target.value) / 100 } }))} />
                </div>
              )}
            </section>
          );
        })}
        <div className="gm-region gm-stack">
          <div className="gm-row">
            <button className="gm-btn" disabled={chosen.length === 0} onClick={saveLook} data-testid="save-outfit">Save outfit</button>
            <button className="gm-btn gm-btn-accent" disabled={chosen.length === 0} onClick={addToCart} data-testid="apparel-add-to-cart">Add {chosen.length || ""} to cart</button>
          </div>
          {notice && <div className={`gm-alert gm-alert-${notice.tone}`} role="status">{notice.text}</div>}
          <p className="gm-disclaimer" role="note">The clothes mirror is a 2D illustration. It doesn&apos;t measure your body or predict fit — check the size guide before ordering.</p>
        </div>
      </aside>
    </div>
  );
}

export const GARMENT_ASSET_IDS = Object.keys(BUILTIN_ASSETS).filter((k) => k.startsWith("asset:garment"));
