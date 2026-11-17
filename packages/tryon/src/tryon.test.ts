import { describe, expect, it } from "vitest";
import { applyMakeup, ENGINE_VERSION, type PixelBuffer } from "./composite";
import { demoFaceLandmarks, DEMO_FACE } from "./demo-face";
import { assessDetection, validateUpload } from "./quality";
import { rasterize, feather } from "./raster";
import { rgbToLab, deltaE76, hexToRgb } from "./color";
import { createHash } from "node:crypto";

const W = DEMO_FACE.width, H = DEMO_FACE.height;
const lms = demoFaceLandmarks();
function flatFace(): PixelBuffer {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) { data[i * 4] = 200; data[i * 4 + 1] = 150; data[i * 4 + 2] = 120; data[i * 4 + 3] = 255; }
  return { width: W, height: H, data };
}
const px = (b: PixelBuffer, x: number, y: number) => Array.from(b.data.slice((y * W + x) * 4, (y * W + x) * 4 + 3));
const lipstick = { region: "lips" as const, hex: "#9E4B5A", finish: "matte" as const, opacity: 0.8 };

describe("overlay geometry", () => {
  it("rasterizes a square with a hole", () => {
    const sq = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    const hole = [{ x: 3, y: 3 }, { x: 7, y: 3 }, { x: 7, y: 7 }, { x: 3, y: 7 }];
    const m = rasterize([sq], [hole], 20, 20, 0);
    expect(m.data[1 * m.w + 1]).toBeCloseTo(1);
    expect(m.data[5 * m.w + 5]).toBeCloseTo(0);
    const f = feather(m, 1);
    expect(f.data[5 * m.w + 5]!).toBeLessThan(0.5);
  });
});

describe("applyMakeup", () => {
  const src = flatFace();
  const out = applyMakeup(src, lms, [lipstick]);
  it("tints the lip body", () => {
    const before = px(src, 300, 548), after = px(out, 300, 548);
    expect(after).not.toEqual(before);
    expect(after[0]! - after[2]!).toBeGreaterThan(0); // reddish
  });
  it("preserves the mouth opening (teeth) — no spill into the inner region", () => {
    expect(px(out, 300, 529)).toEqual(px(src, 300, 529));
  });
  it("does not spill outside the face regions", () => {
    for (const [x, y] of [[300, 600], [300, 480], [150, 200], [520, 700], [300, 340]]) expect(px(out, x!, y!)).toEqual(px(src, x!, y!));
  });
  it("eyeshadow stays above the lid line — eye whites preserved", () => {
    const e = applyMakeup(src, lms, [{ region: "eyelids", hex: "#6C4A6E", finish: "satin", opacity: 0.9 }]);
    expect(px(e, 224, 330)).not.toEqual(px(src, 224, 330)); // lid
    expect(px(e, 224, 346)).toEqual(px(src, 224, 346)); // eye opening / below lid
  });
  it("blush affects the cheeks only", () => {
    const b = applyMakeup(src, lms, [{ region: "cheeks", hex: "#E58A9A", finish: "satin", opacity: 1 }]);
    expect(px(b, 206, 440)).not.toEqual(px(src, 206, 440));
    expect(px(b, 300, 440)).toEqual(px(src, 300, 440));
  });
  it("opacity 0 is identity and output is deterministic", () => {
    const z = applyMakeup(src, lms, [{ ...lipstick, opacity: 0 }]);
    expect(Buffer.from(z.data).equals(Buffer.from(src.data))).toBe(true);
    const h = (b: PixelBuffer) => createHash("sha256").update(b.data).digest("hex");
    expect(h(applyMakeup(src, lms, [lipstick]))).toBe(h(out));
    expect(ENGINE_VERSION).toBe("glamotion-overlay@1");
  });
  it("does not mutate the source buffer", () => {
    expect(px(src, 300, 548)).toEqual([200, 150, 120]);
  });
});

describe("detection policy", () => {
  it("blocks no face / multiple faces / too small", () => {
    expect(assessDetection([]).blocking).toBe("NO_FACE");
    expect(assessDetection([lms, lms]).blocking).toBe("MULTIPLE_FACES");
    const tiny = Object.fromEntries(Object.entries(lms).map(([k, p]) => [k, { x: 0.5 + (p.x - 0.5) * 0.1, y: 0.5 + (p.y - 0.5) * 0.1 }]));
    expect(assessDetection([tiny]).blocking).toBe("FACE_TOO_SMALL");
    expect(assessDetection([lms]).ok).toBe(true);
  });
  it("flags low light", () => {
    const dark = flatFace(); dark.data.fill(10);
    expect(assessDetection([lms], dark).warnings).toContain("LOW_LIGHT");
  });
  it("validates uploads", () => {
    expect(validateUpload({ type: "image/gif", size: 10 })).toMatch(/JPEG/);
    expect(validateUpload({ type: "image/jpeg", size: 50 * 1024 * 1024 })).toMatch(/12 MB/);
    expect(validateUpload({ type: "image/png", size: 1000 })).toBeNull();
  });
});

describe("color", () => {
  it("lab conversion is sane", () => {
    expect(rgbToLab([255, 255, 255])[0]).toBeCloseTo(100, 0);
    expect(deltaE76(rgbToLab(hexToRgb("#9E4B5A")), rgbToLab(hexToRgb("#9E4B5A")))).toBe(0);
  });
});
