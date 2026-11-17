import type { CosmeticRegion, Finish } from "@glamotion/contracts";
import { applyLighting, hexToRgb, luminance, shiftHue, type RGB } from "./color";
import { regionMask } from "./regions";
import type { Landmarks } from "./landmarks";
import type { Mask } from "./raster";

export const ENGINE_VERSION = "glamotion-overlay@1";

export interface PixelBuffer { width: number; height: number; data: Uint8ClampedArray }
export interface MakeupLayer { region: CosmeticRegion; hex: string; finish: Finish; opacity: number; hueShift?: number; gloss?: number }
export interface CompositeOptions { lighting?: "neutral" | "warm" | "cool" }

const FINISH_GLOSS: Record<Finish, number> = { matte: 0, satin: 0.25, natural: 0.15, gloss: 0.75, shimmer: 0.5, metallic: 0.6 };
const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
const softLight = (b: number, s: number) => (1 - 2 * s) * b * b + 2 * s * b; // pegtop, normalised

function blend(src: PixelBuffer, out: Uint8ClampedArray, mask: Mask, layer: MakeupLayer, shade: RGB) {
  const gloss = layer.gloss ?? FINISH_GLOSS[layer.finish];
  const opacity = Math.min(1, Math.max(0, layer.opacity));
  const W = src.width;
  for (let y = 0; y < mask.h; y++) {
    for (let x = 0; x < mask.w; x++) {
      const m = mask.data[y * mask.w + x]!;
      if (m <= 0.002) continue;
      const i = ((mask.y0 + y) * W + (mask.x0 + x)) * 4;
      const r = out[i]!, g = out[i + 1]!, b = out[i + 2]!;
      const L = luminance(src.data[i]!, src.data[i + 1]!, src.data[i + 2]!) / 255;
      let cr: number, cg: number, cb: number;
      if (layer.region === "lips") {
        // Keep the lip's own shading (texture) while replacing chroma.
        const k = 0.5 + 0.85 * L;
        cr = shade[0] * k; cg = shade[1] * k; cb = shade[2] * k;
        const spec = gloss * Math.max(0, (L - 0.55) / 0.45) * 160;
        cr += spec; cg += spec; cb += spec;
      } else {
        cr = softLight(r / 255, shade[0] / 255) * 255;
        cg = softLight(g / 255, shade[1] / 255) * 255;
        cb = softLight(b / 255, shade[2] / 255) * 255;
        // Mix toward multiply for pigment intensity.
        cr = cr * 0.6 + (r * shade[0]) / 255 * 0.4; cg = cg * 0.6 + (g * shade[1]) / 255 * 0.4; cb = cb * 0.6 + (b * shade[2]) / 255 * 0.4;
        if (gloss > 0.3) { const s = gloss * Math.max(0, L - 0.6) * 120; cr += s; cg += s; cb += s; }
      }
      const a = m * opacity;
      out[i] = clamp(r + (cr - r) * a);
      out[i + 1] = clamp(g + (cg - g) * a);
      out[i + 2] = clamp(b + (cb - b) * a);
    }
  }
}

/**
 * Deterministic, on-device makeup overlay. Pure function of (pixels,
 * landmarks, layers, options) → pixels; no I/O, no randomness, so a saved
 * recipe re-renders identically with the same engine version.
 */
export function applyMakeup(src: PixelBuffer, landmarks: Landmarks, layers: MakeupLayer[], opts: CompositeOptions = {}): PixelBuffer {
  const out = new Uint8ClampedArray(src.data);
  // Fixed paint order: cheeks → eyelids → lips.
  const order: Record<CosmeticRegion, number> = { cheeks: 0, eyelids: 1, lips: 2 };
  for (const layer of [...layers].sort((a, b) => order[a.region] - order[b.region])) {
    const shade = applyLighting(shiftHue(hexToRgb(layer.hex), layer.hueShift ?? 0), opts.lighting ?? "neutral");
    for (const mask of regionMask(landmarks, layer.region, src.width, src.height)) blend(src, out, mask, layer, shade);
  }
  return { width: src.width, height: src.height, data: out };
}
