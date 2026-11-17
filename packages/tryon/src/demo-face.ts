import { LIPS_OUTER, LIPS_INNER, EYE_L_UPPER, EYE_L_BROW, EYE_R_UPPER, EYE_R_BROW, CHEEK_L, CHEEK_R, FACE_EDGE_L, FACE_EDGE_R, FOREHEAD, CHIN, type Point } from "./landmarks";

/**
 * Synthetic, illustrated demo face (authored in code — not a photograph of a
 * real person). Its drawing and its landmark fixture are generated from the
 * same parametric geometry, so the overlay can be demonstrated and tested
 * without any real biometric data. Real photos go through MediaPipe.
 */
export const DEMO_FACE = { width: 600, height: 760 } as const;

const sinp = (t: number, k = 1) => Math.sin(Math.PI * t) ** k;
const LIP = { x0: 240, x1: 360, y: 528 };
const lipUpper = (t: number) => LIP.y - 26 * sinp(t, 0.8) * (1 - 0.3 * Math.exp(-(((t - 0.5) / 0.08) ** 2)));
const lipLower = (t: number) => LIP.y + 30 * sinp(t, 0.9);
const INNER = { x0: 253, x1: 347, y: 526 };
const innerUpper = (t: number) => INNER.y - 3 * sinp(t);
const innerLower = (t: number) => INNER.y + 9 * sinp(t);

interface EyeSpec { outer: Point; inner: Point; browOuter: Point; browInner: Point }
const EYES: { L: EyeSpec; R: EyeSpec } = {
  L: { outer: { x: 186, y: 342 }, inner: { x: 262, y: 344 }, browOuter: { x: 176, y: 300 }, browInner: { x: 268, y: 294 } },
  R: { outer: { x: 414, y: 342 }, inner: { x: 338, y: 344 }, browOuter: { x: 424, y: 300 }, browInner: { x: 332, y: 294 } },
};
const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const eyeUpper = (e: EyeSpec, t: number) => { const p = lerp(e.outer, e.inner, t); return { x: p.x, y: p.y - 17 * sinp(t, 0.9) }; };
const eyeLower = (e: EyeSpec, t: number) => { const p = lerp(e.outer, e.inner, t); return { x: p.x, y: p.y + 9 * sinp(t) }; };
const brow = (e: EyeSpec, t: number) => { const p = lerp(e.browOuter, e.browInner, t); return { x: p.x, y: p.y - 12 * sinp(t, 0.7) }; };

function pixelLandmarks(): Record<number, Point> {
  const out: Record<number, Point> = {};
  // Outer: idx 0 = left corner, 1..9 lower lip L→R, 10 = right corner, 11..19 upper lip R→L.
  LIPS_OUTER.forEach((id, k) => {
    if (k === 0) out[id] = { x: LIP.x0, y: LIP.y };
    else if (k < 10) { const t = k / 10; out[id] = { x: LIP.x0 + (LIP.x1 - LIP.x0) * t, y: lipLower(t) }; }
    else if (k === 10) out[id] = { x: LIP.x1, y: LIP.y };
    else { const t = 1 - (k - 10) / 10; out[id] = { x: LIP.x0 + (LIP.x1 - LIP.x0) * t, y: lipUpper(t) }; }
  });
  LIPS_INNER.forEach((id, k) => {
    if (k === 0) out[id] = { x: INNER.x0, y: INNER.y };
    else if (k < 10) { const t = k / 10; out[id] = { x: INNER.x0 + (INNER.x1 - INNER.x0) * t, y: innerLower(t) }; }
    else if (k === 10) out[id] = { x: INNER.x1, y: INNER.y };
    else { const t = 1 - (k - 10) / 10; out[id] = { x: INNER.x0 + (INNER.x1 - INNER.x0) * t, y: innerUpper(t) }; }
  });
  EYE_L_UPPER.forEach((id, k) => { out[id] = eyeUpper(EYES.L, k / 8); });
  EYE_R_UPPER.forEach((id, k) => { out[id] = eyeUpper(EYES.R, k / 8); });
  EYE_L_BROW.forEach((id, k) => { out[id] = brow(EYES.L, k / 4); });
  EYE_R_BROW.forEach((id, k) => { out[id] = brow(EYES.R, k / 4); });
  out[CHEEK_L] = { x: 206, y: 452 };
  out[CHEEK_R] = { x: 394, y: 452 };
  out[FACE_EDGE_L] = { x: 116, y: 420 };
  out[FACE_EDGE_R] = { x: 484, y: 420 };
  out[FOREHEAD] = { x: 300, y: 150 };
  out[CHIN] = { x: 300, y: 664 };
  return out;
}

/** Normalised landmark fixture for the demo face (sparse: only indices the engine uses). */
export function demoFaceLandmarks(): Record<number, Point> {
  const px = pixelLandmarks();
  const out: Record<number, Point> = {};
  for (const [k, p] of Object.entries(px)) out[Number(k)] = { x: p.x / DEMO_FACE.width, y: p.y / DEMO_FACE.height };
  return out;
}

const path = (pts: Point[], close = true) => `M${pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L")}${close ? " Z" : ""}`;
const samples = (f: (t: number) => Point, n = 40) => Array.from({ length: n + 1 }, (_, i) => f(i / n));

export function demoFaceSvg(): string {
  const lipsOuter = [...samples((t) => ({ x: LIP.x0 + 120 * t, y: lipLower(t) })), ...samples((t) => ({ x: LIP.x0 + 120 * (1 - t), y: lipUpper(1 - t) }))];
  const mouth = [...samples((t) => ({ x: INNER.x0 + 94 * t, y: innerLower(t) })), ...samples((t) => ({ x: INNER.x0 + 94 * (1 - t), y: innerUpper(1 - t) }))];
  const eye = (e: EyeSpec) => {
    const shape = [...samples((t) => eyeUpper(e, t)), ...samples((t) => eyeLower(e, 1 - t))];
    const c = lerp(e.outer, e.inner, 0.5);
    return `<path d="${path(shape)}" fill="#F7F3EF"/>
      <clipPath id="clip-${e.outer.x}"><path d="${path(shape)}"/></clipPath>
      <g clip-path="url(#clip-${e.outer.x})"><circle cx="${c.x}" cy="${c.y - 3}" r="13" fill="#5B3A29"/><circle cx="${c.x}" cy="${c.y - 3}" r="6" fill="#1A1210"/><circle cx="${c.x + 4}" cy="${c.y - 7}" r="3" fill="#fff" opacity=".8"/></g>
      <path d="${path(samples((t) => eyeUpper(e, t)), false)}" fill="none" stroke="#2A1D1A" stroke-width="3.2" stroke-linecap="round"/>
      <path d="${path(samples((t) => brow(e, t)), false)}" fill="none" stroke="#4A2F24" stroke-width="7" stroke-linecap="round"/>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${DEMO_FACE.width}" height="${DEMO_FACE.height}" viewBox="0 0 ${DEMO_FACE.width} ${DEMO_FACE.height}">
  <defs>
    <radialGradient id="bg" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="#EDE4DD"/><stop offset="1" stop-color="#C9BDB6"/></radialGradient>
    <radialGradient id="skin" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#E2B596"/><stop offset=".75" stop-color="#C99372"/><stop offset="1" stop-color="#A9765A"/></radialGradient>
    <linearGradient id="lip" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B9786E"/><stop offset=".55" stop-color="#C98B80"/><stop offset="1" stop-color="#A86A61"/></linearGradient>
  </defs>
  <rect width="600" height="760" fill="url(#bg)"/>
  <path d="M90 420 Q80 120 300 95 Q520 120 510 420 L520 760 L80 760 Z" fill="#2B1C17"/>
  <rect x="235" y="600" width="130" height="170" fill="#B98265"/>
  <ellipse cx="300" cy="405" rx="185" ry="262" fill="url(#skin)"/>
  <ellipse cx="112" cy="430" rx="20" ry="42" fill="#BE8869"/><ellipse cx="488" cy="430" rx="20" ry="42" fill="#BE8869"/>
  <path d="M120 300 Q170 150 300 135 Q430 150 480 300 Q470 200 300 118 Q130 200 120 300 Z" fill="#2B1C17"/>
  ${eye(EYES.L)}${eye(EYES.R)}
  <path d="M300 360 Q292 420 282 448 Q300 462 318 448 Q308 420 300 360" fill="#B57E60" opacity=".55"/>
  <path d="${path(lipsOuter)}" fill="url(#lip)"/>
  <path d="${path(mouth)}" fill="#3A1E1C"/>
  <path d="M258 527 L342 527 L340 532 Q300 536 260 532 Z" fill="#F4F0EA"/>
  <ellipse cx="318" cy="550" rx="16" ry="4" fill="#fff" opacity=".22"/>
  <text x="300" y="748" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" fill="#5F5258">Illustrated demo face · synthetic · not a real person</text>
</svg>`;
}
