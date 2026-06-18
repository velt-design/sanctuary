import {
  isAxisAlignedRectangle,
  type AxisAlignedRectangle,
  type CompositionEdge,
  type CompositionJoin,
  type CompositionValidationResult,
  type HouseComposition,
} from "./types";

/**
 * Minimum overlap (mm) for a join's two edges to count as joined.
 * Anything less than this and the join is rejected — it's almost
 * certainly a snap that didn't fully close.
 */
const JOIN_OVERLAP_MIN_MM = 1;

/**
 * Minimum interior overlap (mm²) for two primitives to be flagged
 * as overlapping. Tolerates floating-point noise at shared edges
 * (where two primitives can legitimately touch but not overlap).
 */
const INTERIOR_OVERLAP_MIN_MM2 = 1;

type EdgeSegment = {
  axis: "x" | "y";
  /** Coordinate orthogonal to the segment direction (the shared coordinate). */
  axisCoordinate: number;
  /** Range along the segment direction. */
  rangeMin: number;
  rangeMax: number;
};

function rectangleEdge(
  rectangle: AxisAlignedRectangle,
  edge: CompositionEdge,
): EdgeSegment {
  const x0 = rectangle.originXMm;
  const x1 = rectangle.originXMm + rectangle.widthMm;
  const y0 = rectangle.originYMm;
  const y1 = rectangle.originYMm + rectangle.depthMm;
  switch (edge) {
    case "south":
      return { axis: "x", axisCoordinate: y0, rangeMin: x0, rangeMax: x1 };
    case "north":
      return { axis: "x", axisCoordinate: y1, rangeMin: x0, rangeMax: x1 };
    case "west":
      return { axis: "y", axisCoordinate: x0, rangeMin: y0, rangeMax: y1 };
    case "east":
      return { axis: "y", axisCoordinate: x1, rangeMin: y0, rangeMax: y1 };
  }
}

function joinEdgesAreOpposite(join: CompositionJoin): boolean {
  // Valid pairs: north↔south, east↔west. Anything else is either
  // same-direction (north↔north) or perpendicular (north↔east).
  if (join.fromEdge === "north" && join.toEdge === "south") return true;
  if (join.fromEdge === "south" && join.toEdge === "north") return true;
  if (join.fromEdge === "east" && join.toEdge === "west") return true;
  if (join.fromEdge === "west" && join.toEdge === "east") return true;
  return false;
}

function edgesOverlap(a: EdgeSegment, b: EdgeSegment): boolean {
  if (a.axis !== b.axis) return false;
  if (Math.abs(a.axisCoordinate - b.axisCoordinate) > JOIN_OVERLAP_MIN_MM) {
    return false;
  }
  const overlapMin = Math.max(a.rangeMin, b.rangeMin);
  const overlapMax = Math.min(a.rangeMax, b.rangeMax);
  return overlapMax - overlapMin >= JOIN_OVERLAP_MIN_MM;
}

function rectangleInteriorOverlapMm2(
  a: AxisAlignedRectangle,
  b: AxisAlignedRectangle,
): number {
  const ax0 = a.originXMm;
  const ax1 = a.originXMm + a.widthMm;
  const ay0 = a.originYMm;
  const ay1 = a.originYMm + a.depthMm;
  const bx0 = b.originXMm;
  const bx1 = b.originXMm + b.widthMm;
  const by0 = b.originYMm;
  const by1 = b.originYMm + b.depthMm;
  const overlapX = Math.max(0, Math.min(ax1, bx1) - Math.max(ax0, bx0));
  const overlapY = Math.max(0, Math.min(ay1, by1) - Math.max(ay0, by0));
  return overlapX * overlapY;
}

/**
 * Validate a composition is structurally sound. Returns either
 * `{ ok: true }` or `{ ok: false, error }` with a typed error code
 * that callers can switch on exhaustively.
 *
 * Validation rules (v1):
 *   1. Composition is non-empty.
 *   2. All primitives are axis-aligned rectangles with positive
 *      width AND positive depth.
 *   3. Every join references valid primitive indexes.
 *   4. Join edges are opposite-direction pairs
 *      (north↔south, east↔west).
 *   5. Join edges geometrically overlap by at least 1mm.
 *   6. No two primitives have interior overlap exceeding 1mm².
 *      (Edge-touching is fine — that's what joins ARE.)
 *
 * The function does NOT validate that joined primitives are
 * "reachable" (graph connectivity). A composition with disjoint
 * sub-graphs is structurally valid but semantically suspect; if
 * that turns out to matter, add a connectivity check as a separate
 * rule.
 */
export function validateHouseComposition(
  composition: HouseComposition,
): CompositionValidationResult {
  if (composition.primitives.length === 0) {
    return { ok: false, error: { code: "empty_composition" } };
  }

  for (let i = 0; i < composition.primitives.length; i += 1) {
    const primitive = composition.primitives[i]!;
    if (!isAxisAlignedRectangle(primitive)) {
      return {
        ok: false,
        error: {
          code: "unsupported_primitive_kind",
          primitiveIndex: i,
          kind: primitive.kind,
        },
      };
    }
    if (primitive.widthMm <= 0 || primitive.depthMm <= 0) {
      return {
        ok: false,
        error: { code: "non_positive_rectangle", primitiveIndex: i },
      };
    }
  }

  // Rectangles only after this point — narrow once for the rest.
  const rectangles = composition.primitives as AxisAlignedRectangle[];

  for (let j = 0; j < composition.joins.length; j += 1) {
    const join = composition.joins[j]!;
    const lastIndex = rectangles.length - 1;
    if (
      join.fromPrimitiveIndex < 0 ||
      join.fromPrimitiveIndex > lastIndex ||
      join.toPrimitiveIndex < 0 ||
      join.toPrimitiveIndex > lastIndex
    ) {
      return {
        ok: false,
        error: {
          code: "invalid_join_index",
          joinIndex: j,
          referenced:
            join.fromPrimitiveIndex < 0 || join.fromPrimitiveIndex > lastIndex
              ? join.fromPrimitiveIndex
              : join.toPrimitiveIndex,
        },
      };
    }
    if (!joinEdgesAreOpposite(join)) {
      return {
        ok: false,
        error: {
          code: "join_edges_same_axis",
          joinIndex: j,
          fromEdge: join.fromEdge,
          toEdge: join.toEdge,
        },
      };
    }
    const fromEdge = rectangleEdge(
      rectangles[join.fromPrimitiveIndex]!,
      join.fromEdge,
    );
    const toEdge = rectangleEdge(
      rectangles[join.toPrimitiveIndex]!,
      join.toEdge,
    );
    if (!edgesOverlap(fromEdge, toEdge)) {
      return {
        ok: false,
        error: { code: "join_edges_do_not_overlap", joinIndex: j },
      };
    }
  }

  for (let a = 0; a < rectangles.length; a += 1) {
    for (let b = a + 1; b < rectangles.length; b += 1) {
      const overlap = rectangleInteriorOverlapMm2(rectangles[a]!, rectangles[b]!);
      if (overlap > INTERIOR_OVERLAP_MIN_MM2) {
        return {
          ok: false,
          error: {
            code: "primitive_interiors_overlap",
            primitiveIndexA: a,
            primitiveIndexB: b,
          },
        };
      }
    }
  }

  return { ok: true };
}
