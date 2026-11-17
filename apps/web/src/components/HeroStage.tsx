"use client";
import { useState } from "react";

/** Moving brand hero; pausable, and static under prefers-reduced-motion. */
export function HeroStage({ swatches }: { swatches: { hex: string; name: string }[] }) {
  const [paused, setPaused] = useState(false);
  const n = swatches.length || 1;
  return (
    <div className={`gm-hero-stage${paused ? " gm-paused" : ""}`}>
      <div className="gm-orbit" aria-hidden="true">
        {swatches.map((s, i) => {
          const a = (i / n) * Math.PI * 2;
          return <span key={s.hex + i} style={{ position: "absolute", left: `${50 + 40 * Math.cos(a)}%`, top: `${50 + 40 * Math.sin(a)}%`, width: 54, height: 54, marginLeft: -27, marginTop: -27, borderRadius: "50%", background: s.hex, boxShadow: "0 0 0 3px #191922, 0 10px 30px rgba(0,0,0,.4)" }} />;
        })}
      </div>
      <div style={{ position: "absolute", inset: "22%", borderRadius: "50%", background: "radial-gradient(circle at 40% 35%, #3a2930, #191922)", display: "grid", placeItems: "center", textAlign: "center", padding: 24 }}>
        <div>
          <div className="gm-eyebrow">Beauty Mirror</div>
          <div style={{ fontFamily: "var(--gm-font-display)", fontSize: 26 }}>{n} colours,<br />one tap away</div>
        </div>
      </div>
      <button type="button" className="gm-btn gm-btn-ghost gm-btn-sm gm-hero-pause" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>{paused ? "Play" : "Pause"} motion</button>
    </div>
  );
}
