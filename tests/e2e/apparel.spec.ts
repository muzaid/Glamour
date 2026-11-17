import { test } from "@playwright/test";
import { signIn, shot, expect } from "./helpers";

test("clothes mirror: PDP colour/size → on-device fit on demo figure → outfit saved → cart with size", async ({ page }) => {
  const uploads: string[] = [];
  page.on("request", (r) => { const b = r.postDataBuffer(); if (b && b.length > 20_000) uploads.push(r.url()); });
  await signIn(page, "bea");
  await page.goto("/shop?category=apparel");
  await expect(page.getByTestId("product-card")).toHaveCount(3);
  await page.goto("/shop/tailored-wool-blazer");
  await page.getByRole("button", { name: "Charcoal" }).click();
  await page.getByTestId("pdp-size-M").click();
  await shot(page, "14-apparel-pdp");
  await page.getByTestId("try-on-cta").click();
  await page.waitForURL(/mode=clothes/);
  await page.getByTestId("use-demo-body").click();
  const canvas = page.getByTestId("apparel-canvas");
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(400);
  // Torso pixel on the "wearing" side must now be the charcoal blazer, not the grey demo top.
  const px = await canvas.evaluate((c: HTMLCanvasElement) => Array.from(c.getContext("2d")!.getImageData(390, 520, 1, 1).data));
  expect(Math.max(px[0]!, px[1]!, px[2]!)).toBeLessThan(110);
  await shot(page, "15-clothes-mirror");
  await page.getByTestId("save-outfit").click();
  await expect(page.getByText("Outfit saved")).toBeVisible();
  await page.getByTestId("apparel-add-to-cart").click();
  await expect(page.getByText(/Added 1 item/)).toBeVisible();

  await page.getByTestId("cloud-start").click();
  await expect(page.getByTestId("cloud-unavailable")).toContainText("isn't configured");
  expect(uploads, "no image bytes may leave the device").toEqual([]);

  await page.goto("/cart");
  await expect(page.getByTestId("cart-line").first()).toContainText("Size M");
  await page.goto("/saved-looks");
  await expect(page.getByTestId("saved-look").first()).toContainText("Charcoal · M");
});

test("cloud try-on endpoint refuses without a configured provider and never accepts anonymous uploads", async ({ request }) => {
  const r = await request.get("/api/v1/tryon/generative");
  expect((await r.json()).available).toBe(false);
  const anon = await request.post("/api/v1/tryon/generative", { multipart: { consent: "true" } });
  expect(anon.status()).toBe(401);
});

test("fitting room: spatial carousel dresses the figure, layers outerwear, adds the chosen size to the bag", async ({ page }) => {
  await signIn(page, "bea");
  await page.goto("/fitting-room");
  const figure = page.getByTestId("fit-figure");
  await expect(figure.locator('[data-layer="top"]')).toHaveCount(1);
  await shot(page, "16-fitting-room");
  await page.getByTestId("fit-tab-outerwear").click();
  await page.getByTestId("fit-card-tailored-wool-blazer-Charcoal").click();
  await expect(figure.locator('[data-layer="outerwear"]')).toHaveCount(1);
  await expect(figure.locator('[data-layer="top"]')).toHaveCount(1); // blazer layers over the top
  await expect(page.getByTestId("fit-title")).toHaveText("Tailored Wool Blazer");
  await page.getByTestId("fit-size-M").click();
  await page.getByTestId("fit-add").click();
  await expect(page.getByText(/Added Tailored Wool Blazer · Charcoal · M/)).toBeVisible();
  await shot(page, "17-fitting-room-layered");
  await page.getByTestId("fit-tab-dress").click();
  await page.getByTestId("fit-card-satin-slip-dress-Emerald").click();
  await expect(figure.locator('[data-layer="dress"]')).toHaveCount(1);
  await expect(figure.locator('[data-layer="outerwear"]')).toHaveCount(0); // a dress is worn alone
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("fit-title")).toHaveText("Satin Slip Dress");
});
