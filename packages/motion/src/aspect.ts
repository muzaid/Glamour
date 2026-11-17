import type { AspectRatio } from "@glamotion/contracts";

export const ASPECT_SIZES: Record<AspectRatio, { width: number; height: number }> = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
};

/** Platform UI safe area (fractions of each edge) — titles must stay inside. */
export const SAFE_AREA: Record<AspectRatio, { top: number; bottom: number; left: number; right: number }> = {
  "1:1": { top: 0.06, bottom: 0.06, left: 0.06, right: 0.06 },
  "4:5": { top: 0.06, bottom: 0.08, left: 0.06, right: 0.06 },
  "9:16": { top: 0.12, bottom: 0.2, left: 0.06, right: 0.14 },
  "16:9": { top: 0.06, bottom: 0.1, left: 0.06, right: 0.06 },
};
