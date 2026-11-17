import { BUILTIN_ASSETS, GARMENT_ASSET, type BuiltinAsset } from "@glamotion/motion";

/**
 * On-device clothes mirror geometry. MediaPipe Pose Landmarker (33 points)
 * gives shoulders/hips; a 3-point affine maps a garment template's anchor
 * points (shoulder seams + mid-hip) onto the body. Pure functions: no I/O,
 * deterministic, testable in Node. This is a 2D overlay — it does not model
 * cloth, folds or arm occlusion (see ADR-010).
 */
export const POSE = { NOSE: 0, L_SHOULDER: 11, R_SHOULDER: 12, L_HIP: 23, R_HIP: 24 } as const;
export interface PosePoint { x: number; y: number; visibility?: number }
export type Pose = ReadonlyArray<PosePoint | undefined> | Readonly<Record<number, PosePoint>>;
export type Affine = [number, number, number, number, number, number]; // canvas setTransform(a,b,c,d,e,f)
type P = { x: number; y: number };

const pt = (pose: Pose, i: number) => (pose as Record<number, PosePoint | undefined>)[i];
const visible = (p: PosePoint | undefined, min = 0.5): p is PosePoint => !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 1) >= min;

export function garmentAsset(category: string): BuiltinAsset | null {
  const id = GARMENT_ASSET[category as keyof typeof GARMENT_ASSET];
  return id ? BUILTIN_ASSETS[id] ?? null : null;
}

/** Solve the affine transform that maps three source points onto three destination points. */
export function solveAffine(src: [P, P, P], dst: [P, P, P]): Affine {
  const [s0, s1, s2] = src;
  const det = s0.x * (s1.y - s2.y) - s0.y * (s1.x - s2.x) + (s1.x * s2.y - s2.x * s1.y);
  if (Math.abs(det) < 1e-9) throw new Error("Degenerate anchor points");
  const solve = (v0: number, v1: number, v2: number) => {
    const m = (v0 * (s1.y - s2.y) - s0.y * (v1 - v2) + (v1 * s2.y - v2 * s1.y)) / det; // coefficient on x
    const n = (s0.x * (v1 - v2) - v0 * (s1.x - s2.x) + (s1.x * v2 - s2.x * v1)) / det; // coefficient on y
    const k = (s0.x * (s1.y * v2 - s2.y * v1) - s0.y * (s1.x * v2 - s2.x * v1) + v0 * (s1.x * s2.y - s2.x * s1.y)) / det;
    return [m, n, k] as const;
  };
  const [a, c, e] = solve(dst[0].x, dst[1].x, dst[2].x);
  const [b, d, f] = solve(dst[0].y, dst[1].y, dst[2].y);
  return [a, b, c, d, e, f];
}

export const applyAffine = (m: Affine, p: P): P => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] });

/**
 * Body anchor points in pixels. The image-left shoulder is chosen by x
 * position, so mirrored (selfie) and unmirrored inputs both work. When hips
 * are out of frame (typical webcam), mid-hip is estimated from shoulder
 * width along the torso direction.
 */
export function bodyAnchors(pose: Pose, width: number, height: number) {
  const a = pt(pose, POSE.L_SHOULDER), b = pt(pose, POSE.R_SHOULDER);
  if (!visible(a) || !visible(b)) return null;
  const [left, right] = (a.x <= b.x ? [a, b] : [b, a]).map((p) => ({ x: p.x * width, y: p.y * height })) as [P, P];
  const sw = Math.hypot(right.x - left.x, right.y - left.y);
  const mid = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
  const h1 = pt(pose, POSE.L_HIP), h2 = pt(pose, POSE.R_HIP);
  let hip: P, estimatedHip = false;
  if (visible(h1, 0.4) && visible(h2, 0.4)) {
    hip = { x: ((h1.x + h2.x) / 2) * width, y: ((h1.y + h2.y) / 2) * height };
  } else {
    // Perpendicular to the shoulder line, pointing down the torso.
    const ux = (right.x - left.x) / sw, uy = (right.y - left.y) / sw;
    const nx = -uy, ny = ux;
    const dir = ny >= 0 ? 1 : -1;
    hip = { x: mid.x + dir * nx * sw * 1.45, y: mid.y + dir * ny * sw * 1.45 };
    estimatedHip = true;
  }
  return { left, right, hip, shoulderWidth: sw, estimatedHip };
}

export interface GarmentFit { fitScale?: number; offsetY?: number }

/** Canvas transform that draws a garment template (in its viewBox units) onto the body. */
export function garmentTransform(asset: BuiltinAsset, pose: Pose, width: number, height: number, fit: GarmentFit = {}): Affine | null {
  if (!asset.anchors) return null;
  const body = bodyAnchors(pose, width, height);
  if (!body) return null;
  const s = fit.fitScale ?? 1;
  const mid = { x: (body.left.x + body.right.x) / 2, y: (body.left.y + body.right.y) / 2 };
  const torso = { x: body.hip.x - mid.x, y: body.hip.y - mid.y };
  const shift = { x: torso.x * (fit.offsetY ?? 0), y: torso.y * (fit.offsetY ?? 0) };
  const widen = (p: P): P => ({ x: mid.x + (p.x - mid.x) * s + shift.x, y: mid.y + (p.y - mid.y) * s + shift.y });
  const { left, right, hip } = asset.anchors;
  return solveAffine(
    [{ x: left[0], y: left[1] }, { x: right[0], y: right[1] }, { x: hip[0], y: hip[1] }],
    [widen(body.left), widen(body.right), { x: body.hip.x + shift.x, y: body.hip.y + shift.y }],
  );
}

export type PoseIssue = "NO_PERSON" | "MULTIPLE_PEOPLE" | "SHOULDERS_NOT_VISIBLE" | "PERSON_TOO_SMALL";
export const POSE_ISSUE_MESSAGES: Record<PoseIssue, string> = {
  NO_PERSON: "We couldn't find a person. Use a photo showing your head and shoulders, facing the camera.",
  MULTIPLE_PEOPLE: "More than one person is in view. Please use a single-person photo.",
  SHOULDERS_NOT_VISIBLE: "Both shoulders need to be visible. Step back a little and face the camera.",
  PERSON_TOO_SMALL: "Move closer — the person is too small for a useful preview.",
};

/** P0 policy mirrors makeup: exactly one person with both shoulders visible. */
export function assessPoses(poses: Pose[]): { ok: boolean; blocking: PoseIssue | null; estimatedHip: boolean } {
  if (poses.length === 0) return { ok: false, blocking: "NO_PERSON", estimatedHip: false };
  if (poses.length > 1) return { ok: false, blocking: "MULTIPLE_PEOPLE", estimatedHip: false };
  const b = bodyAnchors(poses[0]!, 1, 1);
  if (!b) return { ok: false, blocking: "SHOULDERS_NOT_VISIBLE", estimatedHip: false };
  if (b.shoulderWidth < 0.12) return { ok: false, blocking: "PERSON_TOO_SMALL", estimatedHip: b.estimatedHip };
  return { ok: true, blocking: null, estimatedHip: b.estimatedHip };
}
