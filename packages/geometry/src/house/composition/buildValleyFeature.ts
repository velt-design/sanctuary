import type {
  GeometryMetadata,
  HouseRoofFeature3D,
  Point3,
} from "../../contracts";
import {
  isAxisAlignedRectangle,
  type AxisAlignedRectangle,
  type CompositionEdge,
  type CompositionJoin,
  type HouseComposition,
} from "./types";

/**
 * PR-COMP1 (2026-06-18): construct an explicit valley feature
 * geometry for a composition's inside corner.
 *
 * A "valley" forms wherever two joined rectangles meet at a
 * perpendicular inside corner of the union perimeter (an L, T, U,
 * or cross has these). In v1 every constituent uses the same
 * pitch (composite owns one roof intent), so the valley line runs
 * at 45° in plan, climbs at the slope's vertical rise, and
 * terminates at the lower of the two adjacent rectangles' ridge
 * heights.
 *
 * This file ships two pieces:
 *
 *   1. `buildValleyFeatureLine`: a tiny constructor that wraps a
 *      pre-computed (start, end) pair into a `HouseRoofFeature3D`.
 *      Keeps the public function shape clean for callers that
 *      already know the geometry.
 *
 *   2. `deriveInsideCornerValleys`: walks a composition's joins,
 *      finds inside-corner geometry, computes valley endpoints for
 *      the L-class case, and returns the resulting features. This
 *      is what `composeRoofFromComposition` (COMP1.4) calls.
 *
 * v1 limit: only inside corners where two perpendicular axis-
 * aligned rectangles meet are handled. T-joins where a rectangle's
 * edge is internal to another rectangle's edge produce zero
 * inside corners (no valleys); they get a continuous eave on the
 * larger rectangle's perimeter and a separate hipped roof on the
 * stem. Valleys at those joins are a future enhancement.
 */
export function buildValleyFeatureLine(input: {
  id: string;
  start: Point3;
  end: Point3;
  metadata?: GeometryMetadata;
}): HouseRoofFeature3D {
  return {
    id: input.id,
    kind: "valley",
    line: { start: input.start, end: input.end },
    metadata: input.metadata,
  };
}

const EPSILON_MM = 1e-3;

type RectangleEdges = {
  northY: number;
  southY: number;
  eastX: number;
  westX: number;
};

function rectangleEdges(rectangle: AxisAlignedRectangle): RectangleEdges {
  return {
    northY: rectangle.originYMm + rectangle.depthMm,
    southY: rectangle.originYMm,
    eastX: rectangle.originXMm + rectangle.widthMm,
    westX: rectangle.originXMm,
  };
}

function rectangleHalfMinDimMm(rectangle: AxisAlignedRectangle): number {
  // For a hipped roof, the ridge height is determined by HALF the
  // shorter dimension × tan(pitch). The hip lines meet the ridge
  // at the point that's (shorter dimension / 2) inside from each
  // gable end.
  return Math.min(rectangle.widthMm, rectangle.depthMm) / 2;
}

function rectangleRidgeHeightAboveEaveMm(input: {
  rectangle: AxisAlignedRectangle;
  pitchDeg: number;
}): number {
  const pitchRadians = (input.pitchDeg * Math.PI) / 180;
  return rectangleHalfMinDimMm(input.rectangle) * Math.tan(pitchRadians);
}

/**
 * For an inside-corner valley between rectangles A and B meeting
 * at corner (cornerX, cornerY), where the valley climbs into A's
 * interior at 45° in plan: compute the (start, end) line. The
 * valley climbs to the lower of A's and B's ridge heights — past
 * that, only the taller rectangle's roof continues alone, with no
 * valley.
 */
export function deriveLClassValleyLine(input: {
  cornerXY: { x: number; y: number };
  inwardDirection: { x: -1 | 0 | 1; y: -1 | 0 | 1 }; // unit vector into the union interior
  rectangleA: AxisAlignedRectangle;
  rectangleB: AxisAlignedRectangle;
  eaveHeightMm: number;
  pitchDeg: number;
}): { start: Point3; end: Point3 } {
  const aRidgeAboveEave = rectangleRidgeHeightAboveEaveMm({
    rectangle: input.rectangleA,
    pitchDeg: input.pitchDeg,
  });
  const bRidgeAboveEave = rectangleRidgeHeightAboveEaveMm({
    rectangle: input.rectangleB,
    pitchDeg: input.pitchDeg,
  });
  // Valley climbs at the slope's vertical rise per unit horizontal.
  // In plan, the valley moves at 45° — so the horizontal distance
  // along x and along y are equal. The vertical climb relates to
  // the in-plan distance by tan(pitch).
  const pitchRadians = (input.pitchDeg * Math.PI) / 180;
  const tanPitch = Math.tan(pitchRadians);
  const valleyTopAboveEave = Math.min(aRidgeAboveEave, bRidgeAboveEave);
  // In-plan distance the valley travels before reaching the top
  // height. Climbs at rate tan(pitch) along the 45° diagonal, so
  // the diagonal in-plan distance is valleyTopAboveEave / tan(pitch).
  // Resolving the diagonal into x and y: the diagonal distance D
  // along the 45° diagonal has dx = dy = D / sqrt(2).
  const diagonalInPlanMm = valleyTopAboveEave / tanPitch;
  const componentInPlanMm = diagonalInPlanMm / Math.SQRT2;

  const start: Point3 = {
    x: input.cornerXY.x,
    y: input.cornerXY.y,
    z: input.eaveHeightMm,
  };
  const end: Point3 = {
    x: input.cornerXY.x + input.inwardDirection.x * componentInPlanMm,
    y: input.cornerXY.y + input.inwardDirection.y * componentInPlanMm,
    z: input.eaveHeightMm + valleyTopAboveEave,
  };
  return { start, end };
}

/**
 * Walk a validated composition, find each inside-corner pair of
 * perpendicular rectangles meeting at a join, and emit a valley
 * feature for each. The orchestrator passes these into the
 * composite roof.
 *
 * v1 covers the "L-class" inside corner: two rectangles where
 * exactly two perpendicular edges meet at one shared corner point.
 * Anything more complex (T's mid-edge join, cross's interior) is
 * handled by the same caller emitting multiple joins; each gets
 * its own valley feature here.
 */
export function deriveInsideCornerValleys(input: {
  composition: HouseComposition;
  eaveHeightMm: number;
  pitchDeg: number;
  /** Optional id prefix; default `house-valley-`. */
  idPrefix?: string;
}): HouseRoofFeature3D[] {
  const prefix = input.idPrefix ?? "house-valley-";
  const features: HouseRoofFeature3D[] = [];
  let valleyIndex = 0;

  for (const join of input.composition.joins) {
    const a = input.composition.primitives[join.fromPrimitiveIndex];
    const b = input.composition.primitives[join.toPrimitiveIndex];
    if (!a || !isAxisAlignedRectangle(a)) continue;
    if (!b || !isAxisAlignedRectangle(b)) continue;
    const corners = sharedCornersForJoin({
      rectangleA: a,
      edgeA: join.fromEdge,
      rectangleB: b,
      edgeB: join.toEdge,
    });
    for (const corner of corners) {
      // For each inside corner, the valley climbs into the union
      // interior. "Interior" is the direction toward both
      // rectangles' centers (their centers are in the same half-
      // plane relative to the inside corner for an inside-corner
      // join).
      const inward = inwardDirectionFromCorner({
        cornerXY: corner,
        rectangleA: a,
        edgeA: join.fromEdge,
        rectangleB: b,
        edgeB: join.toEdge,
      });
      if (!inward) continue;
      const line = deriveLClassValleyLine({
        cornerXY: corner,
        inwardDirection: inward,
        rectangleA: a,
        rectangleB: b,
        eaveHeightMm: input.eaveHeightMm,
        pitchDeg: input.pitchDeg,
      });
      valleyIndex += 1;
      features.push(
        buildValleyFeatureLine({
          id: `${prefix}${valleyIndex}`,
          start: line.start,
          end: line.end,
          metadata: {
            valleyClass: "l_class_inside_corner",
            fromPrimitiveIndex: join.fromPrimitiveIndex,
            toPrimitiveIndex: join.toPrimitiveIndex,
            insideCornerXMm: corner.x,
            insideCornerYMm: corner.y,
          },
        }),
      );
    }
  }
  return features;
}

/**
 * The "shared corner(s)" between two joined edges. For an
 * inside-corner (L) join, this is exactly ONE point: where one
 * rectangle's edge ENDS partway through another rectangle's
 * edge. For a T-like join where one edge is fully contained
 * within another, there are TWO inside corners (one at each end
 * of the contained edge). For a side-by-side (fully-overlapping)
 * join, there are ZERO inside corners (both endpoints are at the
 * corners of both rectangles — no reflex perimeter).
 */
function sharedCornersForJoin(input: {
  rectangleA: AxisAlignedRectangle;
  edgeA: CompositionEdge;
  rectangleB: AxisAlignedRectangle;
  edgeB: CompositionEdge;
}): Array<{ x: number; y: number }> {
  const aEdges = rectangleEdges(input.rectangleA);
  const bEdges = rectangleEdges(input.rectangleB);
  // For perpendicular north↔south joins (the two horizontal-edge
  // case), the join lives on an x range. For east↔west joins, on
  // a y range. Compute the shared range, then identify which
  // endpoints of that range are inside corners of the union.
  if (
    (input.edgeA === "north" && input.edgeB === "south") ||
    (input.edgeA === "south" && input.edgeB === "north")
  ) {
    const aMinX = input.rectangleA.originXMm;
    const aMaxX = aMinX + input.rectangleA.widthMm;
    const bMinX = input.rectangleB.originXMm;
    const bMaxX = bMinX + input.rectangleB.widthMm;
    const sharedMinX = Math.max(aMinX, bMinX);
    const sharedMaxX = Math.min(aMaxX, bMaxX);
    if (sharedMaxX - sharedMinX < EPSILON_MM) return [];
    // The y of the shared edge: for north↔south, both edges live
    // at the same y; pick A's:
    const sharedY =
      input.edgeA === "north" ? aEdges.northY : aEdges.southY;
    const corners: Array<{ x: number; y: number }> = [];
    // A corner at sharedMinX is an INSIDE corner of the union if
    // sharedMinX is strictly between one rectangle's edge ends
    // (i.e., A's edge extends past it or B's edge does).
    if (sharedMinX > aMinX + EPSILON_MM || sharedMinX > bMinX + EPSILON_MM) {
      corners.push({ x: sharedMinX, y: sharedY });
    }
    if (sharedMaxX < aMaxX - EPSILON_MM || sharedMaxX < bMaxX - EPSILON_MM) {
      corners.push({ x: sharedMaxX, y: sharedY });
    }
    return corners;
  }
  if (
    (input.edgeA === "east" && input.edgeB === "west") ||
    (input.edgeA === "west" && input.edgeB === "east")
  ) {
    const aMinY = input.rectangleA.originYMm;
    const aMaxY = aMinY + input.rectangleA.depthMm;
    const bMinY = input.rectangleB.originYMm;
    const bMaxY = bMinY + input.rectangleB.depthMm;
    const sharedMinY = Math.max(aMinY, bMinY);
    const sharedMaxY = Math.min(aMaxY, bMaxY);
    if (sharedMaxY - sharedMinY < EPSILON_MM) return [];
    const sharedX =
      input.edgeA === "east" ? aEdges.eastX : aEdges.westX;
    const corners: Array<{ x: number; y: number }> = [];
    if (sharedMinY > aMinY + EPSILON_MM || sharedMinY > bMinY + EPSILON_MM) {
      corners.push({ x: sharedX, y: sharedMinY });
    }
    if (sharedMaxY < aMaxY - EPSILON_MM || sharedMaxY < bMaxY - EPSILON_MM) {
      corners.push({ x: sharedX, y: sharedMaxY });
    }
    return corners;
  }
  return [];
}

function inwardDirectionFromCorner(input: {
  cornerXY: { x: number; y: number };
  rectangleA: AxisAlignedRectangle;
  edgeA: CompositionEdge;
  rectangleB: AxisAlignedRectangle;
  edgeB: CompositionEdge;
}): { x: -1 | 0 | 1; y: -1 | 0 | 1 } | null {
  // Identify the two rectangles by the perpendicular direction
  // their inward-facing interior lies in relative to the join.
  // For north↔south the join is horizontal in plan; one rectangle
  // is on the +y side (north of the join), the other on the -y
  // side (south).
  if (
    (input.edgeA === "north" && input.edgeB === "south") ||
    (input.edgeA === "south" && input.edgeB === "north")
  ) {
    const northRect = input.edgeA === "south" ? input.rectangleA : input.rectangleB;
    const southRect = input.edgeA === "north" ? input.rectangleA : input.rectangleB;
    return inwardForJoinAlongX({
      cornerX: input.cornerXY.x,
      northRect,
      southRect,
    });
  }
  if (
    (input.edgeA === "east" && input.edgeB === "west") ||
    (input.edgeA === "west" && input.edgeB === "east")
  ) {
    const eastRect = input.edgeA === "west" ? input.rectangleA : input.rectangleB;
    const westRect = input.edgeA === "east" ? input.rectangleA : input.rectangleB;
    return inwardForJoinAlongY({
      cornerY: input.cornerXY.y,
      eastRect,
      westRect,
    });
  }
  return null;
}

function inwardForJoinAlongX(input: {
  cornerX: number;
  northRect: AxisAlignedRectangle;
  southRect: AxisAlignedRectangle;
}): { x: -1 | 0 | 1; y: -1 | 0 | 1 } | null {
  // For a join along x (north↔south), the y component of inward
  // is always +1 toward the north rectangle's interior (and -1
  // toward the south rectangle's interior). But the valley
  // climbs into the UNION interior, which sits on the side of the
  // corner where the shorter rectangle stops. Specifically:
  //   - If north extends past corner.x in +x AND south does not:
  //     reflex SE → inward = (-1, +1)
  //   - If north extends past in -x AND south does not:
  //     reflex SW → inward = (+1, +1)
  //   - If south extends past in +x AND north does not:
  //     reflex NE → inward = (-1, -1)
  //   - If south extends past in -x AND north does not:
  //     reflex NW → inward = (+1, -1)
  const ne = extendsEast(input.northRect, input.cornerX);
  const nw = extendsWest(input.northRect, input.cornerX);
  const se = extendsEast(input.southRect, input.cornerX);
  const sw = extendsWest(input.southRect, input.cornerX);
  if (ne && !se) return { x: -1, y: 1 };
  if (nw && !sw) return { x: 1, y: 1 };
  if (se && !ne) return { x: -1, y: -1 };
  if (sw && !nw) return { x: 1, y: -1 };
  return null;
}

function inwardForJoinAlongY(input: {
  cornerY: number;
  eastRect: AxisAlignedRectangle;
  westRect: AxisAlignedRectangle;
}): { x: -1 | 0 | 1; y: -1 | 0 | 1 } | null {
  // Mirror of inwardForJoinAlongX with axes swapped.
  const en = extendsNorth(input.eastRect, input.cornerY);
  const es = extendsSouth(input.eastRect, input.cornerY);
  const wn = extendsNorth(input.westRect, input.cornerY);
  const ws = extendsSouth(input.westRect, input.cornerY);
  if (en && !wn) return { x: 1, y: -1 };
  if (es && !ws) return { x: 1, y: 1 };
  if (wn && !en) return { x: -1, y: -1 };
  if (ws && !es) return { x: -1, y: 1 };
  return null;
}

function extendsEast(rect: AxisAlignedRectangle, x: number): boolean {
  return rect.originXMm + rect.widthMm > x + EPSILON_MM;
}
function extendsWest(rect: AxisAlignedRectangle, x: number): boolean {
  return rect.originXMm < x - EPSILON_MM;
}
function extendsNorth(rect: AxisAlignedRectangle, y: number): boolean {
  return rect.originYMm + rect.depthMm > y + EPSILON_MM;
}
function extendsSouth(rect: AxisAlignedRectangle, y: number): boolean {
  return rect.originYMm < y - EPSILON_MM;
}
