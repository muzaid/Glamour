import "server-only";
import { MAISON_PIECES, MAISON_STORES, maisonSlug, type Ctx } from "@glamotion/core";

/**
 * "Maison Edit — Build Your Look". Piece names, stores and prices are read from
 * the live catalog (seeded as products), so the total and Shop the Look reflect
 * server prices; Shop the Look adds the real variants to the shopper's bag.
 */
const jsonForScript = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

export function maisonConfig(c: Ctx) {
  const pieces = MAISON_PIECES.map((p) => {
    const prod = [...c.store.products.values()].find((x) => x.slug === maisonSlug(p.key) && x.status === "published");
    const v = prod ? [...c.store.variants.values()].find((x) => x.productId === prod.id && x.active) : undefined;
    const brand = prod ? c.store.brands.get(prod.brandId) : undefined;
    const store = MAISON_STORES.find((s) => s.key === p.store)!;
    return {
      key: p.key, store: p.store, storeName: brand?.name ?? store.name, name: prod?.title ?? p.name,
      price: (v?.priceMinor ?? p.priceMinor) / 100, variantId: v?.id ?? null, c: p.c, r: p.r, tags: p.tags,
    };
  });
  return { pieces, stores: MAISON_STORES.map((s) => ({ key: s.key, name: s.name })), signedIn: !!c.actor };
}

export function renderMaisonPage(cfg: ReturnType<typeof maisonConfig>): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Maison Edit — Build Your Look</title>
<link rel="preload" as="font" type="font/woff2" href="/maison-edit/inter-latin.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="/maison-edit/bodoni-moda-latin.woff2" crossorigin>
<link rel="stylesheet" href="/maison-edit/maison.css">
</head>
<body>
<div id="app"></div>
<div id="toast" role="status" aria-live="polite"></div>
<script type="application/json" id="maison-data">${jsonForScript(cfg)}</script>
<script src="/maison-edit/masks.js" defer></script>
<script src="/maison-edit/maison.js" defer></script>
</body>
</html>
`;
}
