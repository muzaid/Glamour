import { expect, type Page } from "@playwright/test";

export async function signIn(page: Page, user: string) {
  await page.goto("/sign-in");
  await page.getByTestId(`signin-${user}`).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"));
}

export async function shot(page: Page, name: string) {
  await page.screenshot({ path: `docs/evidence/${name}.png`, fullPage: false });
}

export const ORG_L = "10000000-0000-4000-8000-000000000001";
export { expect };
