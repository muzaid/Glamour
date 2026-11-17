import { hasRequired, FACE_EDGE_L, FACE_EDGE_R, FOREHEAD, CHIN, lm, type Landmarks } from "./landmarks";
import type { PixelBuffer } from "./composite";
import { luminance } from "./color";

export type TryOnIssue =
  | "NO_FACE" | "MULTIPLE_FACES" | "FACE_TOO_SMALL" | "LOW_CONFIDENCE" | "LOW_LIGHT" | "STRONG_ROTATION" | "LANDMARKS_UNSTABLE";

export const ISSUE_MESSAGES: Record<TryOnIssue, string> = {
  NO_FACE: "We couldn't find a face. Try a well-lit, front-facing photo.",
  MULTIPLE_FACES: "More than one person is in view. Please choose a single-person image.",
  FACE_TOO_SMALL: "Move closer — the face is too small for an accurate preview.",
  LOW_CONFIDENCE: "The preview isn't confident about this photo. Try a clearer, front-facing image.",
  LOW_LIGHT: "It's quite dark. More even light will improve the preview.",
  STRONG_ROTATION: "Turn to face the camera for the best preview.",
  LANDMARKS_UNSTABLE: "Hold still for a moment — the preview is stabilising.",
};

/** P0 policy: exactly one face; otherwise ask for a single-person image rather than risk wrong overlays. */
export function assessDetection(faces: Landmarks[], image?: PixelBuffer): { ok: boolean; blocking: TryOnIssue | null; warnings: TryOnIssue[] } {
  if (faces.length === 0) return { ok: false, blocking: "NO_FACE", warnings: [] };
  if (faces.length > 1) return { ok: false, blocking: "MULTIPLE_FACES", warnings: [] };
  const f = faces[0]!;
  if (!hasRequired(f)) return { ok: false, blocking: "LOW_CONFIDENCE", warnings: [] };
  const a = lm(f, FACE_EDGE_L), b = lm(f, FACE_EDGE_R), top = lm(f, FOREHEAD), chin = lm(f, CHIN);
  const width = Math.hypot(a.x - b.x, a.y - b.y);
  if (width < 0.12) return { ok: false, blocking: "FACE_TOO_SMALL", warnings: [] };
  const warnings: TryOnIssue[] = [];
  const roll = Math.abs((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
  const midX = (a.x + b.x) / 2;
  const yawProxy = Math.abs((top.x + chin.x) / 2 - midX) / width;
  if (roll > 25 || yawProxy > 0.18) warnings.push("STRONG_ROTATION");
  if (image) {
    let sum = 0, n = 0;
    const x0 = Math.floor(Math.min(a.x, b.x) * image.width), x1 = Math.ceil(Math.max(a.x, b.x) * image.width);
    const y0 = Math.floor(top.y * image.height), y1 = Math.ceil(chin.y * image.height);
    for (let y = Math.max(0, y0); y < Math.min(image.height, y1); y += 4) for (let x = Math.max(0, x0); x < Math.min(image.width, x1); x += 4) {
      const i = (y * image.width + x) * 4; sum += luminance(image.data[i]!, image.data[i + 1]!, image.data[i + 2]!); n++;
    }
    if (n > 0 && sum / n < 55) warnings.push("LOW_LIGHT");
  }
  return { ok: true, blocking: null, warnings };
}

/** Mean landmark displacement between frames (normalised); used to gate overlay updates in live mode. */
export function landmarkJitter(a: Landmarks, b: Landmarks, indices: readonly number[]): number {
  let s = 0;
  for (const i of indices) { const p = lm(a, i), q = lm(b, i); s += Math.hypot(p.x - q.x, p.y - q.y); }
  return s / indices.length;
}

export const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
export const MAX_PROCESS_DIMENSION = 1280;

export function validateUpload(file: { type: string; size: number }): string | null {
  if (!(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.type)) return "Please choose a JPEG, PNG or WebP photo.";
  if (file.size > MAX_UPLOAD_BYTES) return "That photo is larger than 12 MB.";
  if (file.size === 0) return "That file is empty.";
  return null;
}
