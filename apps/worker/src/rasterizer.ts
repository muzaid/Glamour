import { chromium, type Browser, type Page } from "playwright-core";
import type { MotionComposition } from "@glamotion/contracts";
import { renderFrameSvg } from "@glamotion/motion";

/**
 * Rasterises frames with headless Chromium from the deterministic SVG frame
 * function. JavaScript and network are disabled in the page; the SVG only
 * references built-in vector assets (preflight enforces the allowlist).
 */
export class FrameRasterizer {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private size = { width: 0, height: 0 };

  async open(width: number, height: number) {
    if (!this.browser) {
      this.browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--disable-gpu", "--no-sandbox", "--font-render-hinting=none"] });
    }
    if (!this.page || this.size.width !== width || this.size.height !== height) {
      await this.page?.context().close();
      const context = await this.browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, javaScriptEnabled: false, offline: true });
      // Block every network request: frames must be fully self-contained.
      await context.route("**/*", (route) => route.abort());
      this.page = await context.newPage();
      this.size = { width, height };
    }
  }

  async frame(doc: MotionComposition, index: number, scale: number): Promise<Buffer> {
    if (!this.page) throw new Error("rasterizer not open");
    const svg = renderFrameSvg(doc, index, { scale });
    await this.page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#000;overflow:hidden}svg{display:block}</style></head><body>${svg}</body></html>`, { waitUntil: "load" });
    return this.page.screenshot({ type: "jpeg", quality: 90, clip: { x: 0, y: 0, ...this.size } });
  }

  async close() {
    await this.browser?.close();
    this.browser = null; this.page = null;
  }
}
