import type {
  OrthogonalPolygon,
  OrthogonalPolygonValidationResult,
} from "./types";

/**
 * PR-SS-2 (2026-06-19): validate an orthogonal polygon for
 * `computeOrthogonalStraightSkeleton` input. Closed-form checks; no
 * floating point; no repair attempts.
 *
 * Rules enforced (in order — first violation wins):
 *
 *  1. At least 4 vertices (the simplest orthogonal polygon is a
 *     rectangle).
 *  2. All coordinates are integers (Number.isInteger). The skeleton
 *     algorithm assumes integer-mm precision; the caller is
 *     responsible for snapping floats before validating.
 *  3. Every edge is horizontal or vertical (one of deltaX / deltaY
 *     is zero, the other is non-zero).
 *  4. Consecutive edges alternate axes (no two consecutive
 *     horizontals, no two consecutive verticals). This rejects
 *     polygons with redundant collinear vertices that should have
 *     been removed by `cleanPolygon`.
 *  5. Every edge has non-zero length.
 *  6. Winding is counter-clockwise (signed area > 0). The
 *     skeleton algorithm assumes CCW convention.
 *  7. No self-intersection (deferred — see note below).
 *
 * Self-intersection check is intentionally NOT yet implemented:
 * the composition union polygon is non-self-intersecting by
 * construction (rectangles + joins produce simple polygons). If
 * future input sources need this check, add it here behind the
 * `self_intersecting_polygon` error code.
 */
export function validateOrthogonalPolygon(
  polygon: OrthogonalPolygon,
): OrthogonalPolygonValidationResult {
  if (polygon.length < 4) {
    return {
      ok: false,
      error: { code: "too_few_vertices", vertexCount: polygon.length },
    };
  }

  for (let i = 0; i < polygon.length; i += 1) {
    const v = polygon[i]!;
    if (!Number.isInteger(v.x)) {
      return {
        ok: false,
        error: {
          code: "non_integer_coordinate",
          vertexIndex: i,
          coordinate: "x",
          value: v.x,
        },
      };
    }
    if (!Number.isInteger(v.y)) {
      return {
        ok: false,
        error: {
          code: "non_integer_coordinate",
          vertexIndex: i,
          coordinate: "y",
          value: v.y,
        },
      };
    }
  }

  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx === 0 && dy === 0) {
      return { ok: false, error: { code: "zero_length_edge", edgeIndex: i } };
    }
    if (dx !== 0 && dy !== 0) {
      return {
        ok: false,
        error: {
          code: "non_orthogonal_edge",
          edgeIndex: i,
          deltaX: dx,
          deltaY: dy,
        },
      };
    }
  }

  for (let i = 0; i < polygon.length; i += 1) {
    const aIdx = i;
    const bIdx = (i + 1) % polygon.length;
    const a = polygon[aIdx]!;
    const b = polygon[bIdx]!;
    const c = polygon[(bIdx + 1) % polygon.length]!;
    const dy1 = b.y - a.y;
    const dy2 = c.y - b.y;
    const edge1Horizontal = dy1 === 0;
    const edge2Horizontal = dy2 === 0;
    if (edge1Horizontal === edge2Horizontal) {
      return {
        ok: false,
        error: { code: "consecutive_collinear_edges", edgeIndex: aIdx },
      };
    }
  }

  let signedAreaTimes2 = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    signedAreaTimes2 += a.x * b.y - b.x * a.y;
  }
  if (signedAreaTimes2 <= 0) {
    return {
      ok: false,
      error: { code: "not_counter_clockwise", signedArea: signedAreaTimes2 / 2 },
    };
  }

  return { ok: true };
}
