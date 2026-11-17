import { POSE, type PosePoint } from "./apparel";

/**
 * Synthetic illustrated upper-body figure (not a photograph of a real person)
 * with a matching pose-landmark fixture, used to demonstrate and test the
 * clothes mirror without any real person's image.
 */
export const DEMO_BODY = { width: 600, height: 900 } as const;
const S = { right: { x: 188, y: 318 }, left: { x: 412, y: 318 } }; // subject's right shoulder is image-left
const H = { right: { x: 232, y: 712 }, left: { x: 368, y: 712 } };

export function demoBodyPose(): Record<number, PosePoint> {
  const n = (p: { x: number; y: number }, v = 0.99): PosePoint => ({ x: p.x / DEMO_BODY.width, y: p.y / DEMO_BODY.height, visibility: v });
  return {
    [POSE.NOSE]: n({ x: 300, y: 196 }),
    [POSE.R_SHOULDER]: n(S.right), [POSE.L_SHOULDER]: n(S.left),
    [POSE.R_HIP]: n(H.right), [POSE.L_HIP]: n(H.left),
    13: n({ x: 168, y: 520 }), 14: n({ x: 432, y: 520 }),
  };
}

/** Viewer-chosen illustration tones (a display preference — never inferred from a photo). */
export const SKIN_TONES = {
  porcelain: ["#F3D6C4", "#D9A98F"],
  honey: ["#E0B293", "#B98163"],
  amber: ["#B9825D", "#8A5536"],
  ebony: ["#7A4E36", "#4E2E1E"],
} as const;
export type SkinTone = keyof typeof SKIN_TONES;

export function demoBodySvg(opts: { skin?: SkinTone; background?: boolean } = {}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${DEMO_BODY.width}" height="${DEMO_BODY.height}" viewBox="0 0 600 900">${demoBodyInner(opts)}
<text x="300" y="886" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" fill="#E8E2EA">Illustrated demo figure · synthetic · not a real person</text>
</svg>`;
}

/** Figure markup without the outer <svg>, so outfits can be composed on top. */
export function demoBodyInner(opts: { skin?: SkinTone; background?: boolean } = {}): string {
  const [hi, lo] = SKIN_TONES[opts.skin ?? "honey"];
  return `
  <defs>
    <linearGradient id="db-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EFE7E1"/><stop offset="1" stop-color="#D2C6BF"/></linearGradient>
    <radialGradient id="skin" cx=".45" cy=".35" r=".8"><stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${lo}"/></radialGradient>
    <linearGradient id="arm" x1="0" x2="1"><stop offset="0" stop-color="${lo}"/><stop offset=".5" stop-color="${hi}"/><stop offset="1" stop-color="${lo}"/></linearGradient>
  </defs>
  ${opts.background === false ? "" : '<rect width="600" height="900" fill="url(#db-bg)"/>'}
  <path d="M190 330 Q150 340 146 420 L138 760 Q150 780 176 768 L196 470 Z" fill="url(#arm)"/>
  <path d="M410 330 Q450 340 454 420 L462 760 Q450 780 424 768 L404 470 Z" fill="url(#arm)"/>
  <path d="M188 318 Q300 290 412 318 L398 560 L372 900 L228 900 L202 560 Z" fill="url(#skin)"/>
  <path d="M206 330 Q300 300 394 330 L384 600 L372 720 L228 720 L216 600 Z" fill="#9A9A9F"/>
  <path d="M226 712 L374 712 L392 900 L208 900 Z" fill="#2E3A52"/>
  <rect x="268" y="240" width="64" height="80" rx="24" fill="url(#skin)"/>
  <path d="M206 160 Q300 40 394 160 L400 260 Q300 150 200 260 Z" fill="#2B1C17"/>
  <ellipse cx="300" cy="190" rx="78" ry="96" fill="url(#skin)"/>
  <path d="M218 200 Q206 92 300 86 Q394 92 382 200 Q372 140 330 128 Q300 150 262 126 Q226 140 218 200 Z" fill="#2B1C17"/>
  <ellipse cx="270" cy="190" rx="9" ry="6" fill="#2A1D1A"/><ellipse cx="330" cy="190" rx="9" ry="6" fill="#2A1D1A"/>
  <path d="M282 240 Q300 252 318 240" fill="none" stroke="#9B5A50" stroke-width="5" stroke-linecap="round"/>`;
}
