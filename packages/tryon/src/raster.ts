import type { Point } from "./landmarks";

export interface Mask { x0: number; y0: number; w: number; h: number; data: Float32Array }

export function bbox(polys: Point[][], width: number, height: number, pad: number) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const poly of polys) for (const p of poly) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  x0 = Math.max(0, Math.floor(x0 - pad)); y0 = Math.max(0, Math.floor(y0 - pad));
  x1 = Math.min(width, Math.ceil(x1 + pad)); y1 = Math.min(height, Math.ceil(y1 + pad));
  return { x0, y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

/** Even-odd scanline fill with 4x vertical supersampling for smooth edges. */
export function rasterize(polys: Point[][], holes: Point[][], width: number, height: number, pad: number): Mask {
  const b = bbox(polys, width, height, pad);
  const data = new Float32Array(b.w * b.h);
  const SS = 4;
  const fill = (poly: Point[], sign: number) => {
    for (let row = 0; row < b.h; row++) {
      for (let s = 0; s < SS; s++) {
        const y = b.y0 + row + (s + 0.5) / SS;
        const xs: number[] = [];
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const a = poly[i]!, c = poly[j]!;
          if ((a.y > y) !== (c.y > y)) xs.push(a.x + ((y - a.y) / (c.y - a.y)) * (c.x - a.x));
        }
        xs.sort((p, q) => p - q);
        for (let k = 0; k + 1 < xs.length; k += 2) {
          const xa = xs[k]! - b.x0, xb = xs[k + 1]! - b.x0;
          const ia = Math.max(0, Math.floor(xa)), ib = Math.min(b.w - 1, Math.floor(xb));
          for (let x = ia; x <= ib; x++) {
            const cover = Math.min(x + 1, xb) - Math.max(x, xa);
            if (cover > 0) data[row * b.w + x]! += (sign * cover) / SS;
          }
        }
      }
    }
  };
  for (const p of polys) fill(p, 1);
  for (const h of holes) fill(h, -1);
  for (let i = 0; i < data.length; i++) data[i] = Math.min(1, Math.max(0, data[i]!));
  return { ...b, data };
}

/** Separable box blur (2 passes ≈ gaussian) for edge feathering. */
export function feather(m: Mask, radius: number): Mask {
  const r = Math.max(0, Math.round(radius));
  if (r === 0 || m.w === 0) return m;
  let src = m.data;
  const tmp = new Float32Array(src.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < m.h; y++) {
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += src[y * m.w + Math.min(m.w - 1, Math.max(0, x))]!;
      for (let x = 0; x < m.w; x++) {
        tmp[y * m.w + x] = acc / (2 * r + 1);
        acc += src[y * m.w + Math.min(m.w - 1, x + r + 1)]! - src[y * m.w + Math.max(0, x - r)]!;
      }
    }
    const out = new Float32Array(src.length);
    for (let x = 0; x < m.w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[Math.min(m.h - 1, Math.max(0, y)) * m.w + x]!;
      for (let y = 0; y < m.h; y++) {
        out[y * m.w + x] = acc / (2 * r + 1);
        acc += tmp[Math.min(m.h - 1, y + r + 1) * m.w + x]! - tmp[Math.max(0, y - r) * m.w + x]!;
      }
    }
    src = out;
  }
  return { ...m, data: src };
}

/** Soft elliptical mask (smoothstep falloff) — used for blush. */
export function radialMask(cx: number, cy: number, rx: number, ry: number, width: number, height: number): Mask {
  const x0 = Math.max(0, Math.floor(cx - rx)), y0 = Math.max(0, Math.floor(cy - ry));
  const x1 = Math.min(width, Math.ceil(cx + rx)), y1 = Math.min(height, Math.ceil(cy + ry));
  const w = Math.max(0, x1 - x0), h = Math.max(0, y1 - y0);
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x0 + x + 0.5 - cx) / rx, dy = (y0 + y + 0.5 - cy) / ry;
    const d = Math.sqrt(dx * dx + dy * dy);
    const t = Math.min(1, Math.max(0, (1 - d) / 0.75));
    data[y * w + x] = t * t * (3 - 2 * t);
  }
  return { x0, y0, w, h, data };
}
