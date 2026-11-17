"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MotionComposition } from "@glamotion/contracts";
import { renderFrameSvg, totalFrames } from "@glamotion/motion";

/** Deterministic SVG preview player (same renderer as the export worker). Honours reduced motion. */
export function FramePlayer({ doc, frame: controlled, onFrame, maxHeight = 520, showSafeArea }: { doc: MotionComposition; frame?: number; onFrame?: (f: number) => void; maxHeight?: number; showSafeArea?: boolean }) {
  const [internal, setInternal] = useState(0);
  const [playing, setPlaying] = useState(false);
  const frame = controlled ?? internal;
  const setFrame = (f: number) => { setInternal(f); onFrame?.(f); };
  const total = totalFrames(doc);
  const raf = useRef<number | null>(null);
  const frameRef = useRef(frame);
  frameRef.current = frame;
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const step = (t: number) => {
      const adv = Math.floor(((t - last) / 1000) * doc.fps);
      if (adv > 0) { last = t; const n = frameRef.current + adv; if (n >= total) { setPlaying(false); setFrame(total - 1); return; } setFrame(n); }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, total, doc.fps]);
  const svg = useMemo(() => renderFrameSvg(doc, frame, { scale: maxHeight / doc.height, showSafeArea }), [doc, frame, maxHeight, showSafeArea]);
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return (
    <div className="gm-stack">
      <div className="gm-preview" aria-label={`Frame ${frame + 1} of ${total}`} dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="gm-row">
        <button className="gm-btn gm-btn-sm" onClick={() => { if (frame >= total - 1) setFrame(0); setPlaying((p) => !p); }} aria-pressed={playing}>{playing ? "Pause" : reduced ? "Play (reduced motion: use scrubber)" : "Play"}</button>
        <label htmlFor="scrub" className="gm-skip">Scrub timeline</label>
        <input id="scrub" type="range" min={0} max={total - 1} value={frame} onChange={(e) => { setPlaying(false); setFrame(Number(e.target.value)); }} style={{ flex: 1, minWidth: 160 }} data-testid="scrubber" />
        <span className="gm-small gm-muted" style={{ fontVariantNumeric: "tabular-nums" }}>{(frame / doc.fps).toFixed(2)}s / {(total / doc.fps).toFixed(2)}s · f{frame}</span>
      </div>
    </div>
  );
}
