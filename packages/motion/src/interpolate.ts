import type { Easing, Keyframe, Track, AnimatableProperty } from "@glamotion/contracts";

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Cubic bezier solver (same curve family as CSS). */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x;
      const d = dx(t);
      if (Math.abs(err) < 1e-6 || Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    return sy(clamp01(t));
  };
}

export const EASINGS: Record<Easing, (t: number) => number> = {
  linear: (t) => t,
  easeIn: bezier(0.42, 0, 1, 1),
  easeOut: bezier(0, 0, 0.58, 1),
  easeInOut: bezier(0.42, 0, 0.58, 1),
  /** Brand curve: slow, confident settle. */
  luxe: bezier(0.16, 1, 0.3, 1),
};

export const PROPERTY_DEFAULTS: Record<AnimatableProperty, number> = { x: 0, y: 0, opacity: 1, rotation: 0, scale: 1, blur: 0 };

/**
 * Frame-accurate value at an integer frame. Easing of a segment is taken from
 * the destination keyframe. Before the first / after the last keyframe the
 * value holds.
 */
export function valueAt(keyframes: readonly Keyframe[], frame: number): number {
  const kfs = [...keyframes].sort((a, b) => a.frame - b.frame);
  const first = kfs[0]!;
  if (frame <= first.frame) return first.value;
  for (let i = 1; i < kfs.length; i++) {
    const a = kfs[i - 1]!, b = kfs[i]!;
    if (frame <= b.frame) {
      const span = b.frame - a.frame;
      const t = span === 0 ? 1 : (frame - a.frame) / span;
      return a.value + (b.value - a.value) * EASINGS[b.easing](clamp01(t));
    }
  }
  return kfs[kfs.length - 1]!.value;
}

export function trackValue(tracks: readonly Track[], property: AnimatableProperty, frame: number): number {
  const t = tracks.find((x) => x.property === property);
  return t ? valueAt(t.keyframes, frame) : PROPERTY_DEFAULTS[property];
}
