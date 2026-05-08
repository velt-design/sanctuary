import type { Point2 } from '@sp/geometry';
import type { SnapLineTarget } from '../interactions/snap/snapEngine';
import { polygonEdgeOutwardNormal } from '../canvas/polygonEdgeMath';
import { resolveEdgeSnap, type EdgeSnapResult } from './resolveEdgeSnap';

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
   * The 2D delta the move tool should apply, with the snap correction
   * folded in. Only the component along the winning edge's outward normal
   * is shifted; the parallel-to-edge component stays at the natural drag
   * value, so the user's intent to slide along the snap line is preserved.
   */
  adjustedDeltaMm: Point2;
};

/**
 * Resolve a snap when an entire polygon is being translated (move tool),
 * not just a single edge being dragged perpendicular (edge-drag tool). The
 * move case is a 2D translation -- any of the polygon's edges could land
 * close to a snap line target, and the snap "wins" at most for one edge
 * (the one with the smallest correction).
 *
 * Reuses `resolveEdgeSnap` once per edge: for each edge we compute its
 * outward normal, project the natural translation delta onto that normal,
 * and ask the edge-snap resolver whether a parallel target sits within
 * tolerance. The best (smallest-correction) snap across all edges is
 * applied to the translation -- modifying ONLY the component along the
 * winning edge's normal so the user's parallel-to-edge motion is
 * preserved.
 *
 * Returns null when no edge has a usable snap candidate, in which case
 * the caller should apply the natural delta unchanged. v1 is "soft snap":
 * the snap holds while undisturbed and breaks freely on continued drag
 * (the tool re-resolves on every pointermove). Same UX as edge-drag.
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
}): MoveSnapResult | null {
  if (input.originalPolygon.length < 3) return null;
  if (input.lineTargets.length === 0) return null;

  let best: MoveSnapResult | null = null;
  let bestCorrection = Infinity;

  for (let edgeIndex = 0; edgeIndex < input.originalPolygon.length; edgeIndex += 1) {
    const normal = polygonEdgeOutwardNormal(input.originalPolygon, edgeIndex);
    if (!normal) continue;

    // The amount this edge has moved along its outward normal under the
    // current natural translation. resolveEdgeSnap expects this as
    // `naturalDeltaMm` -- it then searches for a parallel target line
    // that's within tolerance of (edgeMidpoint + normal * naturalDelta).
    const naturalPerpDeltaMm =
      input.naturalDeltaMm.x * normal.x + input.naturalDeltaMm.y * normal.y;

    const edgeStart = input.originalPolygon[edgeIndex]!;
    const edgeEnd = input.originalPolygon[(edgeIndex + 1) % input.originalPolygon.length]!;

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

    // The correction modifies ONLY the perpendicular component. We add
    // (snapDeltaMm - naturalPerpDeltaMm) along the normal to the natural
    // 2D delta. The parallel-to-edge component is untouched -- so a deck
    // dragged diagonally along a wall snaps perpendicular-to-wall while
    // still moving freely along the wall.
    const perpCorrection = edgeSnap.snapDeltaMm - naturalPerpDeltaMm;
    const adjustedDeltaMm: Point2 = {
      x: input.naturalDeltaMm.x + perpCorrection * normal.x,
      y: input.naturalDeltaMm.y + perpCorrection * normal.y,
    };

    bestCorrection = edgeSnap.correctionMm;
    best = { edgeIndex, edgeSnap, adjustedDeltaMm };
  }

  return best;
}
