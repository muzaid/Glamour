import "server-only";
import type { DropPost } from "@glamotion/contracts";

/**
 * "Arriving Tomorrow" mix-and-match drop post. Everything shown (title, the two
 * white garment cut-outs and both colourway sequences) comes from the drop
 * record; public/drop-post/drop.js builds the garments and handles motion.
 */
const e = (s: unknown) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const jsonForScript = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

export function renderDropPage(drop: DropPost | null): string {
  const title = drop?.title ?? "Arriving Tomorrow";
  const config = drop && { title: drop.title, top: drop.top, bottom: drop.bottom };
  const body = drop
    ? `<main id="card" aria-roledescription="post" aria-label="${e(drop.title)}">
<h1>${e(drop.title)}</h1>
<div id="top" class="row" role="button" tabindex="0" aria-label="Change top colour"></div>
<div id="bot" class="row" role="button" tabindex="0" aria-label="Change bottom colour"></div>
<button id="prev" aria-label="Previous colourway"><svg viewBox="0 0 24 34" aria-hidden="true"><path d="M17 3 4 17l13 14"/></svg></button>
<button id="next" aria-label="Next colourway"><svg viewBox="0 0 24 34" aria-hidden="true"><path d="M7 3l13 14L7 31"/></svg></button>
<p id="live" class="sr" aria-live="polite"></p>
</main>
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><filter id="shade" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="gamma" exponent="2.6"/><feFuncG type="gamma" exponent="2.6"/><feFuncB type="gamma" exponent="2.6"/></feComponentTransfer></filter></svg>
<script type="application/json" id="drop-data">${jsonForScript(config)}</script>
<script src="/drop-post/drop.js" defer></script>`
    : `<main id="card"><h1>${e(title)}</h1><p class="empty">Nothing dropping yet. Check back soon.</p></main><script src="/drop-post/drop.js" defer></script>`;
  const preload = drop ? [drop.top.imageUrl, drop.bottom.imageUrl].filter(Boolean).map((u) => `<link rel="preload" as="image" href="${e(u)}" crossorigin="anonymous">`).join("\n") : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(title.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()))}</title>
<link rel="preload" as="font" type="font/woff2" href="/drop-post/inter-tight-latin.woff2" crossorigin>
${preload}
<link rel="stylesheet" href="/drop-post/drop.css">
</head>
<body>
${body}
</body>
</html>
`;
}
