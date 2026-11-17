import { test } from "@playwright/test";
import { signIn, shot, expect } from "./helpers";

/**
 * Spec §25 "Recommended first vertical slice", end to end against the running
 * web app + render worker: merchant publishes a lipstick shade → shopper tries
 * it on locally → adjusts opacity → before/after → add to cart → sandbox order
 * (paid via signed webhook) → merchant converts the product to a 9:16 motion
 * template → client approves → final render finishes with a signed download.
 */
test.describe.serial("first vertical slice", () => {
  const slug = `satin-kiss-${Date.now().toString(36)}`;

  test("merchant creates, stocks and publishes a lipstick SKU", async ({ page }) => {
    await signIn(page, "marco");
    await page.goto("/studio/maison-lumiere/products/new");
    await page.getByTestId("product-title").fill("Satin Kiss Lipstick");
    await page.getByTestId("product-slug").fill(slug);
    await page.getByTestId("product-description").fill("A satin lipstick with a soft sheen. Demo product.");
    await page.getByTestId("create-product").click();
    await page.waitForURL(/\/products\/[0-9a-f-]{36}$/);
    await page.getByTestId("publish").click();
    await expect(page.locator(".gm-alert-error")).toContainText("variant");
    await page.getByTestId("variant-name").fill("Cherry Satin");
    await page.getByTestId("variant-sku").fill(`ML-SK-${Date.now().toString(36).toUpperCase()}`);
    await page.getByTestId("variant-price").fill("29.00");
    await page.getByTestId("add-variant").click();
    await expect(page.getByText("Cherry Satin")).toBeVisible();
    await page.getByTestId("publish").click();
    await expect(page.getByTestId("product-status")).toHaveText("published");
    await shot(page, "03-merchant-product");
    await page.goto(`/shop/${slug}`);
    await expect(page.getByRole("heading", { name: "Satin Kiss Lipstick" })).toBeVisible();
  });

  test("shopper tries on locally, saves a look, buys via sandbox checkout", async ({ page }) => {
    const uploads: string[] = [];
    page.on("request", (r) => { const b = r.postData(); if (b && (b.length > 20_000 || /data:image|base64/.test(b))) uploads.push(r.url()); });
    await signIn(page, "ava");
    await page.goto(`/shop/${slug}`);
    await shot(page, "02-pdp");
    await page.getByTestId("try-on-cta").click();
    await page.waitForURL(/\/try-on\?variant=/);
    await shot(page, "04-consent-gate");
    await page.getByTestId("use-demo").click();
    const canvas = page.getByTestId("tryon-canvas");
    await expect(canvas).toBeVisible();
    await page.getByTestId("opacity-lips").fill("85");
    await page.waitForTimeout(300);
    await shot(page, "05-tryon-before-after");
    // Pixel check: the right ("after") half of the lips differs from the left ("before").
    const tinted = await canvas.evaluate((c: HTMLCanvasElement) => {
      const g = c.getContext("2d")!;
      const after = g.getImageData(330, 548, 1, 1).data, before = g.getImageData(270, 548, 1, 1).data;
      return { after: Array.from(after), before: Array.from(before) };
    });
    expect(tinted.after).not.toEqual(tinted.before);
    await page.getByTestId("save-look").click();
    await expect(page.getByText("Look saved")).toBeVisible();
    await page.getByTestId("tryon-add-to-cart").click();
    await expect(page.getByText(/Added 1 shade/)).toBeVisible();
    expect(uploads, "no image data may leave the device").toEqual([]);

    await page.goto("/cart");
    await expect(page.getByTestId("cart-line")).toHaveCount(1);
    await shot(page, "06-cart");
    await page.getByTestId("checkout").click();
    await page.waitForURL(/\/checkout\/sandbox/);
    await page.getByTestId("sandbox-pay").click();
    await page.waitForURL(/\/orders\//);
    await expect(page.getByTestId("order-status")).toHaveText("paid", { timeout: 20_000 });
    await shot(page, "07-order-paid");
  });

  test("brand turns the product into a 9:16 motion, client approves, final render delivers", async ({ page, browser }) => {
    await signIn(page, "lena");
    await page.goto("/studio/maison-lumiere/projects");
    await page.getByTestId("brief-title").fill("Satin Kiss launch reel");
    await page.getByTestId("brief-objective").fill("Launch the new satin shade on Instagram.");
    await page.getByTestId("create-project").click();
    await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
    await page.goto("/studio/maison-lumiere/products");
    await page.getByRole("link", { name: "Satin Kiss Lipstick" }).click();
    await page.getByTestId("create-motion").click();
    await page.waitForURL(/\/motion\/[0-9a-f-]{36}$/);
    await page.getByRole("button", { name: "CTA", exact: true }).click();
    await page.getByTestId("inspector-text").fill("Cherry Satin — try it on");
    await page.getByTestId("save-composition").click();
    await expect(page.getByText(/Saved revision 2/)).toBeVisible();
    await shot(page, "08-motion-editor");

    await page.getByTestId("request-review").click();
    const reviewUrl = await page.getByTestId("review-url").getAttribute("href");
    expect(reviewUrl).toMatch(/\/review\/[A-Za-z0-9_-]{20,}/);
    const client = await browser.newContext();
    const cp = await client.newPage();
    await cp.goto(reviewUrl!);
    await cp.getByTestId("review-comment").fill("Love the swipe — approved from our side.");
    await cp.getByTestId("post-comment").click();
    await expect(cp.getByText("Love the swipe")).toBeVisible();
    await cp.getByTestId("client-approve").click();
    await expect(cp.getByText(/Latest decision/)).toContainText("approved");
    await cp.screenshot({ path: "docs/evidence/09-client-review.png" });
    await client.close();

    await page.getByTestId("render-final").click();
    await expect(page.getByTestId("render-status")).toContainText("completed", { timeout: 90_000 });
    const video = page.getByTestId("render-video");
    await expect(video).toBeVisible();
    const src = await video.getAttribute("src");
    const res = await page.request.get(src!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("video/webm");
    expect((await res.body()).subarray(0, 4).toString("hex")).toBe("1a45dfa3");
    const tampered = await page.request.get(src!.replace(/sig=[0-9a-f]{4}/, "sig=0000"));
    expect(tampered.status()).toBe(404);
    await shot(page, "10-render-complete");
  });

  test("AI campaign workflow stops at human gates, then renders after approval", async ({ page }) => {
    await signIn(page, "lena");
    await page.goto("/studio/maison-lumiere/campaigns");
    await page.getByTestId("campaign-product").selectOption({ label: "Velvet Matte Lipstick" });
    await page.getByTestId("start-campaign").click();
    await page.waitForURL(/\/campaigns\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId("workflow-status")).toHaveText("awaiting_human");
    await shot(page, "11-agent-graph-gate1");
    await page.getByTestId("concept-quiet-luxury").check();
    await page.getByTestId("approve-direction").click();
    await expect(page.getByTestId("approve-output")).toBeVisible({ timeout: 20_000 });
    await shot(page, "12-agent-approve-output");
    await page.getByTestId("approve-output").click();
    await expect(page.getByTestId("workflow-status")).toHaveText("completed");
    await expect(page.getByTestId("campaign-render")).toContainText("completed", { timeout: 120_000 });
  });
});
