import type { Polygon3 } from "../../contracts";

/**
 * PR-COMP1 (2026-06-18): detect whether a composed footprint
 * polygon is itself a single axis-aligned rectangle.
 *
 * Used by `composeRoofFromComposition` to route to the simple
 * `buildRectangularRoof` path when N joined rectangles happen to
 * union into a clean rectangle (e.g. two 6m×4m rectangles snapped
 * on a long edge → a 12m×4m rectangle, which deserves one
 * continuous hipped roof, not two halves with a phantom valley).
 *
 * Returns `{ fused: true, ...dimensions }` when the polygon has
 * exactly 4 right-angle corners and orthogonal edges. Returns
 * `{ fused: false }` otherwise (L, T, U, cross, etc.) — the
 * composition needs the per-rectangle + valleys path.
 *
 * Trusts the input polygon to be CCW, orthogonal, and
 * collinear-cleaned (as produced by `composeFootprintFromComposition`).
 */
type FusedRectangleDetection =
  | {
      fused: true;
      originXMm: number;
      originYMm: number;
      widthMm: number;
      depthMm: number;
    }
  | { fused: false };

export function detectFusedRectangle(polygon: Polygon3): FusedRectangleDetection {
  if (polygon.length !== 4) return { fused: false };

  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  if (maxX - minX <= 0 || maxY - minY <= 0) return { fused: false };

  // All 4 polygon points must lie on the corners of the bounding
  // box (i.e., each coordinate is either at min or max along its
  // axis). This excludes 4-vertex polygons that happen to be
  // axis-aligned but aren't rectangles (impossible for a properly
  // CCW orthogonal 4-vertex polygon, but we check defensively).
  for (const point of polygon) {
    const onX = point.x === minX || point.x === maxX;
    const onY = point.y === minY || point.y === maxY;
    if (!onX || !onY) return { fused: false };
  }
  // Exactly one corner at each combination of {minX|maxX, minY|maxY}.
  const seen = new Set<string>();
  for (const point of polygon) {
    seen.add(`${point.x === minX ? "L" : "R"}${point.y === minY ? "B" : "T"}`);
  }
  if (seen.size !== 4) return { fused: false };

  return {
    fused: true,
    originXMm: minX,
    originYMm: minY,
    widthMm: maxX - minX,
    depthMm: maxY - minY,
  };
}
