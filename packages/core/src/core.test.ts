import { describe, expect, it, beforeEach } from "vitest";
import { SandboxPaymentProvider } from "../../integrations/src/payments";
import {
  seedDemo, DEMO_USERS, DEMO_ORGS, DEFAULT_CONFIG, type Ctx, MemoryStore, listPublishedProducts, getPublishedProduct, addCartItem, getCart,
  checkout, handlePaymentWebhook, createProduct, addVariant, transitionProduct, listOrgProducts, getOrgProduct, updateVariantPrice,
  saveLook, listMyLooks, deleteLook, deleteMyData, createProject, createCompositionFromProduct, saveCompositionRevision, requestReview,
  getReview, decideReview, addReviewComment, revokeReview, createRenderJob, claimRenderJob, completeRenderJob, failRenderJob, getRenderJob,
  assertTransition, productMachine, orderMachine, sumLines, taxMinor, AppError, ROLE_CAPABILITIES,
} from "./index";

const pay = new SandboxPaymentProvider("unit-test-secret-1234567890");
let store: MemoryStore;
const as = (u: keyof typeof DEMO_USERS | null, overrides: Partial<Ctx> = {}): Ctx => ({
  store, actor: u ? { userId: DEMO_USERS[u].id } : null, requestId: "req-test", config: { ...DEFAULT_CONFIG }, payments: pay, ...overrides,
});
const L = DEMO_ORGS.lumiere.id, N = DEMO_ORGS.nova.id;
const code = (fn: () => unknown) => { try { fn(); } catch (e) { return (e as AppError).code; } return "OK"; };
const acode = async (fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { return (e as AppError).code; } return "OK"; };
const variantBySku = (sku: string) => [...store.variants.values()].find((v) => v.sku === sku)!;

beforeEach(() => { store = seedDemo(); });

describe("money", () => {
  it("sums integer minor units and rejects mixed currencies", () => {
    expect(sumLines([{ unitPriceMinor: 2800, quantity: 2, currency: "USD" }, { unitPriceMinor: 99, quantity: 1, currency: "USD" }])).toEqual({ totalMinor: 5699, currency: "USD" });
    expect(() => sumLines([{ unitPriceMinor: 1, quantity: 1, currency: "USD" }, { unitPriceMinor: 1, quantity: 1, currency: "EUR" }])).toThrow(/Mixed/);
    expect(() => sumLines([{ unitPriceMinor: 1.5, quantity: 1, currency: "USD" }])).toThrow();
    expect(taxMinor(1000, 825)).toBe(83);
  });
});

describe("state machines", () => {
  it("rejects invalid transitions", () => {
    expect(() => assertTransition(productMachine, "archived", "published")).toThrow(/Cannot move/);
    expect(() => assertTransition(orderMachine, "created", "paid")).toThrow();
    expect(assertTransition(orderMachine, "pending_payment", "paid")).toBe("paid");
  });
});

describe("catalog & tenancy", () => {
  it("public catalog hides drafts", () => {
    const slugs = listPublishedProducts(as(null)).map((p) => p.slug);
    expect(slugs).toContain("velvet-matte-lipstick");
    expect(slugs).not.toContain("glass-lip-gloss");
    expect(code(() => getPublishedProduct(as(null), "glass-lip-gloss"))).toBe("NOT_FOUND");
  });
  it("org B cannot read or modify org A drafts — and gets NOT_FOUND, not FORBIDDEN", () => {
    const draft = [...store.products.values()].find((p) => p.slug === "glass-lip-gloss")!;
    expect(code(() => listOrgProducts(as("omar"), L))).toBe("NOT_FOUND");
    expect(code(() => getOrgProduct(as("dana"), L, draft.id))).toBe("NOT_FOUND");
    expect(code(() => transitionProduct(as("omar"), L, draft.id, "published"))).toBe("NOT_FOUND");
    // Even with own org id, a foreign product id is not found.
    expect(code(() => getOrgProduct(as("omar"), N, draft.id))).toBe("NOT_FOUND");
    expect(code(() => listOrgProducts(as("ava"), L))).toBe("NOT_FOUND");
  });
  it("revoked membership takes effect immediately", () => {
    const m = [...store.memberships.values()].find((x) => x.userId === DEMO_USERS.marco.id)!;
    expect(code(() => listOrgProducts(as("marco"), L))).toBe("OK");
    m.status = "revoked";
    expect(code(() => listOrgProducts(as("marco"), L))).toBe("NOT_FOUND");
  });
  it("designer cannot publish catalog; brand manager can create→variant→publish", () => {
    const brandId = [...store.brands.values()].find((b) => b.organizationId === L)!.id;
    const p = createProduct(as("marco"), L, { brandId, title: "Satin Lip", slug: "satin-lip", category: "lipstick", description: "Demo" });
    expect(code(() => transitionProduct(as("marco"), L, p.id, "published"))).toBe("VALIDATION_FAILED");
    addVariant(as("marco"), L, p.id, { sku: "ML-SL-RED", shadeName: "Red", hex: "#aa1122", finish: "satin", priceMinor: 2500, currency: "USD", initialStock: 5 });
    expect(code(() => addVariant(as("marco"), L, p.id, { sku: "ML-SL-RED", shadeName: "Dup", hex: "#aa1122", finish: "satin", priceMinor: 2500, currency: "USD", initialStock: 5 }))).toBe("CONFLICT");
    expect(transitionProduct(as("marco"), L, p.id, "published").status).toBe("published");
    expect(getPublishedProduct(as(null), "satin-lip").variants[0]!.price.amountMinor).toBe(2500);
    expect(store.outbox.some((e) => e.topic === "product.published.v1")).toBe(true);
    expect(code(() => createProduct(as("dana"), N, { brandId, title: "x", slug: "x-y", category: "lipstick" }))).toBe("FORBIDDEN"); // designer lacks catalog.write
    expect(code(() => createProduct(as("omar"), N, { brandId, title: "xx", slug: "x-y", category: "lipstick" }))).toBe("NOT_FOUND"); // foreign brand id
  });
  it("role matrix: client_reviewer and shopper have no workspace write capability", () => {
    expect(ROLE_CAPABILITIES.client_reviewer).not.toContain("creative.write");
    expect(ROLE_CAPABILITIES.shopper).toHaveLength(0);
  });
});

describe("commerce invariants", () => {
  it("cart uses server prices; checkout rejects stale totals and is idempotent", async () => {
    const v = variantBySku("ML-VML-ROSEWOOD");
    addCartItem(as("ava"), { productVariantId: v.id, quantity: 2 });
    // Client attempts to inject a price → ignored by schema; total from server
    const cart = addCartItem(as("ava"), { productVariantId: variantBySku("ML-VML-CORAL").id, quantity: 1, unitPriceMinor: 1 } as never);
    expect(cart.totalMinor).toBe(2800 * 3);
    expect(await acode(() => checkout(as("ava"), { expectedTotalMinor: 100, currency: "USD" }, "idem-key-0001"))).toBe("PRICE_CHANGED");
    const r1 = await checkout(as("ava"), { expectedTotalMinor: 8400, currency: "USD" }, "idem-key-0002");
    const r2 = await checkout(as("ava"), { expectedTotalMinor: 8400, currency: "USD" }, "idem-key-0002");
    expect(r2.orderId).toBe(r1.orderId);
    expect(r2.replayed).toBe(true);
    expect(store.orders.size).toBe(1);
    expect(await acode(() => checkout(as("ava"), { expectedTotalMinor: 8401, currency: "USD" }, "idem-key-0002"))).toBe("IDEMPOTENCY_REPLAY_MISMATCH");
    expect(store.inventories.get(v.id)!.reserved).toBe(2);
  });
  it("price change after viewing cart is caught at checkout", async () => {
    const v = variantBySku("ML-VML-ROSEWOOD");
    const cart = addCartItem(as("ava"), { productVariantId: v.id, quantity: 1 });
    updateVariantPrice(as("marco"), L, v.id, 3100);
    expect(await acode(() => checkout(as("ava"), { expectedTotalMinor: cart.totalMinor, currency: "USD" }, "idem-key-0003"))).toBe("PRICE_CHANGED");
  });
  it("prevents oversell: out-of-stock, unpublished and concurrent reservations", async () => {
    expect(code(() => addCartItem(as("ava"), { productVariantId: variantBySku("ML-VML-NUDE").id, quantity: 1 }))).toBe("OUT_OF_STOCK");
    expect(code(() => addCartItem(as("ava"), { productVariantId: variantBySku("ML-GLG-CLEAR").id, quantity: 1 }))).toBe("PRODUCT_UNAVAILABLE");
    const berry = variantBySku("ML-VML-BERRY"); // 12 in stock
    addCartItem(as("ava"), { productVariantId: berry.id, quantity: 8 });
    addCartItem(as("bea"), { productVariantId: berry.id, quantity: 8 });
    const results = await Promise.allSettled([
      checkout(as("ava"), { expectedTotalMinor: 8 * 2800, currency: "USD" }, "race-ava-0001"),
      checkout(as("bea"), { expectedTotalMinor: 8 * 2800, currency: "USD" }, "race-bea-0001"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const inv = store.inventories.get(berry.id)!;
    expect(inv.reserved).toBe(8);
    expect(inv.onHand - inv.reserved).toBeGreaterThanOrEqual(0);
  });
  it("only a verified, de-duplicated webhook marks an order paid", async () => {
    const v = variantBySku("ML-SGB-PEONY");
    addCartItem(as("ava"), { productVariantId: v.id, quantity: 1 });
    const r = await checkout(as("ava"), { expectedTotalMinor: 3200, currency: "USD" }, "idem-key-0004");
    const sess = store.checkoutSessions.get(r.checkoutSessionId)!;
    const forged = { body: JSON.stringify({ id: "evt_x", type: "checkout.completed", data: { session: sess.providerSessionId, amount: 3200, currency: "USD" } }), signature: "t=1,v1=00" };
    expect(code(() => handlePaymentWebhook(as(null), forged.body, forged.signature))).toBe("WEBHOOK_SIGNATURE_INVALID");
    expect(store.orders.get(r.orderId)!.status).toBe("pending_payment");
    const wrongAmount = pay.buildSignedEvent({ eventId: "evt_amt", type: "checkout.completed", providerSessionId: sess.providerSessionId, amountMinor: 1, currency: "USD" });
    expect(code(() => handlePaymentWebhook(as(null), wrongAmount.body, wrongAmount.signature))).toBe("CONFLICT");
    const ok = pay.buildSignedEvent({ eventId: "evt_ok", type: "checkout.completed", providerSessionId: sess.providerSessionId, amountMinor: 3200, currency: "USD" });
    handlePaymentWebhook(as(null), ok.body, ok.signature);
    expect(handlePaymentWebhook(as(null), ok.body, ok.signature)).toMatchObject({ duplicate: true });
    expect(store.orders.get(r.orderId)!.status).toBe("paid");
    const inv = store.inventories.get(v.id)!;
    expect([inv.onHand, inv.reserved]).toEqual([29, 0]);
    expect(getCart(as("ava")).lines).toHaveLength(0);
    // Order lines are immutable snapshots: later price changes don't alter them.
    updateVariantPrice(as("marco"), L, v.id, 9999);
    expect(store.orderItems.find((i) => i.orderId === r.orderId)!.unitPriceMinor).toBe(3200);
  });
  it("expired checkout releases reservations", async () => {
    const v = variantBySku("ML-SGB-PEONY");
    addCartItem(as("ava"), { productVariantId: v.id, quantity: 2 });
    const r = await checkout(as("ava"), { expectedTotalMinor: 6400, currency: "USD" }, "idem-key-0005");
    const sess = store.checkoutSessions.get(r.checkoutSessionId)!;
    const e = pay.buildSignedEvent({ eventId: "evt_exp", type: "checkout.expired", providerSessionId: sess.providerSessionId, amountMinor: 6400, currency: "USD" });
    handlePaymentWebhook(as(null), e.body, e.signature);
    expect(store.orders.get(r.orderId)!.status).toBe("cancelled");
    expect(store.inventories.get(v.id)!.reserved).toBe(0);
  });
  it("checkout gated by feature flag", async () => {
    addCartItem(as("ava"), { productVariantId: variantBySku("ML-SGB-PEONY").id, quantity: 1 });
    expect(await acode(() => checkout(as("ava", { config: { ...DEFAULT_CONFIG, checkoutMode: "live" } }), { expectedTotalMinor: 3200, currency: "USD" }, "idem-key-0006"))).toBe("FEATURE_DISABLED");
  });
});

describe("looks & privacy", () => {
  const recipe = (variantId: string) => ({ version: 1, selectedProducts: [{ productVariantId: variantId, cosmeticRegion: "lips", opacity: 0.6 }] });
  it("shopper A cannot see or delete shopper B's looks", () => {
    const look = saveLook(as("ava"), { name: "Date night", recipe: recipe(variantBySku("ML-VML-BERRY").id) });
    expect(listMyLooks(as("bea"))).toHaveLength(0);
    expect(code(() => deleteLook(as("bea"), look.id))).toBe("NOT_FOUND");
    expect(listMyLooks(as("ava"))[0]!.items[0]!.shadeName).toBe("Midnight Berry");
  });
  it("rejects image persistence in P0 and unpublished variants", () => {
    expect(code(() => saveLook(as("ava"), { name: "x", recipe: recipe(variantBySku("ML-VML-BERRY").id), persistImage: true }))).not.toBe("OK");
    expect(code(() => saveLook(as("ava"), { name: "x", recipe: recipe(variantBySku("ML-GLG-CLEAR").id) }))).toBe("PRODUCT_UNAVAILABLE");
  });
  it("account deletion removes looks and private face media, with a face-free audit trail", async () => {
    saveLook(as("ava"), { name: "A", recipe: recipe(variantBySku("ML-VML-BERRY").id) });
    store.media.set("faces/ava/1.jpg", { key: "faces/ava/1.jpg", organizationId: null, ownerUserId: DEMO_USERS.ava.id, mime: "image/jpeg", bytes: 10, checksum: "x", privacyClass: "face_private", createdAt: "" });
    const deleted: string[] = [];
    const res = await deleteMyData(as("ava", { media: { delete: async (k: string) => { deleted.push(k); } } as never }));
    expect(res).toMatchObject({ looksDeleted: 1, mediaDeleted: 1 });
    expect(deleted).toEqual(["faces/ava/1.jpg"]);
    const a = store.audit.find((x) => x.action === "privacy.data_deleted")!;
    expect(JSON.stringify(a)).not.toMatch(/jpg|pixel|image/);
  });
});

describe("agency review & render pipeline", () => {
  const setup = () => {
    const product = [...store.products.values()].find((p) => p.slug === "velvet-matte-lipstick")!;
    const project = createProject(as("lena"), L, { title: "Velvet launch", projectType: "product_video", objective: "Launch", channels: ["instagram"], aspectRatios: ["9:16"] });
    const { composition, doc } = createCompositionFromProduct(as("lena"), L, { productId: product.id, preset: "reel-9x16", projectId: project.id });
    return { product, project, composition, doc };
  };
  it("stale save returns CONFLICT (409)", () => {
    const { composition, doc } = setup();
    expect(saveCompositionRevision(as("lena"), L, composition.id, { baseRevision: 1, composition: doc }).revision).toBe(2);
    expect(code(() => saveCompositionRevision(as("lena"), L, composition.id, { baseRevision: 1, composition: doc }))).toBe("CONFLICT");
  });
  it("review links: scoped, comment-only reviewers cannot approve, revocation works", () => {
    const { composition } = setup();
    const viewer = requestReview(as("lena"), L, composition.id, { reviewerName: "Client viewer", canApprove: false });
    const approver = requestReview(as("lena"), L, composition.id, { reviewerName: "Client approver", canApprove: true });
    addReviewComment(as(null), viewer.token, { body: "Love it", frame: 12 });
    expect(code(() => decideReview(as(null), viewer.token, { decision: "approved" }))).toBe("FORBIDDEN");
    expect(getReview(as(null), approver.token).annotations).toHaveLength(1);
    decideReview(as(null), approver.token, { decision: "approved" });
    revokeReview(as("lena"), L, viewer.reviewSessionId);
    expect(code(() => getReview(as(null), viewer.token))).toBe("REVIEW_LINK_INVALID");
    expect(code(() => getReview(as(null), "not-a-real-token-but-long-enough"))).toBe("REVIEW_LINK_INVALID");
    expect(store.projects.get([...store.projects.keys()][0]!)!.status).toBe("approved");
  });
  it("render jobs: idempotent enqueue, claim, retry with backoff, terminal failure, completion + signed result", () => {
    const { composition } = setup();
    const a = createRenderJob(as("lena"), L, { compositionId: composition.id, revision: 1 }, "render-key-0001");
    const b = createRenderJob(as("lena"), L, { compositionId: composition.id, revision: 1 }, "render-key-0001");
    expect(b.job.id).toBe(a.job.id);
    expect(code(() => createRenderJob(as("omar"), N, { compositionId: composition.id, revision: 1 }, "render-key-0002"))).toBe("NOT_FOUND");
    expect(code(() => getRenderJob(as("omar"), L, a.job.id))).toBe("NOT_FOUND");
    const c1 = claimRenderJob(as(null), "w1")!;
    expect(c1.jobId).toBe(a.job.id);
    expect(claimRenderJob(as(null), "w2")).toBeNull(); // leased
    failRenderJob(as(null), a.job.id, "w1", "encoder crashed", true);
    expect(store.renderJobs.get(a.job.id)!.status).toBe("queued");
    store.renderJobs.get(a.job.id)!.availableAt = new Date(0).toISOString();
    claimRenderJob(as(null), "w1");
    completeRenderJob(as(null), a.job.id, "w1", { outputKey: `renders/${a.job.id}.webm`, checksum: "abc", seconds: 9, bytes: 100 });
    const media = { signDownload: (k: string) => `/api/v1/media/${k}?sig=x` } as never;
    expect(getRenderJob(as("lena", { media }), L, a.job.id).downloadUrl).toContain(`renders/${a.job.id}.webm`);
    // terminal failure
    const j2 = createRenderJob(as("lena"), L, { compositionId: composition.id, revision: 1 }, "render-key-0003").job;
    for (let i = 0; i < 3; i++) {
      store.renderJobs.get(j2.id)!.availableAt = new Date(0).toISOString();
      claimRenderJob(as(null), "w1");
      failRenderJob(as(null), j2.id, "w1", "boom", true);
    }
    expect(store.renderJobs.get(j2.id)!.status).toBe("failed");
  });
  it("render quota stops excess concurrent jobs", () => {
    const { composition } = setup();
    for (let i = 0; i < 3; i++) createRenderJob(as("lena"), L, { compositionId: composition.id, revision: 1 }, `quota-key-000${i}`);
    expect(code(() => createRenderJob(as("lena"), L, { compositionId: composition.id, revision: 1 }, "quota-key-0009"))).toBe("QUOTA_EXCEEDED");
  });
});

describe("apparel (clothing addendum)", () => {
  const top = () => [...store.products.values()].find((p) => p.slug === "silk-shell-top")!;
  const variant = (shade: string, size: string) => [...store.variants.values()].find((v) => v.productId === top().id && v.shadeName === shade && v.sizeLabel === size)!;
  it("catalog filter 'apparel' returns only clothing, 'beauty' only cosmetics", () => {
    const apparel = listPublishedProducts(as(null), { category: "apparel" }).map((p) => p.category);
    // 3 Lumière Atelier pieces + 8 runway lookbook pieces (tops and footwear).
    expect(apparel.length).toBe(11);
    expect(apparel.every((c) => ["top", "outerwear", "dress", "bottoms", "footwear"].includes(c))).toBe(true);
    expect(listPublishedProducts(as(null), { category: "beauty" }).some((p) => ["top", "footwear"].includes(p.category))).toBe(false);
    expect(getPublishedProduct(as(null), "silk-shell-top").variants.every((v) => !!v.sizeLabel)).toBe(true);
  });
  it("size travels through cart into the immutable order snapshot; XL is out of stock", async () => {
    expect(code(() => addCartItem(as("ava"), { productVariantId: variant("Ivory", "XL").id, quantity: 1 }))).toBe("OUT_OF_STOCK");
    const cart = addCartItem(as("ava"), { productVariantId: variant("Noir", "M").id, quantity: 1 });
    expect(cart.lines[0]!.sizeLabel).toBe("M");
    const r = await checkout(as("ava"), { expectedTotalMinor: 7800, currency: "USD" }, "apparel-key-0001");
    expect(store.orderItems.find((i) => i.orderId === r.orderId)!.sizeLabel).toBe("M");
  });
  it("saves a garments-only look recipe (no image)", () => {
    const look = saveLook(as("ava"), { name: "Office", recipe: { version: 1, garments: [{ productVariantId: variant("Blush", "S").id }] } });
    const listed = listMyLooks(as("ava")).find((l) => l.id === look.id)!;
    expect(listed.garments[0]!.shadeName).toBe("Blush · S");
    expect(code(() => saveLook(as("ava"), { name: "Empty", recipe: { version: 1 } }))).not.toBe("OK");
  });
  it("sizes are ignored on cosmetics variants", () => {
    const lip = [...store.products.values()].find((p) => p.slug === "velvet-matte-lipstick")!;
    const v = addVariant(as("marco"), L, lip.id, { sku: "ML-VML-TEST", shadeName: "Test", hex: "#aa2233", finish: "matte", priceMinor: 2800, currency: "USD", initialStock: 1, sizeLabel: "M" });
    expect(v.sizeLabel).toBeNull();
  });
});
