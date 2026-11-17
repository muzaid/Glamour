import { listPublishedProducts, listMyLooks } from "@glamotion/core";
import { CATEGORY_REGION, type CosmeticRegion } from "@glamotion/contracts";
import { ctx } from "@/server/runtime";
import { TryOnStudio, type TryOnShade } from "@/components/TryOnStudio";

export const metadata = { title: "Beauty Mirror" };
export const dynamic = "force-dynamic";

export default async function TryOnPage({ searchParams }: { searchParams: Promise<{ variant?: string; look?: string }> }) {
  const sp = await searchParams;
  const c = await ctx();
  const shades: TryOnShade[] = [];
  for (const p of listPublishedProducts(c)) {
    const region = CATEGORY_REGION[p.category];
    if (!region) continue;
    for (const v of p.variants) shades.push({ variantId: v.id, region, productTitle: p.title, productSlug: p.slug, brandName: p.brandName, shadeName: v.shadeName, hex: v.shade.hex, finish: v.shade.finish, defaultOpacity: v.shade.defaultOpacity, priceMinor: v.price.amountMinor, currency: v.price.currency, available: v.available });
  }
  let initial: Partial<Record<CosmeticRegion, { variantId: string; opacity: number }>> = {};
  if (sp.variant) {
    const s = shades.find((x) => x.variantId === sp.variant);
    if (s) initial[s.region] = { variantId: s.variantId, opacity: s.defaultOpacity };
  }
  if (sp.look && c.actor) {
    const look = listMyLooks(c).find((l) => l.id === sp.look);
    if (look) initial = Object.fromEntries(look.recipe.selectedProducts.map((p) => [p.cosmeticRegion, { variantId: p.productVariantId, opacity: p.opacity }]));
  }
  return (
    <div className="gm-container gm-section">
      <div className="gm-eyebrow">Beauty Mirror</div>
      <h1>Try it on — privately, on your device</h1>
      <TryOnStudio shades={shades} initial={initial} signedIn={!!c.actor} modelUrl={process.env.NEXT_PUBLIC_FACE_MODEL_URL ?? "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"} />
    </div>
  );
}
