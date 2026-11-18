import { listPublishedProducts } from "@glamotion/core";
import { isApparel } from "@glamotion/contracts";
import { ctx } from "@/server/runtime";
import { FittingRoom } from "@/components/FittingRoom";
import type { GarmentProduct } from "@/components/ApparelStudio";
import { ON_MODEL_PHOTOS } from "@/components/onModelPhotos";

/** The fitting room only offers pieces it has on-model photography for (ADR-011); lookbook pieces live on /runway. */
const PHOTOGRAPHED = new Set(ON_MODEL_PHOTOS.flatMap((p) => [p.base?.slug, p.outer?.slug]).filter((s): s is string => !!s));

export const metadata = { title: "Fitting room" };

export default async function FittingRoomPage() {
  const c = await ctx();
  const products: GarmentProduct[] = listPublishedProducts(c, { category: "apparel" }).filter((p) => isApparel(p.category) && PHOTOGRAPHED.has(p.slug)).map((p) => ({
    productId: p.id, slug: p.slug, title: p.title, brandName: p.brandName, category: p.category as GarmentProduct["category"],
    variants: p.variants.map((v) => ({ variantId: v.id, colour: v.shadeName, hex: v.shade.hex, size: v.sizeLabel ?? "One size", priceMinor: v.price.amountMinor, currency: v.price.currency, available: v.available })),
  }));
  return <FittingRoom products={products} signedIn={!!c.actor} />;
}
