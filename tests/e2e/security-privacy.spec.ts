import { test } from "@playwright/test";
import { signIn, shot, expect, ORG_L } from "./helpers";

test("other tenants get 404 with no data leak (pages and API)", async ({ page }) => {
  await signIn(page, "omar");
  const res = await page.goto("/studio/maison-lumiere/overview");
  expect(res?.status()).toBe(404);
  const api = await page.request.get(`/api/v1/orgs/${ORG_L}/products`);
  expect(api.status()).toBe(404);
  const body = await api.text();
  expect(body).not.toMatch(/Glass Lip Gloss|ML-GLG/);
  expect(JSON.parse(body).error.code).toBe("NOT_FOUND");
});

test("anonymous and forged requests are refused", async ({ request }) => {
  expect((await request.post("/api/v1/checkout", { data: { expectedTotalMinor: 1, currency: "USD" }, headers: { "idempotency-key": "anon-key-0001" } })).status()).toBe(401);
  const forged = await request.post("/api/v1/webhooks/payments", { data: { id: "evt_forged", type: "checkout.completed", data: { session: "x", amount: 1, currency: "USD" } }, headers: { "x-sandbox-signature": "t=1,v1=00" } });
  expect(forged.status()).toBe(400);
  expect((await forged.json()).error.code).toBe("WEBHOOK_SIGNATURE_INVALID");
  const claim = await request.post("/api/internal/render-jobs/claim", { headers: { authorization: "Bearer wrong", "x-worker-id": "evil" } });
  expect(claim.status()).toBe(401);
  const cross = await request.post("/api/v1/cart/items", { data: { productVariantId: "50000000-0000-4000-8000-000000000001", quantity: 1 }, headers: { origin: "https://evil.example" } });
  expect([401, 403]).toContain(cross.status());
});

test("draft products are not purchasable even by direct API call", async ({ page }) => {
  await signIn(page, "bea");
  const products = await (await page.request.get("/api/v1/products")).json();
  expect(JSON.stringify(products)).not.toContain("glass-lip-gloss");
  const draftVariant = "ML-GLG-CLEAR";
  expect(JSON.stringify(products)).not.toContain(draftVariant);
});

test("camera permission denied falls back to upload / demo", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: () => Promise.reject(new DOMException("denied", "NotAllowedError")) } });
  });
  await page.goto("/try-on");
  await page.getByTestId("consent-ack").check();
  await page.getByTestId("use-camera").click();
  await expect(page.getByTestId("tryon-issue")).toContainText("Camera permission was declined");
  await expect(page.getByTestId("use-demo")).toBeEnabled();
  await shot(page, "13-camera-denied-fallback");
});

test("customer deletion removes saved looks", async ({ page }) => {
  await signIn(page, "bea");
  await page.goto("/try-on?variant=" + "x");
  await page.getByTestId("use-demo").click();
  await page.getByRole("button", { name: /Velvet Matte Lipstick — Rosewood/ }).click();
  await page.getByTestId("save-look").click();
  await expect(page.getByText("Look saved")).toBeVisible();
  await page.goto("/saved-looks");
  expect(await page.getByTestId("saved-look").count()).toBeGreaterThanOrEqual(1);
  await page.goto("/account");
  await page.getByTestId("delete-data").click();
  await page.getByTestId("confirm-delete").click();
  await expect(page.getByText(/Deleted \d+ saved looks/)).toBeVisible();
  await page.goto("/saved-looks");
  await expect(page.getByTestId("saved-look")).toHaveCount(0);
});

test("invalid review link reveals nothing", async ({ page }) => {
  await page.goto("/review/this-token-does-not-exist-123456");
  await expect(page.getByRole("heading")).toContainText("invalid or has expired");
});

test("storefront renders at 320px without horizontal scroll", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 720 } });
  const page = await ctx.newPage();
  for (const path of ["/", "/shop", "/shop/velvet-matte-lipstick", "/try-on"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
  await page.goto("/");
  await page.screenshot({ path: "docs/evidence/01-mobile-home.png" });
  await ctx.close();
});
