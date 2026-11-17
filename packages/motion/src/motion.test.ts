import { describe, expect, it } from "vitest";
import { valueAt, EASINGS } from "./interpolate";
import { buildPreset, PRESETS } from "./presets";
import { renderFrameSvg, totalFrames, locateFrame, escapeXml } from "./render-svg";
import { preflight } from "./preflight";

const input = {
  id: "c1", title: "Test", brandName: "Maison Demo", productTitle: "Velvet Lip", aspectRatio: "9:16" as const,
  shades: [
    { productVariantId: "11111111-1111-4111-8111-111111111111", name: "Rosewood", hex: "#9E4B5A" },
    { productVariantId: "22222222-2222-4222-8222-222222222222", name: "Coral", hex: "#E0715F" },
  ],
};

describe("interpolation", () => {
  it("holds before first and after last keyframe", () => {
    const k = [{ frame: 10, value: 0, easing: "linear" as const }, { frame: 20, value: 100, easing: "linear" as const }];
    expect(valueAt(k, 0)).toBe(0);
    expect(valueAt(k, 15)).toBe(50);
    expect(valueAt(k, 99)).toBe(100);
  });
  it("easings are monotonic and hit endpoints", () => {
    for (const fn of Object.values(EASINGS)) {
      expect(fn(0)).toBeCloseTo(0, 5);
      expect(fn(1)).toBeCloseTo(1, 5);
      let prev = -1;
      for (let t = 0; t <= 1; t += 0.05) { const v = fn(t); expect(v).toBeGreaterThanOrEqual(prev - 1e-9); prev = v; }
    }
  });
});

describe("presets", () => {
  it("every preset compiles to a schema-valid, preflight-clean composition", () => {
    for (const p of PRESETS) {
      const c = buildPreset(p.id, input);
      const r = preflight(c);
      expect(r.ok, `${p.id}: ${JSON.stringify(r.issues)}`).toBe(true);
      expect(totalFrames(c)).toBeGreaterThan(0);
    }
  });
  it("is deterministic (same input → identical JSON and frame snapshot)", () => {
    const a = buildPreset("reel-9x16", input), b = buildPreset("reel-9x16", input);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(renderFrameSvg(a, 45)).toBe(renderFrameSvg(b, 45));
  });
  it("frame snapshot is stable", () => {
    const c = buildPreset("lipstick-swipe", input);
    expect(renderFrameSvg(c, 12)).toMatchSnapshot();
  });
  it("locates frames across scenes", () => {
    const c = buildPreset("reel-9x16", input);
    const first = c.scenes[0]!.durationInFrames;
    expect(locateFrame(c, first).scene.id).toBe(c.scenes[1]!.id);
    expect(locateFrame(c, first).local).toBe(0);
  });
});

describe("render safety", () => {
  it("rejects non-allowlisted assets (SSRF guard)", () => {
    const c = buildPreset("luxury-product-reveal", input);
    const bad = structuredClone(c);
    const img = bad.scenes[0]!.elements.find((e) => e.layer.type === "image")!;
    (img.layer as { assetId: string }).assetId = "asset:http-evil";
    const r = preflight(bad);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "ASSET_NOT_ALLOWED")).toBe(true);
  });
  it("rejects URL-like asset ids at schema level", () => {
    const c = buildPreset("luxury-product-reveal", input);
    const bad = structuredClone(c) as unknown as { scenes: { elements: { layer: { type: string; assetId?: string } }[] }[] };
    bad.scenes[0]!.elements.find((e) => e.layer.type === "image")!.layer.assetId = "http://169.254.169.254/latest";
    expect(preflight(bad).ok).toBe(false);
  });
  it("caps frame counts", () => {
    const c = buildPreset("luxury-product-reveal", input);
    c.scenes[0]!.durationInFrames = 1800;
    expect(preflight(c, { maxFrames: 900, maxPixels: 1e9, maxElements: 100, maxTextChars: 1000 }).ok).toBe(false);
  });
  it("escapes text into SVG", () => {
    expect(escapeXml(`<script>"x"&</script>`)).toBe("&lt;script&gt;&quot;x&quot;&amp;&lt;/script&gt;");
  });
});
