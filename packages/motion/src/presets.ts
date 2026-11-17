import type { AspectRatio, DesignLayer, Easing, Keyframe, MotionComposition, MotionElement, Scene, Track } from "@glamotion/contracts";
import { ASPECT_SIZES, SAFE_AREA } from "./aspect";
import { BUILTIN_ASSETS, GARMENT_ASSET } from "./assets";

export interface PresetInput {
  id: string;
  title: string;
  brandName: string;
  productTitle: string;
  tagline?: string;
  shades: { productVariantId: string; name: string; hex: string }[];
  aspectRatio: AspectRatio;
  fps?: 24 | 25 | 30 | 60;
  palette?: { background: string; ink: string; accent: string };
  category?: string;
}

export type PresetId =
  | "luxury-product-reveal" | "lipstick-swipe" | "shade-lineup" | "before-after"
  | "logo-reveal" | "kinetic-typography" | "seasonal-promotion" | "reel-9x16";

export const PRESETS: { id: PresetId; label: string; description: string }[] = [
  { id: "luxury-product-reveal", label: "Luxury product reveal", description: "Slow scale-in of the product with title and shade." },
  { id: "lipstick-swipe", label: "Lipstick swipe", description: "A shade swatch sweeps across the frame." },
  { id: "shade-lineup", label: "Animated shade lineup", description: "Every shade staggers in as a swatch." },
  { id: "before-after", label: "Before / after", description: "Wipe from bare to colour (illustrative)." },
  { id: "logo-reveal", label: "Logo reveal", description: "Monogram and wordmark settle into place." },
  { id: "kinetic-typography", label: "Kinetic typography", description: "Words land one after another." },
  { id: "seasonal-promotion", label: "Seasonal promotion", description: "Seasonal headline with sparkles." },
  { id: "reel-9x16", label: "9:16 Reel", description: "Three-scene reel: reveal, lineup, call to action." },
];

const kf = (frame: number, value: number, easing: Easing = "luxe"): Keyframe => ({ frame, value, easing });
const tr = (property: Track["property"], ...keyframes: Keyframe[]): Track => ({ property, keyframes });
let counter = 0;
const lid = (p: string) => `${p.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${(counter++).toString(36)}`;

function el(layer: DesignLayer, start: number, end: number, tracks: Track[] = []): MotionElement {
  return { layer, startFrame: start, endFrame: end, tracks };
}
const base = (name: string, x: number, y: number, w: number, h: number) => ({ id: lid(name), name, parentId: null, visible: true, locked: false, transform: { x, y, w, h, rotation: 0 }, opacity: 1 });
const text = (name: string, s: string, x: number, y: number, w: number, h: number, size: number, opts: Partial<{ font: "display" | "sans"; weight: number; color: string }> = {}): DesignLayer => ({
  ...base(name, x, y, w, h), type: "text", text: s, fontFamily: opts.font ?? "display", fontSize: size, fontWeight: opts.weight ?? 500, color: opts.color ?? "#FAF7F3", align: "center",
});
const fadeUp = (start: number, dist = 60): Track[] => [tr("opacity", kf(start, 0), kf(start + 18, 1)), tr("y", kf(start, dist), kf(start + 24, 0))];

function ctx(input: PresetInput) {
  const { width: W, height: H } = ASPECT_SIZES[input.aspectRatio];
  const safe = SAFE_AREA[input.aspectRatio];
  const fps = input.fps ?? 30;
  const pal = input.palette ?? { background: "#101016", ink: "#FAF7F3", accent: "#E6A7B0" };
  const hero = input.shades[0] ?? { productVariantId: "", name: "Signature", hex: "#B23A48" };
  const m = Math.min(W, H);
  const sx = W * safe.left, sw = W * (1 - safe.left - safe.right), sy = H * safe.top, sh = H * (1 - safe.top - safe.bottom);
  const productAsset = (input.category && GARMENT_ASSET[input.category as keyof typeof GARMENT_ASSET])
    ?? (input.category === "blush" || input.category === "eyeshadow" ? "asset:blush-compact" : "asset:lipstick-bullet");
  return { W, H, fps, pal, hero, m, sx, sw, sy, sh, productAsset };
}

function revealScene(input: PresetInput, dur: number): Scene {
  const c = ctx(input);
  const [vw, vh] = BUILTIN_ASSETS[c.productAsset]!.viewBox;
  const ph = Math.min(c.m * 0.72, c.m * 0.3 * (vh / vw)), pw = ph * (vw / vh);
  return {
    id: lid("reveal"), name: "Product reveal", durationInFrames: dur, background: c.pal.background,
    elements: [
      el({ ...base("Glow", c.W / 2 - c.m * 0.45, c.H * 0.42 - c.m * 0.45, c.m * 0.9, c.m * 0.9), type: "ellipse", fill: c.hero.hex, opacity: 0.18 }, 0, dur, [tr("scale", kf(0, 0.6), kf(40, 1)), tr("blur", kf(0, 60, "linear"), kf(dur, 40, "linear"))]),
      el({ ...base("Product", c.W / 2 - pw / 2, c.H * 0.42 - ph / 2, pw, ph), type: "image", assetId: c.productAsset, fit: "contain", tint: c.hero.hex }, 0, dur, [tr("scale", kf(0, 0.82), kf(45, 1)), tr("opacity", kf(0, 0), kf(20, 1)), tr("blur", kf(0, 10), kf(24, 0))]),
      el(text("Brand", input.brandName.toUpperCase(), c.sx, c.sy, c.sw, c.m * 0.06, c.m * 0.035, { font: "sans", weight: 600, color: "#BE8D70" }), 6, dur, fadeUp(0, 20)),
      el(text("Title", input.productTitle, c.sx, c.H * 0.72, c.sw, c.m * 0.12, c.m * 0.07), 18, dur, fadeUp(0)),
      el(text("Shade", c.hero.name, c.sx, c.H * 0.72 + c.m * 0.11, c.sw, c.m * 0.06, c.m * 0.038, { font: "sans", weight: 400, color: c.pal.accent }), 30, dur, fadeUp(0, 30)),
    ],
  };
}

function lineupScene(input: PresetInput, dur: number): Scene {
  const c = ctx(input);
  const shades = input.shades.slice(0, 6);
  const n = Math.max(1, shades.length);
  const cols = c.W > c.H ? n : Math.min(3, n);
  const rows = Math.ceil(n / cols);
  const cell = Math.min(c.sw / cols, (c.sh * 0.6) / rows);
  const gx = c.W / 2 - (cols * cell) / 2, gy = c.H * 0.5 - (rows * cell) / 2;
  return {
    id: lid("lineup"), name: "Shade lineup", durationInFrames: dur, background: c.pal.background,
    elements: [
      el(text("Heading", `${shades.length} shade${shades.length === 1 ? "" : "s"}`, c.sx, c.sy + c.m * 0.02, c.sw, c.m * 0.1, c.m * 0.06), 0, dur, fadeUp(0)),
      ...shades.map((s, i) => {
        const x = gx + (i % cols) * cell, y = gy + Math.floor(i / cols) * cell;
        return el({ ...base(`Swatch ${s.name}`, x + cell * 0.1, y + cell * 0.05, cell * 0.8, cell * 0.9), type: "swatch", productVariantId: s.productVariantId, hex: s.hex, label: s.name }, 8 + i * 6, dur, [
          tr("opacity", kf(8 + i * 6, 0), kf(20 + i * 6, 1)), tr("scale", kf(8 + i * 6, 0.6), kf(26 + i * 6, 1)),
        ].map((t) => ({ ...t, keyframes: t.keyframes.map((k) => ({ ...k, frame: k.frame - (8 + i * 6) })) })));
      }),
    ],
  };
}

function ctaScene(input: PresetInput, dur: number): Scene {
  const c = ctx(input);
  return {
    id: lid("cta"), name: "Call to action", durationInFrames: dur, background: "#191922",
    elements: [
      el({ ...base("Mark", c.W / 2 - c.m * 0.12, c.H * 0.36 - c.m * 0.12, c.m * 0.24, c.m * 0.24), type: "image", assetId: "asset:monogram", fit: "contain", tint: "#BE8D70" }, 0, dur, [tr("rotation", kf(0, -30), kf(30, 0)), tr("opacity", kf(0, 0), kf(15, 1))]),
      el(text("CTA", input.tagline ?? "Try it on — virtually", c.sx, c.H * 0.55, c.sw, c.m * 0.12, c.m * 0.06), 10, dur, fadeUp(0)),
      el(text("Disclaimer", "Virtual try-on is illustrative. Shade may vary.", c.sx, c.H * (1 - SAFE_AREA[input.aspectRatio].bottom) - c.m * 0.06, c.sw, c.m * 0.05, c.m * 0.024, { font: "sans", weight: 400, color: "#B9B2BC" }), 0, dur),
    ],
  };
}

export function buildPreset(preset: PresetId, input: PresetInput): MotionComposition {
  counter = 0; // deterministic ids per build
  const c = ctx(input);
  const { width, height } = ASPECT_SIZES[input.aspectRatio];
  const s = (sec: number) => Math.round(sec * c.fps);
  let scenes: Scene[];
  switch (preset) {
    case "luxury-product-reveal":
      scenes = [revealScene(input, s(4))];
      break;
    case "shade-lineup":
      scenes = [lineupScene(input, s(4))];
      break;
    case "lipstick-swipe": {
      const d = s(3);
      const bw = c.sw * 0.9, bh = c.m * 0.16;
      scenes = [{ id: lid("swipe"), name: "Swipe", durationInFrames: d, background: c.pal.background, elements: [
        el({ ...base("Stroke", c.W / 2 - bw / 2, c.H / 2 - bh / 2, bw, bh), type: "rect", fill: c.hero.hex, radius: bh / 2 }, 0, d, [tr("x", kf(0, -c.W, "linear"), kf(24, 0, "luxe")), tr("blur", kf(0, 18), kf(22, 0))]),
        el(text("Shade", c.hero.name, c.sx, c.H / 2 + bh, c.sw, c.m * 0.1, c.m * 0.06), 20, d, fadeUp(0)),
      ] }];
      break;
    }
    case "before-after": {
      const d = s(4);
      const w = c.sw, h = c.m * 0.5, y = c.H / 2 - h / 2;
      scenes = [{ id: lid("ba"), name: "Before / after", durationInFrames: d, background: c.pal.background, elements: [
        el({ ...base("Before", c.sx, y, w, h), type: "rect", fill: "#C9A08A", radius: 24 }, 0, d),
        el({ ...base("After", c.sx, y, w, h), type: "rect", fill: c.hero.hex, radius: 24 }, 0, d, [tr("x", kf(0, -w, "linear"), kf(20, -w, "linear"), kf(70, 0, "easeInOut"))]),
        el(text("Label", "Illustrative before / after", c.sx, y + h + c.m * 0.04, c.sw, c.m * 0.06, c.m * 0.03, { font: "sans", weight: 400, color: "#B9B2BC" }), 0, d),
      ] }];
      break;
    }
    case "logo-reveal": {
      const d = s(3);
      scenes = [{ id: lid("logo"), name: "Logo", durationInFrames: d, background: c.pal.background, elements: [
        el({ ...base("Monogram", c.W / 2 - c.m * 0.15, c.H / 2 - c.m * 0.25, c.m * 0.3, c.m * 0.3), type: "image", assetId: "asset:monogram", fit: "contain", tint: "#BE8D70" }, 0, d, [tr("scale", kf(0, 0.4), kf(30, 1)), tr("rotation", kf(0, -90), kf(36, 0)), tr("opacity", kf(0, 0), kf(12, 1))]),
        el(text("Wordmark", input.brandName.toUpperCase(), c.sx, c.H / 2 + c.m * 0.12, c.sw, c.m * 0.1, c.m * 0.06, { font: "sans", weight: 600 }), 24, d, fadeUp(0, 30)),
      ] }];
      break;
    }
    case "kinetic-typography": {
      const d = s(4);
      const words = (input.tagline ?? `${input.productTitle} in ${c.hero.name}`).split(/\s+/).slice(0, 8);
      const lh = c.m * 0.11;
      const y0 = c.H / 2 - (words.length * lh) / 2;
      scenes = [{ id: lid("kt"), name: "Kinetic type", durationInFrames: d, background: c.pal.background, elements: words.map((w, i) =>
        el(text(`Word ${i + 1}`, w, c.sx, y0 + i * lh, c.sw, lh, c.m * 0.09, { color: i % 2 ? c.pal.accent : c.pal.ink }), i * 6, d, [tr("scale", kf(0, 1.6), kf(12, 1)), tr("opacity", kf(0, 0), kf(8, 1))])) }];
      break;
    }
    case "seasonal-promotion": {
      const d = s(4);
      scenes = [{ id: lid("season"), name: "Seasonal", durationInFrames: d, background: "#1D1420", elements: [
        ...[0, 1, 2, 3].map((i) => el({ ...base(`Sparkle ${i + 1}`, c.sx + (c.sw * (i + 0.5)) / 4 - c.m * 0.04, c.sy + c.m * 0.05 + (i % 2) * c.m * 0.08, c.m * 0.08, c.m * 0.08), type: "image", assetId: "asset:sparkle", fit: "contain", tint: "#E9C9A6" }, i * 5, d, [tr("rotation", kf(0, 0, "linear"), kf(d, 90, "linear")), tr("opacity", kf(0, 0), kf(10, 1))])),
        el(text("Headline", input.tagline ?? "The Holiday Edit", c.sx, c.H * 0.4, c.sw, c.m * 0.14, c.m * 0.08), 6, d, fadeUp(0)),
        el(text("Product", `${input.productTitle} · ${c.hero.name}`, c.sx, c.H * 0.4 + c.m * 0.14, c.sw, c.m * 0.07, c.m * 0.04, { font: "sans", color: c.pal.accent }), 18, d, fadeUp(0, 30)),
      ] }];
      break;
    }
    case "reel-9x16":
      scenes = [revealScene(input, s(3)), lineupScene(input, s(3)), ctaScene(input, s(2.5))];
      break;
  }
  return {
    schemaVersion: 1, id: input.id, title: input.title, aspectRatio: input.aspectRatio, width, height, fps: c.fps, scenes, brandKitVersion: 0,
    provenance: { preset, productVariantIds: input.shades.map((x) => x.productVariantId).filter(Boolean), generatedBy: "template" },
  };
}
