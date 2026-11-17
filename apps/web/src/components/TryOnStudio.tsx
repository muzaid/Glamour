"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { CosmeticRegion, Finish } from "@glamotion/contracts";
import {
  applyMakeup, assessDetection, demoFaceLandmarks, demoFaceSvg, DEMO_FACE, ENGINE_VERSION, ISSUE_MESSAGES, MAX_PROCESS_DIMENSION, validateUpload,
  type Landmarks, type MakeupLayer, type PixelBuffer, type TryOnIssue,
} from "@glamotion/tryon";
import { ShadeSwatch, Disclaimer } from "@glamotion/ui";
import { apiFetch, money } from "./client";

export interface TryOnShade {
  variantId: string; region: CosmeticRegion; productTitle: string; productSlug: string; brandName: string; shadeName: string;
  hex: string; finish: Finish; defaultOpacity: number; priceMinor: number; currency: string; available: number;
}
type Selection = Partial<Record<CosmeticRegion, { variantId: string; opacity: number }>>;
type Source = "demo" | "upload" | "camera";
type Phase = "consent" | "loading" | "ready" | "error";
type FaceLandmarkerT = { detect(img: TexImageSource): { faceLandmarks: { x: number; y: number }[][] }; detectForVideo(v: HTMLVideoElement, t: number): { faceLandmarks: { x: number; y: number }[][] }; setOptions(o: object): Promise<void>; close(): void };

const REGIONS: { id: CosmeticRegion; label: string }[] = [{ id: "lips", label: "Lips" }, { id: "cheeks", label: "Cheeks" }, { id: "eyelids", label: "Eyelids" }];
const CONSENT_VERSION = "2026-11-tryon-v1";

export function TryOnStudio({ shades, initial, signedIn, modelUrl }: { shades: TryOnShade[]; initial: Selection; signedIn: boolean; modelUrl: string }) {
  const [phase, setPhase] = useState<Phase>("consent");
  const [source, setSource] = useState<Source | null>(null);
  const [ack, setAck] = useState(false);
  const [issue, setIssue] = useState<{ code: TryOnIssue | "CAMERA_DENIED" | "NO_CAMERA" | "UNSUPPORTED" | "MODEL_UNAVAILABLE" | "BAD_FILE"; text: string } | null>(null);
  const [warnings, setWarnings] = useState<TryOnIssue[]>([]);
  const [sel, setSel] = useState<Selection>(initial);
  const [split, setSplit] = useState(0.5);
  const [lighting, setLighting] = useState<"neutral" | "warm" | "cool">("neutral");
  const [lookName, setLookName] = useState("My look");
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: React.ReactNode } | null>(null);
  const [fps, setFps] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const srcRef = useRef<PixelBuffer | null>(null);
  const outRef = useRef<PixelBuffer | null>(null);
  const lmsRef = useRef<Landmarks | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarkerT | null>(null);
  const rafRef = useRef<number | null>(null);
  const layersRef = useRef<MakeupLayer[]>([]);
  const splitRef = useRef(split);
  splitRef.current = split;

  const byId = useMemo(() => new Map(shades.map((s) => [s.variantId, s])), [shades]);
  const layers = useMemo<MakeupLayer[]>(() => REGIONS.flatMap(({ id }) => {
    const s = sel[id]; const shade = s && byId.get(s.variantId);
    return s && shade ? [{ region: id, hex: shade.hex, finish: shade.finish, opacity: s.opacity }] : [];
  }), [sel, byId]);
  layersRef.current = layers;

  // ---------------------------------------------------------------- cleanup: stop camera + free buffers deterministically
  const stopAll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) { videoRef.current.srcObject = null; videoRef.current = null; }
    srcRef.current = null; outRef.current = null; lmsRef.current = null;
    const cv = canvasRef.current; cv?.getContext("2d")?.clearRect(0, 0, cv.width, cv.height);
  }, []);
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden" && streamRef.current) { stopAll(); setPhase("consent"); setSource(null); } };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", stopAll);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", stopAll);
      stopAll();
      landmarkerRef.current?.close(); landmarkerRef.current = null;
    };
  }, [stopAll]);

  // ---------------------------------------------------------------- drawing
  const draw = useCallback(() => {
    const cv = canvasRef.current, src = srcRef.current, out = outRef.current;
    if (!cv || !src || !out) return;
    if (cv.width !== src.width || cv.height !== src.height) { cv.width = src.width; cv.height = src.height; }
    const g = cv.getContext("2d")!;
    g.putImageData(new ImageData(new Uint8ClampedArray(src.data), src.width, src.height), 0, 0);
    const x = Math.round(src.width * splitRef.current);
    if (x < src.width) {
      const w = src.width - x;
      const after = new ImageData(src.width, src.height);
      after.data.set(out.data);
      g.putImageData(after, 0, 0, x, 0, w, src.height);
    }
  }, []);

  const recomposite = useCallback(() => {
    const src = srcRef.current, lms = lmsRef.current;
    if (!src || !lms) return;
    outRef.current = applyMakeup(src, lms, layersRef.current, { lighting });
    draw();
  }, [draw, lighting]);

  useEffect(() => { if (source !== "camera") recomposite(); }, [layers, lighting, recomposite, source]);
  useEffect(() => { if (source !== "camera") draw(); }, [split, draw, source]);

  // ---------------------------------------------------------------- model
  async function loadLandmarker(mode: "IMAGE" | "VIDEO"): Promise<FaceLandmarkerT> {
    if (landmarkerRef.current) { await landmarkerRef.current.setOptions({ runningMode: mode }); return landmarkerRef.current; }
    const vision = await import("@mediapipe/tasks-vision");
    const fileset = await vision.FilesetResolver.forVisionTasks("/mediapipe/wasm");
    const make = (delegate: "GPU" | "CPU") => vision.FaceLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: modelUrl, delegate }, runningMode: mode, numFaces: 2, minFaceDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
    let lm: FaceLandmarkerT;
    try { lm = (await make("GPU")) as unknown as FaceLandmarkerT; } catch { lm = (await make("CPU")) as unknown as FaceLandmarkerT; }
    landmarkerRef.current = lm;
    return lm;
  }

  function startSession(src: Source) {
    void apiFetch("/api/v1/tryon/sessions", { method: "POST", body: { source: src, consentVersion: CONSENT_VERSION } });
    void apiFetch("/api/v1/analytics", { method: "POST", body: { name: "tryon_started", props: { source: src } } });
  }

  function fail(code: NonNullable<typeof issue>["code"], text?: string) {
    stopAll();
    setIssue({ code, text: text ?? ISSUE_MESSAGES[code as TryOnIssue] ?? "Something went wrong." });
    setPhase("error");
  }

  // ---------------------------------------------------------------- sources
  async function useDemo() {
    setSource("demo"); setPhase("loading"); setIssue(null); startSession("demo");
    const img = new Image();
    const url = URL.createObjectURL(new Blob([demoFaceSvg()], { type: "image/svg+xml" }));
    try {
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("load")); img.src = url; });
      const c = document.createElement("canvas"); c.width = DEMO_FACE.width; c.height = DEMO_FACE.height;
      const g = c.getContext("2d")!; g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height);
      srcRef.current = { width: d.width, height: d.height, data: d.data };
      lmsRef.current = demoFaceLandmarks();
      setWarnings([]); setPhase("ready"); recomposite();
    } finally { URL.revokeObjectURL(url); }
  }

  async function useUpload(file: File) {
    const bad = validateUpload(file);
    if (bad) return fail("BAD_FILE", bad);
    setSource("upload"); setPhase("loading"); setIssue(null); startSession("upload");
    let bmp: ImageBitmap;
    try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { return fail("BAD_FILE", "We couldn't read that image. Try a JPEG or PNG."); }
    const scale = Math.min(1, MAX_PROCESS_DIMENSION / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    const g = c.getContext("2d")!; g.drawImage(bmp, 0, 0, c.width, c.height); bmp.close();
    let lm: FaceLandmarkerT;
    try { lm = await loadLandmarker("IMAGE"); } catch { return fail("MODEL_UNAVAILABLE", "The face model couldn't load (offline or blocked). You can still use the illustrated demo face."); }
    const faces = lm.detect(c).faceLandmarks;
    const d = g.getImageData(0, 0, c.width, c.height);
    const buf = { width: d.width, height: d.height, data: d.data };
    const a = assessDetection(faces, buf);
    if (!a.ok) return fail(a.blocking!);
    srcRef.current = buf; lmsRef.current = faces[0]!;
    setWarnings(a.warnings); setPhase("ready"); recomposite();
  }

  async function useCamera() {
    if (!navigator.mediaDevices?.getUserMedia) return fail("UNSUPPORTED", "This browser doesn't support camera access. Upload a photo instead.");
    setSource("camera"); setPhase("loading"); setIssue(null);
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }); }
    catch (e) {
      const name = (e as DOMException).name;
      return fail(name === "NotAllowedError" ? "CAMERA_DENIED" : "NO_CAMERA", name === "NotAllowedError" ? "Camera permission was declined. You can upload a photo or use the demo face instead." : "No camera was found. Upload a photo instead.");
    }
    streamRef.current = stream; startSession("camera");
    const video = document.createElement("video"); video.muted = true; video.playsInline = true; video.srcObject = stream;
    videoRef.current = video;
    await video.play().catch(() => undefined);
    let lm: FaceLandmarkerT;
    try { lm = await loadLandmarker("VIDEO"); } catch { return fail("MODEL_UNAVAILABLE", "The face model couldn't load. Try the demo face or upload a photo."); }
    const work = document.createElement("canvas");
    let lastDetect = 0, frames = 0, fpsT = performance.now();
    setPhase("ready");
    const tick = () => {
      if (!videoRef.current || !streamRef.current) return;
      const v = videoRef.current;
      if (v.videoWidth) {
        if (work.width !== v.videoWidth) { work.width = v.videoWidth; work.height = v.videoHeight; }
        const g = work.getContext("2d", { willReadFrequently: true })!;
        g.save(); g.scale(-1, 1); g.drawImage(v, -work.width, 0); g.restore(); // mirrored preview
        const now = performance.now();
        if (now - lastDetect > 66) { // throttle landmarking to ~15 Hz
          lastDetect = now;
          const faces = lm.detectForVideo(v, now).faceLandmarks.map((f) => f.map((p) => ({ x: 1 - p.x, y: p.y })));
          const a = assessDetection(faces);
          if (!a.ok) { lmsRef.current = null; setIssue({ code: a.blocking!, text: ISSUE_MESSAGES[a.blocking!] }); }
          else { lmsRef.current = faces[0]!; setIssue(null); }
        }
        const d = g.getImageData(0, 0, work.width, work.height);
        srcRef.current = { width: d.width, height: d.height, data: d.data };
        outRef.current = lmsRef.current ? applyMakeup(srcRef.current, lmsRef.current, layersRef.current, { lighting }) : srcRef.current;
        draw();
        frames++;
        if (now - fpsT > 1000) { setFps(Math.round((frames * 1000) / (now - fpsT))); frames = 0; fpsT = now; }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function closeSource() { stopAll(); setSource(null); setPhase("consent"); setIssue(null); setFps(null); }

  // ---------------------------------------------------------------- actions
  function choose(region: CosmeticRegion, s: TryOnShade) {
    setSel((cur) => ({ ...cur, [region]: cur[region]?.variantId === s.variantId ? undefined : { variantId: s.variantId, opacity: cur[region]?.opacity ?? s.defaultOpacity } }));
    void apiFetch("/api/v1/analytics", { method: "POST", body: { name: "tryon_effect_applied", props: { region, variantId: s.variantId } } });
  }
  const selectedShades = REGIONS.flatMap(({ id }) => { const s = sel[id]; const sh = s && byId.get(s.variantId); return sh ? [{ region: id, ...s, shade: sh }] : []; });

  async function saveLook() {
    if (!signedIn) { setNotice({ tone: "error", text: <>Sign in to save looks. <Link href="/sign-in?next=/try-on">Sign in</Link></> }); return; }
    const recipe = { version: 1, selectedProducts: selectedShades.map((s) => ({ productVariantId: s.variantId, cosmeticRegion: s.region, opacity: s.opacity, hueShift: 0, gloss: 0 })), lightingPreset: lighting, engine: ENGINE_VERSION };
    const r = await apiFetch("/api/v1/looks", { method: "POST", body: { name: lookName.trim() || "My look", recipe } });
    setNotice(r.ok ? { tone: "ok", text: <>Look saved (shades and settings only — no photo). <Link href="/saved-looks">View saved looks</Link></> } : { tone: "error", text: r.error.message });
  }
  async function addToCart() {
    if (!signedIn) { setNotice({ tone: "error", text: <>Sign in to add to cart. <Link href="/sign-in?next=/try-on">Sign in</Link></> }); return; }
    for (const s of selectedShades) {
      const r = await apiFetch("/api/v1/cart/items", { method: "POST", body: { productVariantId: s.variantId, quantity: 1 } });
      if (!r.ok) { setNotice({ tone: "error", text: `${s.shade.shadeName}: ${r.error.message}` }); return; }
    }
    setNotice({ tone: "ok", text: <>Added {selectedShades.length} shade{selectedShades.length === 1 ? "" : "s"} to your cart. <Link href="/cart">View cart</Link></> });
  }

  // ---------------------------------------------------------------- UI
  const onStagePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1 && e.type !== "pointerdown") return;
    const r = e.currentTarget.getBoundingClientRect();
    setSplit(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
  };

  return (
    <div className="gm-tryon">
      <div className="gm-stack">
        {phase === "consent" || phase === "error" ? (
          <div className="gm-card gm-stack" aria-labelledby="consent-title">
            <h2 id="consent-title">Before we start</h2>
            <ul className="gm-small">
              <li><strong>On-device:</strong> your camera and photos are processed in this browser. Nothing is uploaded.</li>
              <li><strong>Not stored:</strong> the camera stops when you close the mirror or leave the page. Saving a look stores only shade choices.</li>
              <li><strong>Illustrative:</strong> previews are simulations — real colour varies with light, camera and screen.</li>
              <li>No face recognition, no skin analysis, no inference about who you are.</li>
            </ul>
            <label className="gm-check"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} data-testid="consent-ack" />I&apos;m 18 or older and the photo or camera shows me, or someone who has agreed to this.</label>
            {issue && <div className="gm-alert gm-alert-error" role="alert" data-testid="tryon-issue">{issue.text}</div>}
            <div className="gm-row">
              <button className="gm-btn gm-btn-accent" onClick={useDemo} data-testid="use-demo">Use illustrated demo face</button>
              <label className={`gm-btn gm-btn-ghost${ack ? "" : " gm-disabled"}`} style={{ marginBottom: 0, opacity: ack ? 1 : 0.45, cursor: ack ? "pointer" : "not-allowed" }}>
                Upload a photo
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={!ack} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void useUpload(f); }} data-testid="upload-input" />
              </label>
              <button className="gm-btn gm-btn-ghost" disabled={!ack} onClick={useCamera} data-testid="use-camera">Use camera</button>
            </div>
            <p className="gm-muted gm-small">The illustrated demo face is synthetic artwork and needs no consent.</p>
          </div>
        ) : null}
        <div className="gm-stage" onPointerDown={onStagePointer} onPointerMove={onStagePointer} hidden={phase !== "ready" && phase !== "loading"} aria-label="Before and after preview">
          {phase === "loading" && <div className="gm-skeleton" style={{ width: "100%", aspectRatio: "3/4" }} aria-label="Loading preview" />}
          <canvas ref={canvasRef} data-testid="tryon-canvas" role="img" aria-label="Makeup preview: left side original, right side with makeup" hidden={phase !== "ready"} />
          {phase === "ready" && <>
            <div className="gm-ba-handle" style={{ left: `${split * 100}%` }} />
            <span className="gm-ba-label" style={{ left: 10 }}>Before</span><span className="gm-ba-label" style={{ right: 10 }}>After</span>
            <span className="gm-status-pill">{source === "camera" ? `Live · on-device${fps ? ` · ${fps} fps` : ""}` : source === "demo" ? "Illustrated demo face" : "Your photo · on-device"}{issue ? ` · ${issue.text}` : ""}</span>
          </>}
        </div>
        {phase === "ready" && (
          <div className="gm-row">
            <label htmlFor="split" style={{ margin: 0 }}>Compare</label>
            <input id="split" type="range" min={0} max={100} value={Math.round(split * 100)} onChange={(e) => setSplit(Number(e.target.value) / 100)} style={{ flex: 1 }} aria-valuetext={`${Math.round((1 - split) * 100)}% showing makeup`} />
            <select className="gm-input" style={{ width: 140 }} value={lighting} onChange={(e) => setLighting(e.target.value as typeof lighting)} aria-label="Lighting preview">
              <option value="neutral">Neutral light</option><option value="warm">Warm light</option><option value="cool">Cool light</option>
            </select>
            <button className="gm-btn gm-btn-ghost gm-btn-sm" onClick={closeSource} data-testid="close-mirror">Close mirror</button>
          </div>
        )}
        {warnings.length > 0 && <div className="gm-alert" role="status">{warnings.map((w) => ISSUE_MESSAGES[w]).join(" ")}</div>}
      </div>

      <aside className="gm-card" aria-label="Makeup controls">
        {REGIONS.map(({ id, label }) => {
          const opts = shades.filter((s) => s.region === id);
          const cur = sel[id];
          return (
            <section key={id} className="gm-region" aria-labelledby={`r-${id}`}>
              <h3 id={`r-${id}`}>{label}</h3>
              {opts.length === 0 ? <p className="gm-muted gm-small">No products yet.</p> : (
                <div className="gm-swatch-rail" role="group" aria-label={`${label} shades`}>
                  {opts.map((s) => <ShadeSwatch key={s.variantId} hex={s.hex} name={`${s.productTitle} — ${s.shadeName}`} selected={cur?.variantId === s.variantId} onSelect={() => choose(id, s)} />)}
                </div>
              )}
              {cur && byId.get(cur.variantId) && (
                <div>
                  <div className="gm-small">{byId.get(cur.variantId)!.productTitle} — <strong>{byId.get(cur.variantId)!.shadeName}</strong> · {money(byId.get(cur.variantId)!.priceMinor, byId.get(cur.variantId)!.currency)}</div>
                  <label htmlFor={`op-${id}`} className="gm-small">Intensity {Math.round(cur.opacity * 100)}%</label>
                  <input id={`op-${id}`} type="range" min={0} max={100} value={Math.round(cur.opacity * 100)} data-testid={`opacity-${id}`}
                    onChange={(e) => setSel((s) => ({ ...s, [id]: { ...cur, opacity: Number(e.target.value) / 100 } }))} />
                </div>
              )}
            </section>
          );
        })}
        <div className="gm-region gm-stack">
          <label htmlFor="look-name">Look name</label>
          <input id="look-name" className="gm-input" value={lookName} maxLength={80} onChange={(e) => setLookName(e.target.value)} />
          <div className="gm-row">
            <button className="gm-btn" disabled={selectedShades.length === 0} onClick={saveLook} data-testid="save-look">Save look</button>
            <button className="gm-btn gm-btn-accent" disabled={selectedShades.length === 0 || selectedShades.some((s) => s.shade.available <= 0)} onClick={addToCart} data-testid="tryon-add-to-cart">Add {selectedShades.length || ""} to cart</button>
          </div>
          {notice && <div className={`gm-alert gm-alert-${notice.tone}`} role="status">{notice.text}</div>}
          <Disclaimer />
        </div>
      </aside>
    </div>
  );
}
