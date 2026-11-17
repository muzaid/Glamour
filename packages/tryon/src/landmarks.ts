/**
 * MediaPipe Face Landmarker (478-point mesh) indices used by the overlay
 * engine. Orders follow the canonical mesh contours. "L"/"R" here mean IMAGE
 * left/right (not the subject's).
 */
export interface Point { x: number; y: number }
/** Normalised [0,1] image coordinates, indexed by mesh index. */
export type Landmarks = ReadonlyArray<Point | undefined> | Readonly<Record<number, Point>>;

export const LIPS_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185] as const;
export const LIPS_INNER = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191] as const;
export const EYE_L_UPPER = [33, 246, 161, 160, 159, 158, 157, 173, 133] as const;
export const EYE_L_BROW = [46, 53, 52, 65, 55] as const;
export const EYE_R_UPPER = [263, 466, 388, 387, 386, 385, 384, 398, 362] as const;
export const EYE_R_BROW = [276, 283, 282, 295, 285] as const;
export const CHEEK_L = 50;
export const CHEEK_R = 280;
export const FACE_EDGE_L = 234;
export const FACE_EDGE_R = 454;
export const FOREHEAD = 10;
export const CHIN = 152;

export const REQUIRED_INDICES: readonly number[] = [
  ...LIPS_OUTER, ...LIPS_INNER, ...EYE_L_UPPER, ...EYE_L_BROW, ...EYE_R_UPPER, ...EYE_R_BROW, CHEEK_L, CHEEK_R, FACE_EDGE_L, FACE_EDGE_R, FOREHEAD, CHIN,
];

export function lm(l: Landmarks, i: number): Point {
  const p = (l as Record<number, Point | undefined>)[i];
  if (!p) throw new Error(`Missing landmark ${i}`);
  return p;
}

export function hasRequired(l: Landmarks): boolean {
  return REQUIRED_INDICES.every((i) => {
    const p = (l as Record<number, Point | undefined>)[i];
    return !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  });
}
