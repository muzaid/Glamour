import { MotionComposition } from "@glamotion/contracts";
import { BUILTIN_ASSETS } from "./assets";
import { totalFrames } from "./render-svg";
import { SAFE_AREA } from "./aspect";

export interface PreflightLimits { maxFrames: number; maxPixels: number; maxElements: number; maxTextChars: number }
export const DEFAULT_LIMITS: PreflightLimits = { maxFrames: 30 * 60, maxPixels: 1920 * 1920, maxElements: 200, maxTextChars: 4000 };

export interface PreflightIssue { level: "error" | "warning"; code: string; message: string; elementId?: string }

/**
 * Validates a composition before it can be queued: schema, caps, asset
 * allowlist (no remote URLs), licensing, text sanity and safe-area warnings.
 */
export function preflight(raw: unknown, limits: PreflightLimits = DEFAULT_LIMITS) {
  const issues: PreflightIssue[] = [];
  const parsed = MotionComposition.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, issues: [{ level: "error" as const, code: "SCHEMA", message: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }], frames: 0, seconds: 0 };
  }
  const c = parsed.data;
  const frames = totalFrames(c);
  if (frames > limits.maxFrames) issues.push({ level: "error", code: "TOO_LONG", message: `Composition has ${frames} frames (max ${limits.maxFrames})` });
  if (c.width * c.height > limits.maxPixels) issues.push({ level: "error", code: "TOO_LARGE", message: "Output dimensions exceed the render cap" });
  let elements = 0, chars = 0;
  const safe = SAFE_AREA[c.aspectRatio];
  for (const s of c.scenes) {
    for (const e of s.elements) {
      elements++;
      if (e.endFrame <= e.startFrame) issues.push({ level: "error", code: "TIMING", message: "Element ends before it starts", elementId: e.layer.id });
      if (e.layer.type === "image" && !BUILTIN_ASSETS[e.layer.assetId]) {
        issues.push({ level: "error", code: "ASSET_NOT_ALLOWED", message: `Asset ${e.layer.assetId} is not an approved internal asset`, elementId: e.layer.id });
      }
      if (e.layer.type === "text") {
        chars += e.layer.text.length;
        const t = e.layer.transform;
        if (t.y < c.height * safe.top - 1 || t.y + t.h > c.height * (1 - safe.bottom) + 1) {
          issues.push({ level: "warning", code: "SAFE_AREA", message: `Text "${e.layer.text.slice(0, 24)}" crosses the platform safe area`, elementId: e.layer.id });
        }
      }
    }
  }
  if (elements > limits.maxElements) issues.push({ level: "error", code: "TOO_MANY_ELEMENTS", message: "Too many elements" });
  if (chars > limits.maxTextChars) issues.push({ level: "error", code: "TOO_MUCH_TEXT", message: "Too much text" });
  return { ok: !issues.some((i) => i.level === "error"), issues, frames, seconds: frames / c.fps, composition: c };
}
