import { describe, expect, it, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { buildPreset } from "@glamotion/motion";
import { encoderArgs, ffmpegPath } from "./encoder";
import { FrameRasterizer } from "./rasterizer";
import { renderComposition } from "./render";

const hasBrowser = existsSync("/opt/pw-browsers") || !!process.env.CHROMIUM_PATH;
const doc = buildPreset("lipstick-swipe", { id: "t", title: "T", brandName: "Demo", productTitle: "Velvet", aspectRatio: "1:1", shades: [{ productVariantId: "11111111-1111-4111-8111-111111111111", name: "Rosewood", hex: "#9E4B5A" }] });

describe("encoder", () => {
  it("uses an argv array with no shell metacharacters", () => {
    const args = encoderArgs(30);
    expect(args.join(" ")).not.toMatch(/[;&|`$]/);
    expect(() => encoderArgs(31)).toThrow();
  });
});

describe.skipIf(!hasBrowser)("render pipeline (headless Chromium + ffmpeg)", () => {
  const raster = new FrameRasterizer();
  afterAll(() => raster.close());
  it("rasterises deterministically (same frame → identical bytes)", async () => {
    await raster.open(270, 270);
    const a = await raster.frame(doc, 12, 0.25), b = await raster.frame(doc, 12, 0.25);
    expect(createHash("sha256").update(a).digest("hex")).toBe(createHash("sha256").update(b).digest("hex"));
  }, 60_000);
  it("produces a WebM file and supports cancel", async () => {
    const short = structuredClone(doc); short.scenes[0]!.durationInFrames = 20;
    const out = await renderComposition(short, "preview", raster, async () => true);
    expect(out.bytes.subarray(0, 4).toString("hex")).toBe("1a45dfa3");
    expect(out.frames).toBe(20);
    await expect(renderComposition(short, "preview", raster, async () => false)).rejects.toThrow(/cancelled/);
    expect(ffmpegPath()).toBeTruthy();
  }, 120_000);
});
