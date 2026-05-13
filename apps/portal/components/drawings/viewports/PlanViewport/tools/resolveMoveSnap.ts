import type { Point2 } from '@sp/geometry';
import type { SnapLineTarget } from '../interactions/snap/snapEngine';
import { polygonEdgeOutwardNormal } from '../canvas/polygonEdgeMath';
import { resolveEdgeSnap, type EdgeSnapResult } from './resolveEdgeSnap';

export type MoveSnapSecondary = {
  /** Index in the source polygon of the edge that snapped second. */
  edgeIndex: number;
  /** Inner edge-snap result; same shape and meaning as the primary `edgeSnap`. */
  edgeSnap: EdgeSnapResult;
};

export type MoveSnapResult = {
  /** Index in the source polygon of the edge whose snap won. */
  edgeIndex: number;
  /**
   * Inner edge-snap result for the winning edge. `target`, `snapDeltaMm`
   * (the perpendicular-along-normal value), and `correctionMm` are
   * preserved verbatim from `resolveEdgeSnap` so consumers can reuse the
   * snap-indicator render path and the attachment-formation logic that
   * already lives off `EdgeSnapResult`.
   */
  edgeSnap: EdgeSnapResult;
  /**
   * Optional corner snap: present when a SECOND, non-parallel target is
   * also in tolerance of a different polygon edge. The two perpendicular
   * corrections combine into a 2D `adjustedDeltaMm` that lands the
   * moving polygon's corresponding corner on `cornerVertex` (the
   * intersection of the two target lines). When absent, the move is
   * single-axis as before.
   */
  secondary?: MoveSnapSecondary | null;
  /**
   * Intersection of the primary target line and the secondary target
   * line in plan-world coords (mm). Present iff `secondary` is set;
   * indicators render a marker here.
   */
  cornerVertex?: Point2 | null;
  /**
   * The 2D delta the move tool should apply, with the snap correction
   * folded in. For single-snap, only the component along the winning
   * edge's outward normal is shifted; the parallel-to-edge component
   * stays at the natural drag value so the user's intent to slide along
   * the snap line is preserved. For corner-snap, BOTH perpendicular
   * corrections are applied, landing the polygon's corner on the
   * intersection of the two target lines.
   */
  adjustedDeltaMm: Point2;
};

/**
 * Default minimum angle between primary and secondary target directions
 * for a pair to count as a "corner" rather than two near-parallel lines.
 * 30° lets non-orthogonal hip-eave intersections register; higher values
 * (toward 90°) only accept strict perpendiculars. Pure-geometric, not
 * UX-tunable per family yet.
 */
const DEFAULT_CORNER_MIN_ANGLE_DEG = 30;

type ResolvedEdgeSnap = {
  edgeIndex: number;
  edgeSnap: EdgeSnapResult;
  /** Cached outward normal of the snapped edge. */
  normal: Point2;
};

/**
 * Find the smallest-correction snap across every polygon edge against the
 * supplied target list. Returns null if no edge has a usable candidate.
 * Used in two passes by `resolveMoveSnap`: first to find the primary
 * snap, then -- with the primary's edge excluded and parallel-to-primary
 * targets filtered out -- to find the secondary corner partner.
 */
function findBestEdgeSnap(input: {
  polygon: ReadonlyArray<Point2>;
  naturalDeltaMm: Point2;
  lineTargets: ReadonlyArray<SnapLineTarget>;
  toleranceMm: number | undefined;
  angularToleranceDeg: number | undefined;
  excludeEdgeIndex?: number;
}): ResolvedEdgeSnap | null {
  let best: ResolvedEdgeSnap | null = null;
  let bestCorrection = Infinity;
  for (let edgeIndex = 0; edgeIndex < input.polygon.length; edgeIndex += 1) {
    if (input.excludeEdgeIndex === edgeIndex) continue;
    const normal = polygonEdgeOutwardNormal(input.polygon, edgeIndex);
    if (!normal) continue;
    const naturalPerpDeltaMm =
      input.naturalDeltaMm.x * normal.x + input.naturalDeltaMm.y * normal.y;
    const edgeStart = input.polygon[edgeIndex]!;
    const edgeEnd = input.polygon[(edgeIndex + 1) % input.polygon.length]!;
    const edgeSnap = resolveEdgeSnap({
      edgeStart,
      edgeEnd,
      outwardNormal: normal,
      naturalDeltaMm: naturalPerpDeltaMm,
      lineTargets: input.lineTargets,
      toleranceMm: input.toleranceMm,
      angularToleranceDeg: input.angularToleranceDeg,
    });
    if (!edgeSnap) continue;
    if (edgeSnap.correctionMm >= bestCorrection) continue;
    bestCorrection = edgeSnap.correctionMm;
    best = { edgeIndex, edgeSnap, normal };
  }
  return best;
}

function unitVec(p: Point2): Point2 | null {
  const length = Math.hypot(p.x, p.y);
  if (length < 1e-6) return null;
  return { x: p.x / length, y: p.y / length };
}

function targetUnitDirection(target: SnapLineTarget): Point2 | null {
  return unitVec({ x: target.end.x - target.start.x, y: target.end.y - target.start.y });
}

/**
 * Two snap targets count as "corner partners" when the angle between
 * their direction vectors is at least `minAngleDeg`. Inverts the
 * parallel check in `resolveEdgeSnap` -- a primary's parallel partners
 * already snapped on the SAME axis and would fight each other if both
 * were applied to perpendicular corrections.
 */
function targetsFormCornerPair(
  primary: SnapLineTarget,
  candidate: SnapLineTarget,
  minAngleDeg: number,
): boolean {
  const dPrimary = targetUnitDirection(primary);
  const dCandidate = targetUnitDirection(candidate);
  if (!dPrimary || !dCandidate) return false;
  // |a x b| for unit vectors = sin(angle). Both directions are
  // unoriented (the segment could be A->B or B->A); take absolute
  // value to ignore orientation.
  const crossMag = Math.abs(dPrimary.x * dCandidate.y - dPrimary.y * dCandidate.x);
  return crossMag >= Math.sin((minAngleDeg * Math.PI) / 180);
}

function lineLineIntersection(
  a1: Point2,
  a2: Point2,
  b1: Point2,
  b2: Point2,
): Point2 | null {
  const dAx = a2.x - a1.x;
  const dAy = a2.y - a1.y;
  const dBx = b2.x - b1.x;
  const dBy = b2.y - b1.y;
  const denom = dAx * dBy - dAy * dBx;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((b1.x - a1.x) * dBy - (b1.y - a1.y) * dBx) / denom;
  return { x: a1.x + t * dAx, y: a1.y + t * dAy };
}

/**
 * Apply a single-axis snap correction to the natural delta -- the
 * existing behaviour when no corner partner is available. Lifts the
 * shared formula so the no-secondary path and the defensive fallback
 * (degenerate normals) read the same.
 */
function applySingleSnapDelta(
  naturalDeltaMm: Point2,
  primary: ResolvedEdgeSnap,
): Point2 {
  const naturalPerpDelta =
    naturalDeltaMm.x * primary.normal.x + naturalDeltaMm.y * primary.normal.y;
  const perpCorrection = primary.edgeSnap.snapDeltaMm - naturalPerpDelta;
  return {
    x: naturalDeltaMm.x + perpCorrection * primary.normal.x,
    y: naturalDeltaMm.y + perpCorrection * primary.normal.y,
  };
}

/**
 * Resolve a snap when an entire polygon is being translated (move tool),
 * not just a single edge being dragged perpendicular (edge-drag tool). The
 * move case is a 2D translation -- any of the polygon's edges could land
 * close to a snap line target.
 *
 * Two-pass:
 *
 * 1. **Primary** -- the smallest-correction snap across all edges. The
 *    existing single-line behaviour: parallel-to-edge motion is
 *    preserved, only the perpendicular component is corrected.
 * 2. **Secondary (corner snap)** -- on a DIFFERENT edge, against a
 *    target whose direction is at least `cornerMinAngleDeg` away from
 *    the primary's. When found, BOTH perpendicular corrections are
 *    applied; the result is a 2D delta that lands the polygon's
 *    corner on the intersection of the two target lines. Equivalent
 *    to solving `[primary_normal; secondary_normal] · Δ = [ps; ss]`
 *    for the 2-vector Δ.
 *
 * Returns null when no edge has a usable snap candidate. v1 is "soft
 * snap": the snap holds while undisturbed and breaks freely on
 * continued drag (the tool re-resolves on every pointermove).
 */
export function resolveMoveSnap(input: {
  /** Polygon vertices in their pre-translation positions (mm world). */
  originalPolygon: ReadonlyArray<Point2>;
  /** Natural drag delta the user has produced via pointer motion (mm). */
  naturalDeltaMm: Point2;
  /** Snap line candidates. Empty list means "no snap"; the caller short-circuits. */
  lineTargets: ReadonlyArray<SnapLineTarget>;
  toleranceMm?: number;
  angularToleranceDeg?: number;
  /**
   * Minimum angle (degrees) between primary and secondary target
   * directions for the pair to qualify as a corner snap. Defaults to
   * 30°. Set higher (toward 90°) to demand strict perpendiculars.
   */
  cornerMinAngleDeg?: number;
}): MoveSnapResult | null {
  if (input.originalPolygon.length < 3) return null;
  if (input.lineTargets.length === 0) return null;

  const cornerMinAngleDeg = input.cornerMinAngleDeg ?? DEFAULT_CORNER_MIN_ANGLE_DEG;

  const primary = findBestEdgeSnap({
    polygon: input.originalPolygon,
    naturalDeltaMm: input.naturalDeltaMm,
    lineTargets: input.lineTargets,
    toleranceMm: input.toleranceMm,
    angularToleranceDeg: input.angularToleranceDeg,
  });
  if (!primary) return null;

  const secondaryTargets = input.lineTargets.filter(
    (target) =>
      target.id !== primary.edgeSnap.target.id &&
      targetsFormCornerPair(primary.edgeSnap.target, target, cornerMinAngleDeg),
  );
  const secondary =
    secondaryTargets.length > 0
      ? findBestEdgeSnap({
          polygon: input.originalPolygon,
          naturalDeltaMm: input.naturalDeltaMm,
          lineTargets: secondaryTargets,
          toleranceMm: input.toleranceMm,
          angularToleranceDeg: input.angularToleranceDeg,
          excludeEdgeIndex: primary.edgeIndex,
        })
      : null;

  if (!secondary) {
    return {
      edgeIndex: primary.edgeIndex,
      edgeSnap: primary.edgeSnap,
      adjustedDeltaMm: applySingleSnapDelta(input.naturalDeltaMm, primary),
    };
  }

  // Corner-snap path: solve the 2x2 system
  //   primary_normal · Δ   = primary_snapDeltaMm
  //   secondary_normal · Δ = secondary_snapDeltaMm
  // for the 2-vector Δ. Geometric meaning: after applying Δ, the
  // primary edge's midpoint sits exactly on the primary target line
  // AND the secondary edge's midpoint sits on the secondary target.
  // The shared corner of those edges lands on the target intersection.
  const a = primary.normal;
  const b = secondary.normal;
  const det = a.x * b.y - a.y * b.x;
  if (Math.abs(det) < 1e-9) {
    // Defensive fallback: target perpendicularity filter should make
    // this impossible (non-parallel targets -> non-parallel edges ->
    // non-parallel normals), but if we ever land here, prefer the
    // primary single-snap over a divide-by-zero.
    return {
      edgeIndex: primary.edgeIndex,
      edgeSnap: primary.edgeSnap,
      adjustedDeltaMm: applySingleSnapDelta(input.naturalDeltaMm, primary),
    };
  }
  const ps = primary.edgeSnap.snapDeltaMm;
  const ss = secondary.edgeSnap.snapDeltaMm;
  const adjustedDeltaMm: Point2 = {
    x: (ps * b.y - ss * a.y) / det,
    y: (ss * a.x - ps * b.x) / det,
  };
  const cornerVertex = lineLineIntersection(
    primary.edgeSnap.target.start,
    primary.edgeSnap.target.end,
    secondary.edgeSnap.target.start,
    secondary.edgeSnap.target.end,
  );
  return {
    edgeIndex: primary.edgeIndex,
    edgeSnap: primary.edgeSnap,
    secondary: {
      edgeIndex: secondary.edgeIndex,
      edgeSnap: secondary.edgeSnap,
    },
    cornerVertex,
    adjustedDeltaMm,
  };
}
