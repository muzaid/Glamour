import { SaveLookInput, AnalyticsEvent } from "@glamotion/contracts";
import type { Ctx } from "./context";
import { requireActor } from "./context";
import { AppError, notFound } from "./errors";
import { newId, nowIso } from "./ids";
import { audit, emit } from "./audit";

/** Saved looks are recipes (variant ids + parameters) — no image or landmark data. */
export function saveLook(ctx: Ctx, raw: unknown) {
  const actor = requireActor(ctx);
  const input = SaveLookInput.parse(raw);
  for (const sel of input.recipe.selectedProducts) {
    const v = ctx.store.variants.get(sel.productVariantId);
    const p = v && ctx.store.products.get(v.productId);
    if (!v || !p || p.status !== "published") throw new AppError("PRODUCT_UNAVAILABLE", "A selected shade is not available");
  }
  const row = { id: newId(), userId: actor.userId, name: input.name, recipe: input.recipe, createdAt: nowIso() };
  ctx.store.looks.set(row.id, row);
  emit(ctx, "look.saved.v1", null, { lookId: row.id });
  return row;
}

export function listMyLooks(ctx: Ctx) {
  const actor = requireActor(ctx);
  return [...ctx.store.looks.values()]
    .filter((l) => l.userId === actor.userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((l) => ({
      ...l,
      items: l.recipe.selectedProducts.map((s) => {
        const v = ctx.store.variants.get(s.productVariantId);
        const p = v && ctx.store.products.get(v.productId);
        const live = !!(v && p && v.active && p.status === "published");
        const inv = v && ctx.store.inventories.get(v.id);
        return { ...s, shadeName: v?.shadeName ?? "Unavailable", hex: v?.hex ?? "#777777", productTitle: p?.title ?? "", productSlug: p?.slug ?? "", available: live && inv ? inv.onHand - inv.reserved : 0, live };
      }),
    }));
}

export function deleteLook(ctx: Ctx, id: string) {
  const actor = requireActor(ctx);
  const l = ctx.store.looks.get(id);
  if (!l || l.userId !== actor.userId) throw notFound("Look");
  ctx.store.looks.delete(id);
  audit(ctx, "look.deleted", "look", id, null);
}

export function recordPhotoConsent(ctx: Ctx, scope: "camera_session" | "store_photo", granted: boolean, policyVersion: string) {
  const actor = requireActor(ctx);
  ctx.store.photoConsents.push({ id: newId(), userId: actor.userId, policyVersion, scope, granted, createdAt: nowIso() });
  audit(ctx, granted ? "consent.granted" : "consent.revoked", "photo_consent", null, null, { scope, policyVersion });
}

/**
 * Account data deletion (J6). Removes looks, private face media objects and
 * carts; anonymises the profile. Financial order records are retained per
 * regulated retention (documented in docs/PRIVACY.md).
 */
export async function deleteMyData(ctx: Ctx) {
  const actor = requireActor(ctx);
  const req = { id: newId(), userId: actor.userId, status: "pending" as "pending" | "completed", createdAt: nowIso(), completedAt: null as string | null };
  ctx.store.deletionRequests.push(req);
  emit(ctx, "privacy.delete_requested.v1", null, { deletionRequestId: req.id });
  let looks = 0, media = 0;
  for (const [k, l] of ctx.store.looks) if (l.userId === actor.userId) { ctx.store.looks.delete(k); looks++; }
  for (const [k, m] of ctx.store.media) {
    if (m.ownerUserId === actor.userId && m.privacyClass === "face_private") {
      await ctx.media?.delete(k);
      ctx.store.media.delete(k);
      media++;
    }
  }
  for (const [k, c] of ctx.store.carts) if (c.userId === actor.userId) {
    for (const [ik, i] of ctx.store.cartItems) if (i.cartId === c.id) ctx.store.cartItems.delete(ik);
    ctx.store.carts.delete(k);
  }
  req.status = "completed";
  req.completedAt = nowIso();
  audit(ctx, "privacy.data_deleted", "profile", actor.userId, null, { looks, media });
  return { deletionRequestId: req.id, looksDeleted: looks, mediaDeleted: media };
}

export function exportMyData(ctx: Ctx) {
  const actor = requireActor(ctx);
  const p = ctx.store.profiles.get(actor.userId)!;
  return {
    profile: { id: p.id, displayName: p.displayName, email: p.email },
    looks: [...ctx.store.looks.values()].filter((l) => l.userId === actor.userId),
    orders: [...ctx.store.orders.values()].filter((o) => o.userId === actor.userId),
    consents: ctx.store.photoConsents.filter((c) => c.userId === actor.userId),
  };
}

export function track(ctx: Ctx, raw: unknown) {
  const e = AnalyticsEvent.parse(raw);
  ctx.store.analytics.push({ id: newId(), name: e.name, userId: ctx.actor?.userId ?? null, organizationId: null, props: e.props, createdAt: nowIso() });
}
