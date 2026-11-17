import type { DesignLayer, MotionComposition } from "@glamotion/contracts";
import { trackValue } from "./interpolate";
import { BUILTIN_ASSETS } from "./assets";

export function totalFrames(c: MotionComposition): number {
  return c.scenes.reduce((n, s) => n + s.durationInFrames, 0);
}

/** Map a global frame onto (scene, local frame). */
export function locateFrame(c: MotionComposition, frame: number) {
  let f = Math.max(0, Math.min(frame, totalFrames(c) - 1));
  for (const scene of c.scenes) {
    if (f < scene.durationInFrames) return { scene, local: f };
    f -= scene.durationInFrames;
  }
  const last = c.scenes[c.scenes.length - 1]!;
  return { scene: last, local: last.durationInFrames - 1 };
}

export const escapeXml = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!)
   // strip control chars except tab/newline
   .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

const FONT = { display: "'Playfair Display', 'Didot', Georgia, serif", sans: "'Inter', 'Helvetica Neue', Arial, sans-serif" };

function layerBody(layer: DesignLayer, uid: string): string {
  const { w, h } = layer.transform;
  switch (layer.type) {
    case "rect":
      return `<rect width="${w}" height="${h}" rx="${layer.radius}" fill="${layer.fill}"/>`;
    case "ellipse":
      return `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${layer.fill}"/>`;
    case "text": {
      const anchor = layer.align === "start" ? "start" : layer.align === "end" ? "end" : "middle";
      const x = layer.align === "start" ? 0 : layer.align === "end" ? w : w / 2;
      const lines = layer.text.split("\n");
      const lh = layer.fontSize * 1.15;
      const y0 = h / 2 - ((lines.length - 1) * lh) / 2;
      return lines
        .map((ln, i) => `<text x="${x}" y="${y0 + i * lh}" dominant-baseline="central" text-anchor="${anchor}" font-family="${FONT[layer.fontFamily]}" font-size="${layer.fontSize}" font-weight="${layer.fontWeight}" fill="${layer.color}">${escapeXml(ln)}</text>`)
        .join("");
    }
    case "image": {
      const asset = BUILTIN_ASSETS[layer.assetId];
      if (!asset) return ""; // preflight rejects unknown assets before render
      const [vw, vh] = asset.viewBox;
      const par = layer.fit === "cover" ? "xMidYMid slice" : "xMidYMid meet";
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${vw} ${vh}" preserveAspectRatio="${par}">${asset.svg(layer.tint ?? "#E6A7B0").replace(/gm-/g, `gm-${uid}-`)}</svg>`;
    }
    case "swatch": {
      const r = Math.min(w, h * 0.72) / 2;
      return `<circle cx="${w / 2}" cy="${r}" r="${r}" fill="${layer.hex}"/><circle cx="${w / 2 - r * 0.35}" cy="${r * 0.65}" r="${r * 0.28}" fill="#fff" opacity=".18"/>` +
        `<text x="${w / 2}" y="${2 * r + h * 0.14}" dominant-baseline="central" text-anchor="middle" font-family="${FONT.sans}" font-size="${Math.max(12, h * 0.1)}" fill="#FAF7F3">${escapeXml(layer.label)}</text>`;
    }
  }
}

/**
 * Deterministic frame → SVG. The same function drives the in-browser preview
 * and the worker's rasteriser, so preview == export (modulo fonts).
 */
export function renderFrameSvg(c: MotionComposition, frame: number, opts: { scale?: number; showSafeArea?: boolean } = {}): string {
  const scale = opts.scale ?? 1;
  const { scene, local } = locateFrame(c, frame);
  const parts: string[] = [];
  parts.push(`<rect width="${c.width}" height="${c.height}" fill="${scene.background}"/>`);
  scene.elements.forEach((el, idx) => {
    if (local < el.startFrame || local >= el.endFrame || !el.layer.visible) return;
    const f = local - el.startFrame;
    const t = el.layer.transform;
    const dx = trackValue(el.tracks, "x", f), dy = trackValue(el.tracks, "y", f);
    const op = Math.max(0, Math.min(1, trackValue(el.tracks, "opacity", f) * el.layer.opacity));
    const rot = trackValue(el.tracks, "rotation", f) + t.rotation;
    const sc = trackValue(el.tracks, "scale", f);
    const blur = Math.max(0, trackValue(el.tracks, "blur", f));
    if (op <= 0.001 || sc <= 0) return;
    const cx = t.x + t.w / 2 + dx, cy = t.y + t.h / 2 + dy;
    const uid = `${scene.id}-${idx}`;
    const filter = blur > 0.05 ? ` filter="url(#b-${uid})"` : "";
    const defs = blur > 0.05 ? `<defs><filter id="b-${uid}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${blur.toFixed(2)}"/></filter></defs>` : "";
    parts.push(`${defs}<g data-el="${escapeXml(el.layer.id)}" opacity="${op.toFixed(4)}"${filter} transform="translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${rot.toFixed(3)}) scale(${sc.toFixed(4)}) translate(${(-t.w / 2).toFixed(2)} ${(-t.h / 2).toFixed(2)})">${layerBody(el.layer, uid)}</g>`);
  });
  if (opts.showSafeArea) parts.push(safeAreaOverlay(c));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(c.width * scale)}" height="${Math.round(c.height * scale)}" viewBox="0 0 ${c.width} ${c.height}">${parts.join("")}</svg>`;
}

import { SAFE_AREA } from "./aspect";
function safeAreaOverlay(c: MotionComposition) {
  const s = SAFE_AREA[c.aspectRatio];
  const x = c.width * s.left, y = c.height * s.top, w = c.width * (1 - s.left - s.right), h = c.height * (1 - s.top - s.bottom);
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#9C86EA" stroke-dasharray="12 10" stroke-width="3" opacity=".8"/>`;
}
