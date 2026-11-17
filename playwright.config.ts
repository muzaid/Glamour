import { defineConfig, devices } from "@playwright/test";

const env = {
  GLAMOTION_DEMO_MODE: "1",
  GLAMOTION_SESSION_SECRET: "e2e-session-secret-0123456789",
  PAYMENT_WEBHOOK_SECRET: "e2e-webhook-secret-0123456789",
  MEDIA_SIGNING_SECRET: "e2e-media-secret-0123456789",
  WORKER_TOKEN: "e2e-worker-token-0123456789",
  NEXT_TELEMETRY_DISABLED: "1",
};

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3000", trace: "off", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: [
    { command: "pnpm --filter @glamotion/web start", url: "http://localhost:3000/api/v1/products", reuseExistingServer: false, timeout: 120_000, env },
    { command: "pnpm --filter @glamotion/worker start", reuseExistingServer: false, timeout: 30_000, env: { ...env, GLAMOTION_WEB_URL: "http://localhost:3000", WORKER_ID: "e2e-worker" }, wait: { stdout: /worker started/ } },
  ],
});
