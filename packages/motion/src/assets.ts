export const GARMENT_ASSET: Record<"top" | "outerwear" | "dress", string> = {
  top: "asset:garment-top", outerwear: "asset:garment-outerwear", dress: "asset:garment-dress",
};

/**
 * Built-in, rights-cleared vector assets (authored in this repo). The render
 * pipeline only resolves `asset:` ids from this allowlist or from signed
 * internal media — never arbitrary URLs (SSRF guard, spec §11).
 */
export interface GarmentAnchors {
  /** Image-left shoulder seam, image-right shoulder seam, mid-hip — in viewBox units. */
  left: [number, number];
  right: [number, number];
  hip: [number, number];
}
export interface BuiltinAsset {
  id: string; label: string; license: "glamotion-original"; viewBox: [number, number]; svg: (tint: string) => string;
  /** Present on garment templates used by the on-device clothes mirror. */
  anchors?: GarmentAnchors;
}

export const BUILTIN_ASSETS: Record<string, BuiltinAsset> = {
  "asset:lipstick-bullet": {
    id: "asset:lipstick-bullet", label: "Lipstick (illustration)", license: "glamotion-original", viewBox: [200, 480],
    svg: (tint) => `
      <defs><linearGradient id="gm-gold" x1="0" x2="1"><stop offset="0" stop-color="#8A6248"/><stop offset=".45" stop-color="#E9C9A6"/><stop offset="1" stop-color="#7A563F"/></linearGradient>
      <linearGradient id="gm-bullet" x1="0" x2="1"><stop offset="0" stop-color="${tint}" stop-opacity=".75"/><stop offset=".4" stop-color="${tint}"/><stop offset=".55" stop-color="#ffffff" stop-opacity=".35"/><stop offset=".7" stop-color="${tint}"/><stop offset="1" stop-color="${tint}" stop-opacity=".8"/></linearGradient></defs>
      <path d="M58 150 L58 70 Q58 40 100 18 Q142 40 142 50 L142 150 Z" fill="url(#gm-bullet)"/>
      <rect x="46" y="150" width="108" height="70" rx="6" fill="url(#gm-gold)"/>
      <rect x="36" y="220" width="128" height="250" rx="10" fill="#17141B"/>
      <rect x="36" y="220" width="128" height="10" fill="url(#gm-gold)"/>`,
  },
  "asset:blush-compact": {
    id: "asset:blush-compact", label: "Blush compact (illustration)", license: "glamotion-original", viewBox: [400, 400],
    svg: (tint) => `
      <circle cx="200" cy="200" r="190" fill="#17141B"/><circle cx="200" cy="200" r="178" fill="none" stroke="#BE8D70" stroke-width="6"/>
      <circle cx="200" cy="200" r="140" fill="${tint}"/><circle cx="160" cy="160" r="60" fill="#ffffff" opacity=".12"/>`,
  },
  "asset:monogram": {
    id: "asset:monogram", label: "GLAMOTION monogram", license: "glamotion-original", viewBox: [300, 300],
    svg: (tint) => `
      <circle cx="150" cy="150" r="140" fill="none" stroke="${tint}" stroke-width="6"/>
      <path d="M200 100 A70 70 0 1 0 220 160 L160 160" fill="none" stroke="${tint}" stroke-width="14" stroke-linecap="round"/>`,
  },
  "asset:garment-top": {
    id: "asset:garment-top", label: "Shell top (template)", license: "glamotion-original", viewBox: [400, 420],
    anchors: { left: [112, 42], right: [288, 42], hip: [200, 392] },
    svg: (tint) => `
      <defs><linearGradient id="gm-shade" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".25" stop-color="#000" stop-opacity="0"/><stop offset=".75" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient></defs>
      <path d="M150 22 Q200 70 250 22 L300 36 L362 96 L326 142 L298 122 L302 412 L98 412 L102 122 L74 142 L38 96 L100 36 Z" fill="${tint}"/>
      <path d="M150 22 Q200 70 250 22 L300 36 L362 96 L326 142 L298 122 L302 412 L98 412 L102 122 L74 142 L38 96 L100 36 Z" fill="url(#gm-shade)"/>
      <path d="M150 22 Q200 70 250 22" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="5"/>`,
  },
  "asset:garment-outerwear": {
    id: "asset:garment-outerwear", label: "Tailored blazer (template)", license: "glamotion-original", viewBox: [400, 470],
    anchors: { left: [106, 44], right: [294, 44], hip: [200, 400] },
    svg: (tint) => `
      <defs><linearGradient id="gm-shade" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".3"/><stop offset=".3" stop-color="#000" stop-opacity="0"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient></defs>
      <path d="M140 20 L200 160 L260 20 L304 38 L336 74 L358 440 L312 444 L302 190 L304 458 L96 458 L98 190 L88 444 L42 440 L64 74 L96 38 Z" fill="${tint}"/>
      <path d="M140 20 L200 160 L260 20 L304 38 L336 74 L358 440 L312 444 L302 190 L304 458 L96 458 L98 190 L88 444 L42 440 L64 74 L96 38 Z" fill="url(#gm-shade)"/>
      <path d="M140 20 L200 160 L176 172 L126 62 Z M260 20 L200 160 L224 172 L274 62 Z" fill="#000" fill-opacity=".22"/>
      <path d="M200 160 L200 458" stroke="#000" stroke-opacity=".25" stroke-width="3"/>
      <circle cx="210" cy="270" r="7" fill="#1a1a1a"/><circle cx="210" cy="320" r="7" fill="#1a1a1a"/>
      <path d="M120 300 L170 300" stroke="#000" stroke-opacity=".3" stroke-width="4"/><path d="M230 300 L280 300" stroke="#000" stroke-opacity=".3" stroke-width="4"/>`,
  },
  "asset:garment-dress": {
    id: "asset:garment-dress", label: "Slip dress (template)", license: "glamotion-original", viewBox: [400, 740],
    anchors: { left: [132, 40], right: [268, 40], hip: [200, 392] },
    svg: (tint) => `
      <defs><linearGradient id="gm-sheen" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".25"/><stop offset=".35" stop-color="#fff" stop-opacity=".18"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient></defs>
      <rect x="128" y="10" width="7" height="70" fill="${tint}"/><rect x="265" y="10" width="7" height="70" fill="${tint}"/>
      <path d="M118 74 Q200 120 282 74 L292 300 L350 730 L50 730 L108 300 Z" fill="${tint}"/>
      <path d="M118 74 Q200 120 282 74 L292 300 L350 730 L50 730 L108 300 Z" fill="url(#gm-sheen)"/>
      <path d="M108 300 Q200 318 292 300" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="4"/>`,
  },
  "asset:sparkle": {
    id: "asset:sparkle", label: "Sparkle", license: "glamotion-original", viewBox: [100, 100],
    svg: (tint) => `<path d="M50 0 C54 38 62 46 100 50 C62 54 54 62 50 100 C46 62 38 54 0 50 C38 46 46 38 50 0Z" fill="${tint}"/>`,
  },
};
