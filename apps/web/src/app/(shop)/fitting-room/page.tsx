import { listPublishedProducts } from "@glamotion/core";
import { isApparel } from "@glamotion/contracts";
import { ctx } from "@/server/runtime";
import { FittingRoom } from "@/components/FittingRoom";
import type { GarmentProduct } from "@/components/ApparelStudio";

export const metadata = { title: "Fitting room" };

export default async function FittingRoomPage() {
  const c = await ctx();
  const products: GarmentProduct[] = listPublishedProducts(c, { category: "apparel" }).filter((p) => isApparel(p.category)).map((p) => ({
    productId: p.id, slug: p.slug, title: p.title, brandName: p.brandName, category: p.category as GarmentProduct["category"],
    variants: p.variants.map((v) => ({ variantId: v.id, colour: v.shadeName, hex: v.shade.hex, size: v.sizeLabel ?? "One size", priceMinor: v.price.amountMinor, currency: v.price.currency, available: v.available })),
  }));
  return <FittingRoom products={products} signedIn={!!c.actor} />;
}
