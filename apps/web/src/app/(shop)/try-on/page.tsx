import { listPublishedProducts, listMyLooks } from "@glamotion/core";
import { CATEGORY_REGION, isApparel, type CosmeticRegion } from "@glamotion/contracts";
import Link from "next/link";
import { ApparelStudio, type GarmentProduct } from "@/components/ApparelStudio";
import { ctx } from "@/server/runtime";
import { TryOnStudio, type TryOnShade } from "@/components/TryOnStudio";

export const metadata = { title: "Beauty Mirror" };
export const dynamic = "force-dynamic";

export default async function TryOnPage({ searchParams }: { searchParams: Promise<{ variant?: string; look?: string; mode?: string }> }) {
  const sp = await searchParams;
  const c = await ctx();
  const all = listPublishedProducts(c);
  const lookGarments = sp.look && c.actor ? listMyLooks(c).find((l) => l.id === sp.look)?.recipe.garments ?? [] : [];
  const clothes = sp.mode === "clothes" || all.some((p) => isApparel(p.category) && p.variants.some((v) => v.id === sp.variant)) || lookGarments.length > 0;
  const tabs = (
    <nav className="gm-row" aria-label="Mirror mode" style={{ marginBottom: 16 }}>
      <Link className={`gm-btn gm-btn-sm ${clothes ? "gm-btn-ghost" : ""}`} href="/try-on" aria-current={clothes ? undefined : "page"} data-testid="mode-makeup">Makeup</Link>
      <Link className={`gm-btn gm-btn-sm ${clothes ? "" : "gm-btn-ghost"}`} href="/try-on?mode=clothes" aria-current={clothes ? "page" : undefined} data-testid="mode-clothes">Clothes</Link>
    </nav>
  );
  if (clothes) {
    const garments: GarmentProduct[] = all.filter((p) => isApparel(p.category)).map((p) => ({
      productId: p.id, slug: p.slug, title: p.title, brandName: p.brandName, category: p.category as GarmentProduct["category"],
      variants: p.variants.map((v) => ({ variantId: v.id, colour: v.shadeName, hex: v.shade.hex, size: v.sizeLabel ?? "One size", priceMinor: v.price.amountMinor, currency: v.price.currency, available: v.available })),
    }));
    return (
      <div className="gm-container gm-section">
        <div className="gm-eyebrow">Mirror</div>
        <h1>See it on you — privately, on your device</h1>
        {tabs}
        <ApparelStudio products={garments} initialVariantId={sp.variant ?? lookGarments[0]?.productVariantId} signedIn={!!c.actor}
          poseModelUrl={process.env.NEXT_PUBLIC_POSE_MODEL_URL ?? "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"} />
      </div>
    );
  }
  const shades: TryOnShade[] = [];
  for (const p of all) {
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
      <div className="gm-eyebrow">Mirror</div>
      <h1>Try it on — privately, on your device</h1>
      {tabs}
      <TryOnStudio shades={shades} initial={initial} signedIn={!!c.actor} modelUrl={process.env.NEXT_PUBLIC_FACE_MODEL_URL ?? "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"} />
    </div>
  );
}
