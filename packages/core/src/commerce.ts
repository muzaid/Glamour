import { AddCartItemInput, CheckoutInput } from "@glamotion/contracts";
import type { Ctx } from "./context";
import { requireActor } from "./context";
import { AppError, notFound } from "./errors";
import { newId, nowIso, sha256 } from "./ids";
import { sumLines, taxMinor } from "./money";
import { assertTransition, orderMachine } from "./state";
import { audit, emit } from "./audit";
import { availableUnits } from "./catalog";
import type { CartRow, OrderRow } from "./store";

export interface CartLineView {
  itemId: string; variantId: string; productId: string; productSlug: string; productTitle: string; brandName: string;
  shadeName: string; sizeLabel: string | null; hex: string; sku: string; quantity: number; unitPriceMinor: number; currency: string; lineTotalMinor: number;
  available: number; issue: null | "UNAVAILABLE" | "INSUFFICIENT_STOCK";
}
export interface CartView { cartId: string | null; lines: CartLineView[]; subtotalMinor: number; taxMinor: number; totalMinor: number; currency: string | null; checkoutReady: boolean }

function cartFor(ctx: Ctx, userId: string, create: boolean): CartRow | null {
  const c = [...ctx.store.carts.values()].find((x) => x.userId === userId);
  if (c || !create) return c ?? null;
  const now = nowIso();
  const row: CartRow = { id: newId(), userId, createdAt: now, updatedAt: now };
  ctx.store.carts.set(row.id, row);
  return row;
}

function purchasableVariant(ctx: Ctx, variantId: string) {
  const v = ctx.store.variants.get(variantId);
  const p = v ? ctx.store.products.get(v.productId) : undefined;
  const org = p ? ctx.store.organizations.get(p.organizationId) : undefined;
  if (!v || !p || !v.active || p.status !== "published" || org?.status !== "active") return null;
  return { v, p };
}

/** Prices come from the server catalog on every read — the client never supplies a price. */
export function getCart(ctx: Ctx): CartView {
  const actor = requireActor(ctx);
  const cart = cartFor(ctx, actor.userId, false);
  if (!cart) return { cartId: null, lines: [], subtotalMinor: 0, taxMinor: 0, totalMinor: 0, currency: null, checkoutReady: false };
  const lines: CartLineView[] = [];
  for (const item of ctx.store.cartItems.values()) {
    if (item.cartId !== cart.id) continue;
    const v = ctx.store.variants.get(item.variantId)!;
    const p = ctx.store.products.get(v.productId)!;
    const ok = purchasableVariant(ctx, v.id);
    const available = availableUnits(ctx, v.id);
    lines.push({
      itemId: item.id, variantId: v.id, productId: p.id, productSlug: p.slug, productTitle: p.title,
      brandName: ctx.store.brands.get(p.brandId)?.name ?? "", shadeName: v.shadeName, sizeLabel: v.sizeLabel, hex: v.hex, sku: v.sku,
      quantity: item.quantity, unitPriceMinor: v.priceMinor, currency: v.currency, lineTotalMinor: v.priceMinor * item.quantity,
      available, issue: !ok ? "UNAVAILABLE" : available < item.quantity ? "INSUFFICIENT_STOCK" : null,
    });
  }
  const valid = lines.filter((l) => !l.issue);
  const { totalMinor: subtotal, currency } = sumLines(valid.map((l) => ({ unitPriceMinor: l.unitPriceMinor, quantity: l.quantity, currency: l.currency })));
  const tax = taxMinor(subtotal, ctx.config.taxRateBps);
  return { cartId: cart.id, lines, subtotalMinor: subtotal, taxMinor: tax, totalMinor: subtotal + tax, currency, checkoutReady: lines.length > 0 && valid.length === lines.length };
}

export function addCartItem(ctx: Ctx, raw: unknown): CartView {
  const actor = requireActor(ctx);
  const input = AddCartItemInput.parse(raw);
  const pv = purchasableVariant(ctx, input.productVariantId);
  if (!pv) throw new AppError("PRODUCT_UNAVAILABLE", "Variant no longer available");
  const cart = cartFor(ctx, actor.userId, true)!;
  const existing = [...ctx.store.cartItems.values()].find((i) => i.cartId === cart.id && i.variantId === pv.v.id);
  const nextQty = (existing?.quantity ?? 0) + input.quantity;
  if (nextQty > 10) throw new AppError("VALIDATION_FAILED", "Maximum 10 units per shade");
  if (availableUnits(ctx, pv.v.id) < nextQty) throw new AppError("OUT_OF_STOCK", "Not enough stock for this shade", { available: availableUnits(ctx, pv.v.id) });
  // Single-currency carts (multi-currency checkout is an open product decision).
  const view = getCart(ctx);
  if (view.currency && view.currency !== pv.v.currency) throw new AppError("CURRENCY_MISMATCH", "Cart already contains items in another currency");
  if (existing) existing.quantity = nextQty;
  else {
    const id = newId();
    ctx.store.cartItems.set(id, { id, cartId: cart.id, variantId: pv.v.id, quantity: input.quantity });
  }
  cart.updatedAt = nowIso();
  return getCart(ctx);
}

export function removeCartItem(ctx: Ctx, itemId: string): CartView {
  const actor = requireActor(ctx);
  const cart = cartFor(ctx, actor.userId, false);
  const entry = [...ctx.store.cartItems.entries()].find(([, i]) => i.id === itemId && i.cartId === cart?.id);
  if (!entry) throw notFound("Cart item");
  ctx.store.cartItems.delete(entry[0]);
  return getCart(ctx);
}

/**
 * Server-authoritative checkout:
 *  1. idempotency (same key+payload → same session; different payload → 422)
 *  2. recompute price from catalog; reject if client total differs (stale cart)
 *  3. reserve inventory all-or-nothing (atomic in this single-threaded store;
 *     `app.reserve_inventory()` row-locks in Postgres)
 *  4. immutable order line snapshots, order → pending_payment
 *  5. payment provider session. Paid state only arrives via verified webhook.
 */
export async function checkout(ctx: Ctx, raw: unknown, idempotencyKey: string | null) {
  const actor = requireActor(ctx);
  if (ctx.config.checkoutMode === "disabled") throw new AppError("FEATURE_DISABLED", "Checkout is not enabled for this market");
  if (ctx.config.checkoutMode === "live") throw new AppError("FEATURE_DISABLED", "Live checkout requires configured tax, shipping and payment provider (see docs/DECISIONS.md)");
  if (!idempotencyKey || !/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey)) throw new AppError("VALIDATION_FAILED", "Idempotency-Key header required");
  if (!ctx.payments) throw new AppError("INTERNAL", "Payment provider not configured");
  const input = CheckoutInput.parse(raw);
  const requestHash = sha256(JSON.stringify(input));

  const prior = [...ctx.store.checkoutSessions.values()].find((s) => s.userId === actor.userId && s.idempotencyKey === idempotencyKey);
  if (prior) {
    if (prior.requestHash !== requestHash) throw new AppError("IDEMPOTENCY_REPLAY_MISMATCH", "Idempotency-Key reused with a different request");
    const order = ctx.store.orders.get(prior.orderId)!;
    return { checkoutSessionId: prior.id, orderId: prior.orderId, status: order.status, totalMinor: prior.totalMinor, currency: prior.currency, redirectUrl: `/checkout/sandbox?session=${prior.providerSessionId}`, replayed: true };
  }

  const cart = getCart(ctx);
  if (!cart.cartId || cart.lines.length === 0) throw new AppError("VALIDATION_FAILED", "Cart is empty");
  if (!cart.checkoutReady) throw new AppError("PRODUCT_UNAVAILABLE", "Some items are unavailable", { lines: cart.lines.filter((l) => l.issue).map((l) => l.itemId) });
  if (cart.currency !== input.currency) throw new AppError("CURRENCY_MISMATCH", "Currency changed");
  if (cart.totalMinor !== input.expectedTotalMinor) throw new AppError("PRICE_CHANGED", "Prices changed since you viewed your cart", { totalMinor: cart.totalMinor });

  // Atomic all-or-nothing reservation (no awaits inside this block).
  for (const l of cart.lines) if (availableUnits(ctx, l.variantId) < l.quantity) throw new AppError("OUT_OF_STOCK", `${l.productTitle} — ${l.shadeName} is out of stock`);
  const orderId = newId();
  const now = nowIso();
  for (const l of cart.lines) {
    const inv = ctx.store.inventories.get(l.variantId)!;
    inv.reserved += l.quantity;
    ctx.store.inventoryMovements.push({ id: newId(), variantId: l.variantId, organizationId: inv.organizationId, delta: 0, reason: `reserve:${l.quantity}`, refId: orderId, createdAt: now });
  }
  const order: OrderRow = { id: orderId, userId: actor.userId, status: "created", totalMinor: cart.totalMinor, taxMinor: cart.taxMinor, currency: cart.currency!, createdAt: now, paidAt: null };
  ctx.store.orders.set(order.id, order);
  for (const l of cart.lines) {
    const v = ctx.store.variants.get(l.variantId)!;
    ctx.store.orderItems.push({
      id: newId(), orderId, organizationId: v.organizationId, variantId: v.id, productTitle: l.productTitle, shadeName: l.shadeName, sizeLabel: l.sizeLabel,
      sku: l.sku, unitPriceMinor: l.unitPriceMinor, quantity: l.quantity, taxMinor: taxMinor(l.lineTotalMinor, ctx.config.taxRateBps), discountMinor: 0, currency: l.currency,
    });
  }
  setOrderStatus(ctx, order, "pending_payment", actor.userId);
  const sessionId = newId();
  const provider = await ctx.payments.createCheckout({ orderId, amountMinor: order.totalMinor, currency: order.currency, idempotencyKey: `${actor.userId}:${idempotencyKey}`, requestId: ctx.requestId });
  ctx.store.checkoutSessions.set(sessionId, { id: sessionId, userId: actor.userId, cartId: cart.cartId, idempotencyKey, requestHash, totalMinor: order.totalMinor, currency: order.currency, providerSessionId: provider.providerSessionId, orderId, status: "open", createdAt: now });
  audit(ctx, "checkout.started", "order", orderId, null, { totalMinor: order.totalMinor });
  return { checkoutSessionId: sessionId, orderId, status: order.status, totalMinor: order.totalMinor, currency: order.currency, redirectUrl: provider.redirectUrl, replayed: false };
}

function setOrderStatus(ctx: Ctx, order: OrderRow, to: OrderRow["status"], actor: string) {
  const from = order.status;
  assertTransition(orderMachine, from, to, "order");
  order.status = to;
  ctx.store.orderEvents.push({ id: newId(), orderId: order.id, from, to, actor, createdAt: nowIso() });
}

/** Verified + de-duplicated payment webhook. The browser redirect never marks an order paid. */
export function handlePaymentWebhook(ctx: Ctx, rawBody: string, signature: string | null) {
  if (!ctx.payments) throw new AppError("INTERNAL", "Payment provider not configured");
  const evt = ctx.payments.verifyWebhook(rawBody, signature); // throws on bad signature
  if (ctx.store.paymentEvents.has(evt.eventId)) return { duplicate: true, eventId: evt.eventId };
  const session = [...ctx.store.checkoutSessions.values()].find((s) => s.providerSessionId === evt.providerSessionId);
  ctx.store.paymentEvents.set(evt.eventId, { providerEventId: evt.eventId, type: evt.type, orderId: session?.orderId ?? null, receivedAt: nowIso(), processed: false });
  if (!session) {
    audit(ctx, "payment.webhook_unmatched", "payment_event", null, null, { type: evt.type });
    return { duplicate: false, eventId: evt.eventId, matched: false };
  }
  const order = ctx.store.orders.get(session.orderId)!;
  const items = ctx.store.orderItems.filter((i) => i.orderId === order.id);
  if (evt.type === "checkout.completed") {
    if (evt.amountMinor !== order.totalMinor || evt.currency !== order.currency) {
      audit(ctx, "payment.amount_mismatch", "order", order.id, null, { expected: order.totalMinor, got: evt.amountMinor });
      throw new AppError("CONFLICT", "Payment amount does not match order");
    }
    if (order.status !== "pending_payment") return { duplicate: false, eventId: evt.eventId, ignored: true };
    for (const i of items) {
      const inv = ctx.store.inventories.get(i.variantId)!;
      inv.reserved -= i.quantity;
      inv.onHand -= i.quantity;
      ctx.store.inventoryMovements.push({ id: newId(), variantId: i.variantId, organizationId: inv.organizationId, delta: -i.quantity, reason: "sale", refId: order.id, createdAt: nowIso() });
    }
    setOrderStatus(ctx, order, "paid", "payment_webhook");
    order.paidAt = nowIso();
    session.status = "completed";
    // Clear purchased cart lines.
    for (const [k, ci] of ctx.store.cartItems) if (ci.cartId === session.cartId) ctx.store.cartItems.delete(k);
    for (const org of new Set(items.map((i) => i.organizationId))) emit(ctx, "checkout.paid.v1", org, { orderId: order.id });
    audit(ctx, "order.paid", "order", order.id, null, { totalMinor: order.totalMinor });
  } else {
    if (order.status === "pending_payment") {
      for (const i of items) ctx.store.inventories.get(i.variantId)!.reserved -= i.quantity;
      setOrderStatus(ctx, order, "cancelled", "payment_webhook");
      session.status = "expired";
      audit(ctx, "order.cancelled", "order", order.id, null, { reason: evt.type });
    }
  }
  ctx.store.paymentEvents.get(evt.eventId)!.processed = true;
  return { duplicate: false, eventId: evt.eventId, orderStatus: order.status };
}

export function listMyOrders(ctx: Ctx) {
  const actor = requireActor(ctx);
  return [...ctx.store.orders.values()]
    .filter((o) => o.userId === actor.userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((o) => ({ ...o, items: ctx.store.orderItems.filter((i) => i.orderId === o.id) }));
}

export function getMyOrder(ctx: Ctx, orderId: string) {
  const o = listMyOrders(ctx).find((x) => x.id === orderId);
  if (!o) throw notFound("Order");
  return o;
}
