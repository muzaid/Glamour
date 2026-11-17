import type { CosmeticRegion } from "@glamotion/contracts";
import { CHEEK_L, CHEEK_R, EYE_L_BROW, EYE_L_UPPER, EYE_R_BROW, EYE_R_UPPER, FACE_EDGE_L, FACE_EDGE_R, LIPS_INNER, LIPS_OUTER, lm, type Landmarks, type Point } from "./landmarks";
import { feather, radialMask, rasterize, type Mask } from "./raster";

const px = (l: Landmarks, i: number, w: number, h: number): Point => { const p = lm(l, i); return { x: p.x * w, y: p.y * h }; };

export function faceWidthPx(l: Landmarks, w: number, h: number) {
  const a = px(l, FACE_EDGE_L, w, h), b = px(l, FACE_EDGE_R, w, h);
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Resample a polyline at n evenly spaced parameter values. */
function resample(pts: Point[], n: number): Point[] {
  const seg: number[] = [0];
  for (let i = 1; i < pts.length; i++) seg.push(seg[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
  const total = seg[seg.length - 1]! || 1;
  const out: Point[] = [];
  for (let k = 0; k < n; k++) {
    const d = (k / (n - 1)) * total;
    let i = 1;
    while (i < seg.length - 1 && seg[i]! < d) i++;
    const t = (d - seg[i - 1]!) / ((seg[i]! - seg[i - 1]!) || 1);
    out.push({ x: pts[i - 1]!.x + (pts[i]!.x - pts[i - 1]!.x) * t, y: pts[i - 1]!.y + (pts[i]!.y - pts[i - 1]!.y) * t });
  }
  return out;
}

/** Eyeshadow band: from the upper lid line ~55% of the way up to the brow; never below the lid (eye whites preserved). */
function eyelidPolygon(l: Landmarks, upper: readonly number[], brow: readonly number[], w: number, h: number): Point[] {
  const lid = resample(upper.map((i) => px(l, i, w, h)), 16);
  const br = resample(brow.map((i) => px(l, i, w, h)), 16);
  const top = lid.map((p, k) => ({ x: p.x + (br[k]!.x - p.x) * 0.55, y: p.y + (br[k]!.y - p.y) * 0.55 }));
  // Lift the lid edge slightly so pigment stops at the lash line.
  const lashLine = lid.map((p, k) => ({ x: p.x, y: p.y - (k === 0 || k === lid.length - 1 ? 0 : 1.5) }));
  return [...lashLine, ...top.reverse()];
}

export function regionMask(l: Landmarks, region: CosmeticRegion, w: number, h: number): Mask[] {
  const fw = faceWidthPx(l, w, h);
  switch (region) {
    case "lips": {
      const outer = LIPS_OUTER.map((i) => px(l, i, w, h));
      const inner = LIPS_INNER.map((i) => px(l, i, w, h));
      // Inner mouth (teeth/tongue) is a hole so it is never tinted.
      return [feather(rasterize([outer], [inner], w, h, 4), Math.max(1, fw * 0.004))];
    }
    case "eyelids":
      return [
        feather(rasterize([eyelidPolygon(l, EYE_L_UPPER, EYE_L_BROW, w, h)], [], w, h, fw * 0.03), Math.max(1, fw * 0.012)),
        feather(rasterize([eyelidPolygon(l, EYE_R_UPPER, EYE_R_BROW, w, h)], [], w, h, fw * 0.03), Math.max(1, fw * 0.012)),
      ];
    case "cheeks": {
      const a = px(l, CHEEK_L, w, h), b = px(l, CHEEK_R, w, h);
      const rx = fw * 0.13, ry = fw * 0.09;
      return [radialMask(a.x, a.y - ry * 0.15, rx, ry, w, h), radialMask(b.x, b.y - ry * 0.15, rx, ry, w, h)];
    }
  }
}
