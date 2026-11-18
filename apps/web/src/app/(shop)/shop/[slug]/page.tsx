import { notFound } from "next/navigation";
import { getPublishedProduct, isAppError, CATEGORY_REGION_SAFE } from "@/server/catalog-helpers";
import { isApparel, isWearable } from "@glamotion/contracts";
import { ctx } from "@/server/runtime";
import { ProductArt } from "@/components/ProductArt";
import { ShadePicker } from "@/components/ShadePicker";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await ctx();
  let product;
  try { product = getPublishedProduct(c, slug); } catch (e) { if (isAppError(e)) notFound(); throw e; }
  c.store.analytics.push({ id: crypto.randomUUID(), name: "product_view", userId: c.actor?.userId ?? null, organizationId: product.organizationId, props: { productId: product.id }, createdAt: new Date().toISOString() });
  return (
    <div className="gm-container gm-section gm-grid-2">
      <div className="gm-card gm-product-art" style={{ borderRadius: "var(--gm-radius)", minHeight: 360, aspectRatio: "auto" }}>
        <ProductArt category={product.category} hex={product.variants[0]?.shade.hex ?? "#E6A7B0"} size={320} label={product.imageAlt} imageUrl={product.imageUrl} />
      </div>
      <div className="gm-stack">
        <div>
          <div className="gm-eyebrow">{product.brandName}</div>
          <h1>{product.title}</h1>
          <p className="gm-muted">{product.description}</p>
        </div>
        <ShadePicker product={product} signedIn={!!c.actor} tryOnCapable={!!CATEGORY_REGION_SAFE[product.category] || isApparel(product.category)} />
        <details open><summary><strong>{isWearable(product.category) ? "Care" : "How to apply"}</strong></summary><p>{product.instructions}</p></details>
        <details><summary><strong>{isWearable(product.category) ? "Composition" : "Ingredients"}</strong></summary><p>{product.ingredients}</p></details>
        <details><summary><strong>Warnings</strong></summary><p>{product.warnings}</p></details>
        <details><summary><strong>Delivery & returns</strong></summary><p>Sandbox demo — no real orders ship. Shipping zones, tax and returns are configured per market before live checkout.</p></details>
      </div>
    </div>
  );
}
