/**
 * Built-in, rights-cleared vector assets (authored in this repo). The render
 * pipeline only resolves `asset:` ids from this allowlist or from signed
 * internal media — never arbitrary URLs (SSRF guard, spec §11).
 */
export interface BuiltinAsset { id: string; label: string; license: "glamotion-original"; viewBox: [number, number]; svg: (tint: string) => string }

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
  "asset:sparkle": {
    id: "asset:sparkle", label: "Sparkle", license: "glamotion-original", viewBox: [100, 100],
    svg: (tint) => `<path d="M50 0 C54 38 62 46 100 50 C62 54 54 62 50 100 C46 62 38 54 0 50 C38 46 46 38 50 0Z" fill="${tint}"/>`,
  },
};
