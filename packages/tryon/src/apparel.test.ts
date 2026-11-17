import { describe, expect, it } from "vitest";
import { applyAffine, assessPoses, bodyAnchors, garmentAsset, garmentTransform, solveAffine, POSE } from "./apparel";
import { demoBodyPose, DEMO_BODY } from "./demo-body";

const W = DEMO_BODY.width, H = DEMO_BODY.height;

describe("affine solver", () => {
  it("maps the three source points exactly onto the destinations", () => {
    const src: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 20 }];
    const dst: typeof src = [{ x: 100, y: 50 }, { x: 140, y: 60 }, { x: 115, y: 130 }];
    const m = solveAffine(src, dst);
    src.forEach((p, i) => { const q = applyAffine(m, p); expect(q.x).toBeCloseTo(dst[i]!.x, 6); expect(q.y).toBeCloseTo(dst[i]!.y, 6); });
  });
  it("rejects collinear anchors", () => {
    expect(() => solveAffine([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }], [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }])).toThrow();
  });
});

describe("garment fitting", () => {
  const pose = demoBodyPose();
  for (const cat of ["top", "outerwear", "dress"] as const) {
    it(`${cat}: shoulder seams land on the shoulders and mid-hip on the hips`, () => {
      const asset = garmentAsset(cat)!;
      const m = garmentTransform(asset, pose, W, H)!;
      const b = bodyAnchors(pose, W, H)!;
      const l = applyAffine(m, { x: asset.anchors!.left[0], y: asset.anchors!.left[1] });
      const r = applyAffine(m, { x: asset.anchors!.right[0], y: asset.anchors!.right[1] });
      const h = applyAffine(m, { x: asset.anchors!.hip[0], y: asset.anchors!.hip[1] });
      expect(l.x).toBeCloseTo(b.left.x, 4); expect(r.x).toBeCloseTo(b.right.x, 4); expect(h.y).toBeCloseTo(b.hip.y, 4);
    });
  }
  it("mirrored (selfie) input still puts the image-left seam on the image-left shoulder", () => {
    const mirrored = Object.fromEntries(Object.entries(demoBodyPose()).map(([k, p]) => [k, { ...p, x: 1 - p.x }]));
    const b = bodyAnchors(mirrored, W, H)!;
    expect(b.left.x).toBeLessThan(b.right.x);
  });
  it("estimates hips when they are out of frame (webcam framing)", () => {
    const p = demoBodyPose();
    p[POSE.L_HIP] = { ...p[POSE.L_HIP]!, visibility: 0.1 };
    const b = bodyAnchors(p, W, H)!;
    expect(b.estimatedHip).toBe(true);
    expect(b.hip.y).toBeGreaterThan(b.left.y);
  });
  it("fitScale widens around the shoulder midpoint", () => {
    const asset = garmentAsset("top")!;
    const a = garmentTransform(asset, pose, W, H, { fitScale: 1 })!, b = garmentTransform(asset, pose, W, H, { fitScale: 1.2 })!;
    const width = (m: typeof a) => applyAffine(m, { x: asset.anchors!.right[0], y: asset.anchors!.right[1] }).x - applyAffine(m, { x: asset.anchors!.left[0], y: asset.anchors!.left[1] }).x;
    expect(width(b) / width(a)).toBeCloseTo(1.2, 5);
  });
  it("non-garment categories have no template", () => {
    expect(garmentAsset("lipstick")).toBeNull();
  });
});

describe("pose policy", () => {
  it("requires exactly one person with visible shoulders", () => {
    expect(assessPoses([]).blocking).toBe("NO_PERSON");
    expect(assessPoses([demoBodyPose(), demoBodyPose()]).blocking).toBe("MULTIPLE_PEOPLE");
    const p = demoBodyPose(); p[POSE.L_SHOULDER] = { ...p[POSE.L_SHOULDER]!, visibility: 0.1 };
    expect(assessPoses([p]).blocking).toBe("SHOULDERS_NOT_VISIBLE");
    expect(assessPoses([demoBodyPose()]).ok).toBe(true);
  });
});

import { compareSizes } from "@glamotion/contracts";
describe("size ordering", () => {
  it("orders letter sizes by wear order and numeric sizes ascending", () => {
    expect(["L", "XS", "M", "XL", "S"].sort(compareSizes)).toEqual(["XS", "S", "M", "L", "XL"]);
    expect(["12", "8", "10"].sort(compareSizes)).toEqual(["8", "10", "12"]);
  });
});

import { outfitSvg } from "./outfit";
describe("outfitSvg (fitting room renderer)", () => {
  it("layers garments in order with a fitted matrix and is deterministic", () => {
    const a = outfitSvg([{ category: "top", hex: "#EDE6DA" }, { category: "outerwear", hex: "#3B3A40" }], { skin: "amber" });
    expect(a).toBe(outfitSvg([{ category: "top", hex: "#EDE6DA" }, { category: "outerwear", hex: "#3B3A40" }], { skin: "amber" }));
    expect(a.indexOf('data-layer="top"')).toBeLessThan(a.indexOf('data-layer="outerwear"'));
    expect(a).toMatch(/transform="matrix\(/);
  });
  it("ignores non-garments and invalid colours (no markup injection)", () => {
    const s = outfitSvg([{ category: "lipstick", hex: "#AA0000" }, { category: "top", hex: '"><script>' }], { label: '<b>x</b>' });
    expect(s).not.toContain("data-layer");
    expect(s).not.toContain("<script>");
    expect(s).not.toContain("<b>");
  });
});
