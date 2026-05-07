import type { Point2 } from '@sp/geometry';
import type { SnapLineTarget } from '../interactions/snap/snapEngine';

export type EdgeSnapResult = {
  /** The line target the edge snapped to. */
  target: SnapLineTarget;
  /** The corrected delta — replaces the natural drag delta when committed. */
  snapDeltaMm: number;
  /** How far the edge moved from its natural drag position to the snap position. Always non-negative. */
  correctionMm: number;
};

const DEFAULT_SNAP_TOLERANCE_MM = 250;
const DEFAULT_SNAP_ANGULAR_TOLERANCE_DEG = 5;

function unitVector(p: Point2): { x: number; y: number; lengthMm: number } | null {
  const lengthMm = Math.hypot(p.x, p.y);
  if (lengthMm < 1e-6) return null;
  return { x: p.x / lengthMm, y: p.y / lengthMm, lengthMm };
}

function isParallel(
  edgeDir: { x: number; y: number },
  targetDir: { x: number; y: number },
  angularToleranceDeg: number,
): boolean {
  // Two unit vectors are parallel when their cross product magnitude is 0.
  // sin(theta) = |edgeDir × targetDir| for unit vectors, so the angle
  // between them is asin(crossMag). Compare against the tolerance directly
  // in sin space — sin(5°) ≈ 0.087, fine resolution at small angles.
  const crossMag = Math.abs(edgeDir.x * targetDir.y - edgeDir.y * targetDir.x);
  const sinTolerance = Math.sin((angularToleranceDeg * Math.PI) / 180);
  return crossMag <= sinTolerance;
}

/**
 * Resolve a snap from a perpendicularly-dragged edge to a list of line targets
 * (roof eaves, wall edges, etc.). The dragged edge moves along a fixed
 * outward normal — we look for a parallel line target that, with a small
 * correction to `naturalDeltaMm`, the edge's midpoint would land on.
 *
 * Returns the closest snap correction within `toleranceMm`, or null if no
 * candidate is parallel and within range. v1 is "soft snap": the snap holds
 * while undisturbed and breaks freely on the next drag (the tool drops the
 * snap state on each `onPointerMove`).
 *
 * Step 7b.2 of the first-class spatial-entities migration. Used by
 * `EdgeDragTool`; tested in isolation here so the snap math doesn't have to
 * round-trip through the tool's pointer state.
 */
export function resolveEdgeSnap(input: {
  edgeStart: Point2;
  edgeEnd: Point2;
  outwardNormal: Point2;
  naturalDeltaMm: number;
  lineTargets: ReadonlyArray<SnapLineTarget>;
  toleranceMm?: number;
  angularToleranceDeg?: number;
}): EdgeSnapResult | null {
  const toleranceMm = input.toleranceMm ?? DEFAULT_SNAP_TOLERANCE_MM;
  const angularToleranceDeg = input.angularToleranceDeg ?? DEFAULT_SNAP_ANGULAR_TOLERANCE_DEG;

  const edgeVector = { x: input.edgeEnd.x - input.edgeStart.x, y: input.edgeEnd.y - input.edgeStart.y };
  const edgeDir = unitVector(edgeVector);
  if (!edgeDir) return null;

  const originalMidpoint = {
    x: (input.edgeStart.x + input.edgeEnd.x) / 2,
    y: (input.edgeStart.y + input.edgeEnd.y) / 2,
  };

  let best: EdgeSnapResult | null = null;
  let bestCorrection = Infinity;

  for (const target of input.lineTargets) {
    const targetVector = { x: target.end.x - target.start.x, y: target.end.y - target.start.y };
    const targetDir = unitVector(targetVector);
    if (!targetDir) continue;
    if (!isParallel(edgeDir, targetDir, angularToleranceDeg)) continue;

    // Signed perpendicular distance from `originalMidpoint` to the target line,
    // measured along the edge's outward normal. If we set `deltaMm` to this
    // value, the dragged edge's midpoint lands exactly on the target line.
    const targetDistance =
      (target.start.x - originalMidpoint.x) * input.outwardNormal.x +
      (target.start.y - originalMidpoint.y) * input.outwardNormal.y;
    const correctionMm = Math.abs(targetDistance - input.naturalDeltaMm);
    if (correctionMm > toleranceMm) continue;
    if (correctionMm < bestCorrection) {
      bestCorrection = correctionMm;
      best = {
        target,
        snapDeltaMm: targetDistance,
        correctionMm,
      };
    }
  }

  return best;
}
