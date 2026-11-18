import { CreateProductInput, CreateVariantInput, isWearable, REFERENCE_ASSET_BASE, higgsImageUrl, type ImageRef, type Product, type ProductStatus } from "@glamotion/contracts";
import type { Ctx } from "./context";
import { requireOrgCap } from "./context";
import { AppError, notFound } from "./errors";
import { newId, nowIso, sha256 } from "./ids";
import { assertTransition, productMachine } from "./state";
import { audit, emit } from "./audit";
import type { ProductRow, VariantRow } from "./store";

export function availableUnits(ctx: Ctx, variantId: string): number {
  const inv = ctx.store.inventories.get(variantId);
  return inv ? Math.max(0, inv.onHand - inv.reserved) : 0;
}

/** Public URL for a catalog image. Media keys go through the gated catalog-media route. */
export function imageUrl(ref: ImageRef | null, size: "default" | "large" = "default"): string | null {
  if (!ref) return null;
  if (ref.kind === "reference") return REFERENCE_ASSET_BASE + (size === "large" && ref.large ? ref.large : ref.file);
  if (ref.kind === "higgs") return higgsImageUrl(ref.path);
  return `/api/v1/catalog-media/${ref.key}`;
}

export function toProductDto(ctx: Ctx, p: ProductRow, opts: { onlyActive: boolean }): Product {
  const brand = ctx.store.brands.get(p.brandId);
  const variants = [...ctx.store.variants.values()]
    .filter((v) => v.productId === p.id && (!opts.onlyActive || v.active))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.sku.localeCompare(b.sku))
    .map((v) => ({
      id: v.id,
      productId: v.productId,
      sku: v.sku,
      shadeName: v.shadeName,
      shade: { hex: v.hex, finish: v.finish, defaultOpacity: v.defaultOpacity },
      sizeLabel: v.sizeLabel ?? undefined,
      price: { amountMinor: v.priceMinor, currency: v.currency },
      available: availableUnits(ctx, v.id),
    }));
  return {
    id: p.id, organizationId: p.organizationId, brandId: p.brandId, brandName: brand?.name ?? "", slug: p.slug, title: p.title,
    category: p.category, description: p.description, instructions: p.instructions, ingredients: p.ingredients, warnings: p.warnings,
    status: p.status, imageAlt: p.imageAlt, imageUrl: imageUrl(p.image), variants,
  };
}

const isPubliclyVisible = (ctx: Ctx, p: ProductRow) =>
  p.status === "published" && ctx.store.organizations.get(p.organizationId)?.status === "active";

/** Public catalog: only published products in active organizations. */
export function listPublishedProducts(ctx: Ctx, filter: { category?: string; q?: string; brand?: string } = {}): Product[] {
  const q = filter.q?.toLowerCase().trim();
  return [...ctx.store.products.values()]
    .filter((p) => isPubliclyVisible(ctx, p))
    .filter((p) => !filter.category || p.category === filter.category || (filter.category === "apparel" && isWearable(p.category)) || (filter.category === "beauty" && !isWearable(p.category)))
    .filter((p) => !filter.brand || ctx.store.brands.get(p.brandId)?.slug === filter.brand)
    .filter((p) => !q || p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .map((p) => toProductDto(ctx, p, { onlyActive: true }));
}

export function getPublishedProduct(ctx: Ctx, slugOrId: string): Product {
  const p = [...ctx.store.products.values()].find((x) => x.slug === slugOrId || x.id === slugOrId);
  if (!p || !isPubliclyVisible(ctx, p)) throw notFound("Product");
  return toProductDto(ctx, p, { onlyActive: true });
}

export function listOrgProducts(ctx: Ctx, organizationId: string): Product[] {
  requireOrgCap(ctx, organizationId, "org.read");
  return [...ctx.store.products.values()]
    .filter((p) => p.organizationId === organizationId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((p) => toProductDto(ctx, p, { onlyActive: false }));
}

function orgProduct(ctx: Ctx, organizationId: string, productId: string): ProductRow {
  const p = ctx.store.products.get(productId);
  if (!p || p.organizationId !== organizationId) throw notFound("Product");
  return p;
}

export function getOrgProduct(ctx: Ctx, organizationId: string, productId: string): Product {
  requireOrgCap(ctx, organizationId, "org.read");
  return toProductDto(ctx, orgProduct(ctx, organizationId, productId), { onlyActive: false });
}

export function createProduct(ctx: Ctx, organizationId: string, raw: unknown): Product {
  requireOrgCap(ctx, organizationId, "catalog.write");
  const input = CreateProductInput.parse(raw);
  const brand = ctx.store.brands.get(input.brandId);
  if (!brand || brand.organizationId !== organizationId) throw notFound("Brand");
  if ([...ctx.store.products.values()].some((p) => p.slug === input.slug)) throw new AppError("CONFLICT", "Slug already in use");
  const now = nowIso();
  const row: ProductRow = {
    id: newId(), organizationId, brandId: brand.id, slug: input.slug, title: input.title, category: input.category,
    description: input.description, instructions: input.instructions, ingredients: input.ingredients, warnings: input.warnings,
    status: "draft", imageAlt: `${input.title} by ${brand.name}`, image: null, createdAt: now, updatedAt: now, publishedAt: null,
  };
  ctx.store.products.set(row.id, row);
  audit(ctx, "product.created", "product", row.id, organizationId);
  return toProductDto(ctx, row, { onlyActive: false });
}

export function addVariant(ctx: Ctx, organizationId: string, productId: string, raw: unknown) {
  requireOrgCap(ctx, organizationId, "catalog.write");
  const p = orgProduct(ctx, organizationId, productId);
  const input = CreateVariantInput.parse(raw);
  // Unique (organization_id, sku)
  if ([...ctx.store.variants.values()].some((v) => v.organizationId === organizationId && v.sku === input.sku)) {
    throw new AppError("CONFLICT", "SKU already exists in this organization");
  }
  const existing = [...ctx.store.variants.values()].find((v) => v.productId === p.id);
  if (existing && existing.currency !== input.currency) throw new AppError("CURRENCY_MISMATCH", "All variants of a product share one currency");
  const now = nowIso();
  const v: VariantRow = {
    id: newId(), organizationId, productId: p.id, sku: input.sku, shadeName: input.shadeName, hex: input.hex.toUpperCase(),
    finish: input.finish, defaultOpacity: input.finish === "gloss" ? 0.45 : 0.6, sizeLabel: isWearable(p.category) ? input.sizeLabel ?? null : null, priceMinor: input.priceMinor,
    currency: input.currency, active: true, createdAt: now, updatedAt: now,
  };
  ctx.store.variants.set(v.id, v);
  ctx.store.inventories.set(v.id, { variantId: v.id, organizationId, onHand: input.initialStock, reserved: 0 });
  ctx.store.inventoryMovements.push({ id: newId(), variantId: v.id, organizationId, delta: input.initialStock, reason: "initial", refId: null, createdAt: now });
  audit(ctx, "variant.created", "product_variant", v.id, organizationId, { priceMinor: v.priceMinor });
  return v;
}

export function updateVariantPrice(ctx: Ctx, organizationId: string, variantId: string, priceMinor: number) {
  requireOrgCap(ctx, organizationId, "catalog.write");
  const v = ctx.store.variants.get(variantId);
  if (!v || v.organizationId !== organizationId) throw notFound("Variant");
  if (!Number.isSafeInteger(priceMinor) || priceMinor <= 0) throw new AppError("VALIDATION_FAILED", "Invalid price");
  const old = v.priceMinor;
  v.priceMinor = priceMinor;
  v.updatedAt = nowIso();
  audit(ctx, "variant.price_changed", "product_variant", v.id, organizationId, { from: old, to: priceMinor });
}

export function adjustStock(ctx: Ctx, organizationId: string, variantId: string, delta: number, reason: string) {
  requireOrgCap(ctx, organizationId, "catalog.write");
  const inv = ctx.store.inventories.get(variantId);
  if (!inv || inv.organizationId !== organizationId) throw notFound("Variant");
  if (!Number.isSafeInteger(delta)) throw new AppError("VALIDATION_FAILED", "Invalid delta");
  if (inv.onHand + delta < inv.reserved) throw new AppError("CONFLICT", "Stock cannot go below reserved units");
  inv.onHand += delta;
  ctx.store.inventoryMovements.push({ id: newId(), variantId, organizationId, delta, reason, refId: null, createdAt: nowIso() });
}

export function transitionProduct(ctx: Ctx, organizationId: string, productId: string, to: ProductStatus): Product {
  requireOrgCap(ctx, organizationId, to === "published" ? "catalog.publish" : "catalog.write");
  const p = orgProduct(ctx, organizationId, productId);
  assertTransition(productMachine, p.status, to, "product");
  if (to === "published") {
    const vs = [...ctx.store.variants.values()].filter((v) => v.productId === p.id && v.active);
    if (vs.length === 0) throw new AppError("VALIDATION_FAILED", "Add at least one active variant before publishing");
    if (!p.description.trim()) throw new AppError("VALIDATION_FAILED", "Description is required before publishing");
  }
  const from = p.status;
  p.status = to;
  p.updatedAt = nowIso();
  if (to === "published") {
    p.publishedAt = p.updatedAt;
    emit(ctx, "product.published.v1", organizationId, { productId: p.id });
  }
  audit(ctx, "product.status_changed", "product", p.id, organizationId, { from, to });
  return toProductDto(ctx, p, { onlyActive: false });
}

/** Attach (or clear) a product packshot. Bytes are stored by the caller via ctx.media under `key`. */
export async function setProductImage(ctx: Ctx, organizationId: string, productId: string, upload: { bytes: Uint8Array } | null): Promise<Product> {
  requireOrgCap(ctx, organizationId, "catalog.write");
  const p = orgProduct(ctx, organizationId, productId);
  const old = p.image;
  p.image = upload ? await storeCatalogImage(ctx, organizationId, upload.bytes) : null;
  p.updatedAt = nowIso();
  if (old?.kind === "media") await dropCatalogImage(ctx, old.key);
  audit(ctx, upload ? "product.image_set" : "product.image_cleared", "product", p.id, organizationId);
  return toProductDto(ctx, p, { onlyActive: false });
}

/** Sniff the real type from magic bytes (never trust the client's MIME). */
export function sniffImage(bytes: Uint8Array): { ext: "png" | "jpg" | "webp"; mime: "image/png" | "image/jpeg" | "image/webp" } | null {
  const b = bytes;
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", mime: "image/png" };
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}

export async function storeCatalogImage(ctx: Ctx, organizationId: string, bytes: Uint8Array): Promise<ImageRef> {
  if (!ctx.media) throw new AppError("FEATURE_DISABLED", "Media storage is not configured");
  if (bytes.length === 0 || bytes.length > 4 * 1024 * 1024) throw new AppError("VALIDATION_FAILED", "Images must be smaller than 4 MB");
  const kind = sniffImage(bytes);
  if (!kind) throw new AppError("VALIDATION_FAILED", "Upload a PNG, JPEG or WebP image");
  const key = `catalog/${newId()}.${kind.ext}`;
  await ctx.media.put(key, bytes, kind.mime);
  ctx.store.media.set(key, { key, organizationId, ownerUserId: ctx.actor?.userId ?? null, mime: kind.mime, bytes: bytes.length, checksum: sha256(bytes), privacyClass: "product_public", createdAt: nowIso() });
  return { kind: "media", key };
}

export async function dropCatalogImage(ctx: Ctx, key: string) {
  ctx.store.media.delete(key);
  await ctx.media?.delete(key).catch(() => undefined);
}

/**
 * Who may read a catalog image: anyone when a published product or published
 * runway look in an active organization uses it; otherwise only members of
 * the owning organization (studio previews). Everything else is NOT_FOUND.
 */
export function canReadCatalogMedia(ctx: Ctx, key: string): boolean {
  const meta = ctx.store.media.get(key);
  if (!meta || meta.privacyClass !== "product_public" || !meta.organizationId) return false;
  const uses = (ref: ImageRef | null) => ref?.kind === "media" && ref.key === key;
  const activeOrg = ctx.store.organizations.get(meta.organizationId)?.status === "active";
  if (activeOrg && [...ctx.store.products.values()].some((p) => p.status === "published" && uses(p.image))) return true;
  if (activeOrg && [...ctx.store.runwayLooks.values()].some((l) => l.status === "published" && uses(l.image))) return true;
  if (activeOrg && [...ctx.store.dropPosts.values()].some((d) => d.status === "published" && (uses(d.top.image) || uses(d.bottom.image)))) return true;
  try { requireOrgCap(ctx, meta.organizationId, "org.read"); return true; } catch { return false; }
}
