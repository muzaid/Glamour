import {
  CreateRunwayLookInput, UpdateRunwayLookInput, compareSizes, type RunwayFeedLook, type RunwayLook,
} from "@glamotion/contracts";
import type { Ctx } from "./context";
import { requireOrgCap } from "./context";
import { AppError, notFound } from "./errors";
import { newId, nowIso } from "./ids";
import { audit } from "./audit";
import { availableUnits, dropCatalogImage, imageUrl, storeCatalogImage } from "./catalog";
import type { RunwayLookRow } from "./store";

/**
 * Runway looks (the "Try the Look" lookbook). Brands compose a look from a
 * model photo and pins onto their own catalog products; the public feed only
 * ever shows published looks and published products, priced by the server.
 */
const toDto = (l: RunwayLookRow): RunwayLook => ({
  id: l.id, organizationId: l.organizationId, name: l.name, description: l.description, position: l.position, status: l.status,
  imageUrl: imageUrl(l.image), pins: l.pins.map((p) => ({ ...p })), createdAt: l.createdAt, updatedAt: l.updatedAt,
});

function orgLook(ctx: Ctx, organizationId: string, id: string): RunwayLookRow {
  const l = ctx.store.runwayLooks.get(id);
  if (!l || l.organizationId !== organizationId) throw notFound("Look");
  return l;
}

const byOrder = (a: RunwayLookRow, b: RunwayLookRow) => a.position - b.position || a.createdAt.localeCompare(b.createdAt);

export function listOrgRunwayLooks(ctx: Ctx, organizationId: string): RunwayLook[] {
  requireOrgCap(ctx, organizationId, "org.read");
  return [...ctx.store.runwayLooks.values()].filter((l) => l.organizationId === organizationId).sort(byOrder).map(toDto);
}

export function getOrgRunwayLook(ctx: Ctx, organizationId: string, id: string): RunwayLook {
  requireOrgCap(ctx, organizationId, "org.read");
  return toDto(orgLook(ctx, organizationId, id));
}

export function createRunwayLook(ctx: Ctx, organizationId: string, raw: unknown): RunwayLook {
  const actor = requireOrgCap(ctx, organizationId, "catalog.write");
  const input = CreateRunwayLookInput.parse(raw);
  const mine = [...ctx.store.runwayLooks.values()].filter((l) => l.organizationId === organizationId);
  if (mine.length >= 24) throw new AppError("QUOTA_EXCEEDED", "A workspace can have up to 24 runway looks");
  const now = nowIso();
  const row: RunwayLookRow = {
    id: newId(), organizationId, name: input.name, description: input.description, status: "draft",
    position: mine.reduce((m, l) => Math.max(m, l.position + 1), 0), image: null, pins: [], createdBy: actor.userId, createdAt: now, updatedAt: now,
  };
  ctx.store.runwayLooks.set(row.id, row);
  audit(ctx, "runway_look.created", "runway_look", row.id, organizationId);
  return toDto(row);
}

function assertPublishable(ctx: Ctx, l: RunwayLookRow) {
  if (!l.image) throw new AppError("VALIDATION_FAILED", "Upload a model photo before publishing");
  if (!l.pins.some((p) => ctx.store.products.get(p.productId)?.status === "published")) {
    throw new AppError("VALIDATION_FAILED", "Pin at least one published product before publishing");
  }
}

export function updateRunwayLook(ctx: Ctx, organizationId: string, id: string, raw: unknown): RunwayLook {
  const input = UpdateRunwayLookInput.parse(raw);
  requireOrgCap(ctx, organizationId, input.status === "published" ? "catalog.publish" : "catalog.write");
  const l = orgLook(ctx, organizationId, id);
  if (input.pins) {
    const seen = new Set<string>();
    for (const pin of input.pins) {
      const p = ctx.store.products.get(pin.productId);
      // Only this organization's own products can be pinned (no cross-tenant references).
      if (!p || p.organizationId !== organizationId) throw notFound("Product");
      if (seen.has(pin.productId)) throw new AppError("VALIDATION_FAILED", "Each product can be pinned once per look");
      seen.add(pin.productId);
    }
    l.pins = input.pins.map((p) => ({ productId: p.productId, left: Math.round(p.left * 10) / 10, top: Math.round(p.top * 10) / 10, tag: p.tag || null }));
  }
  if (input.name !== undefined) l.name = input.name;
  if (input.description !== undefined) l.description = input.description;
  if (input.position !== undefined && input.position !== l.position) {
    // Move to the requested slot and renumber the workspace's looks 0..n-1.
    const others = [...ctx.store.runwayLooks.values()].filter((x) => x.organizationId === organizationId && x.id !== l.id).sort(byOrder);
    others.splice(Math.min(input.position, others.length), 0, l);
    others.forEach((x, i) => { x.position = i; });
  }
  if (input.status && input.status !== l.status) {
    if (input.status === "published") assertPublishable(ctx, l);
    audit(ctx, "runway_look.status_changed", "runway_look", l.id, organizationId, { from: l.status, to: input.status });
    l.status = input.status;
  } else if (l.status === "published") assertPublishable(ctx, l);
  l.updatedAt = nowIso();
  return toDto(l);
}

export async function setRunwayLookImage(ctx: Ctx, organizationId: string, id: string, bytes: Uint8Array): Promise<RunwayLook> {
  requireOrgCap(ctx, organizationId, "catalog.write");
  const l = orgLook(ctx, organizationId, id);
  const old = l.image;
  l.image = await storeCatalogImage(ctx, organizationId, bytes);
  l.updatedAt = nowIso();
  if (old?.kind === "media") await dropCatalogImage(ctx, old.key);
  audit(ctx, "runway_look.image_set", "runway_look", l.id, organizationId);
  return toDto(l);
}

export async function deleteRunwayLook(ctx: Ctx, organizationId: string, id: string) {
  requireOrgCap(ctx, organizationId, "catalog.write");
  const l = orgLook(ctx, organizationId, id);
  ctx.store.runwayLooks.delete(l.id);
  if (l.image?.kind === "media") await dropCatalogImage(ctx, l.image.key);
  audit(ctx, "runway_look.deleted", "runway_look", l.id, organizationId);
}

/** Public feed: published looks in active orgs; pins to unpublished products are dropped. */
export function runwayFeed(ctx: Ctx): RunwayFeedLook[] {
  const out: RunwayFeedLook[] = [];
  const looks = [...ctx.store.runwayLooks.values()]
    .filter((l) => l.status === "published" && l.image && ctx.store.organizations.get(l.organizationId)?.status === "active")
    .sort(byOrder);
  for (const l of looks) {
    const pieces: RunwayFeedLook["pieces"] = [];
    for (const pin of l.pins) {
      const p = ctx.store.products.get(pin.productId);
      if (!p || p.status !== "published" || p.organizationId !== l.organizationId) continue;
      const variants = [...ctx.store.variants.values()]
        .filter((v) => v.productId === p.id && v.active)
        .sort((a, b) => compareSizes(a.sizeLabel ?? "", b.sizeLabel ?? "") || a.shadeName.localeCompare(b.shadeName) || a.createdAt.localeCompare(b.createdAt));
      if (variants.length === 0) continue;
      const sized = variants.some((v) => v.sizeLabel);
      const multiColour = new Set(variants.map((v) => v.shadeName)).size > 1;
      const label = (v: (typeof variants)[number]) => sized ? (multiColour ? `${v.shadeName} · ${v.sizeLabel ?? "—"}` : v.sizeLabel ?? v.shadeName) : v.shadeName;
      pieces.push({
        n: pieces.length + 1, productId: p.id, slug: p.slug, title: p.title, brandName: ctx.store.brands.get(p.brandId)?.name ?? "",
        tag: pin.tag, left: pin.left, top: pin.top, imageUrl: imageUrl(p.image),
        optionName: !sized ? "Shade" : p.category === "footwear" ? "Shoe size" : "Size",
        price: { amountMinor: Math.min(...variants.map((v) => v.priceMinor)), currency: variants[0]!.currency },
        variants: variants.map((v) => ({ id: v.id, label: label(v), available: availableUnits(ctx, v.id) > 0, price: { amountMinor: v.priceMinor, currency: v.currency } })),
      });
    }
    if (pieces.length === 0) continue;
    out.push({ id: l.id, name: l.name, description: l.description, imageUrl: imageUrl(l.image)!, imageLargeUrl: l.image?.kind === "reference" && l.image.large ? imageUrl(l.image, "large") : null, pieces });
  }
  return out;
}
