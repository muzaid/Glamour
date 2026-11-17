import type { MotionComposition } from "@glamotion/contracts";
import { MotionComposition as Schema } from "@glamotion/contracts";
import { preflight, totalFrames } from "@glamotion/motion";
import { FrameRasterizer } from "./rasterizer";
import { startEncoder } from "./encoder";

export const LIMITS = { maxFrames: 1800, maxSeconds: 120, previewMaxHeight: 960, finalMaxHeight: 1920 };

export class RenderCancelled extends Error {}

/** Renders a validated composition to WebM bytes with hard frame/time caps. */
export async function renderComposition(raw: unknown, quality: "preview" | "final", raster: FrameRasterizer, onProgress: (p: number) => Promise<boolean>): Promise<{ bytes: Buffer; seconds: number; frames: number }> {
  const doc: MotionComposition = Schema.parse(raw);
  const pf = preflight(doc);
  if (!pf.ok) throw new Error(`Preflight failed: ${pf.issues.filter((i) => i.level === "error").map((i) => i.code).join(",")}`);
  const frames = totalFrames(doc);
  if (frames > LIMITS.maxFrames) throw new Error("Frame cap exceeded");
  const maxH = quality === "final" ? LIMITS.finalMaxHeight : LIMITS.previewMaxHeight;
  const scale = Math.min(1, maxH / doc.height);
  const width = Math.round(doc.width * scale / 2) * 2, height = Math.round(doc.height * scale / 2) * 2; // even dims for yuv420p
  await raster.open(width, height);
  const enc = startEncoder(doc.fps, LIMITS.maxSeconds * 1000);
  try {
    for (let f = 0; f < frames; f++) {
      await enc.write(await raster.frame(doc, f, scale));
      if (f % 15 === 0 || f === frames - 1) {
        const keepGoing = await onProgress((f + 1) / frames);
        if (!keepGoing) { enc.kill(); throw new RenderCancelled("cancelled"); }
      }
    }
    const bytes = await enc.finish();
    return { bytes, seconds: frames / doc.fps, frames };
  } catch (e) {
    enc.kill();
    throw e;
  }
}
