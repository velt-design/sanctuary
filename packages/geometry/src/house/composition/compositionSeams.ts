import type { Point2 } from "../../contracts";
import {
  isAxisAlignedRectangle,
  type AxisAlignedRectangle,
  type CompositionEdge,
  type CompositionJoin,
  type HouseComposition,
} from "./types";

/**
 * PR-COMP-PHASE4b.1 (2026-06-18): pure geometry primitives the
 * workbench's seam-icon UX consumes.
 *
 *   - `findCompositionJoinSeamMidpoint(composition, joinIndex)`
 *     → form-local midpoint of an internal join's overlapping
 *       segment. Used to position the Detach icon in PlanViewport.
 *
 *   - `detectSharedSeamBetweenForms(formA, formB)`
 *     → world-space midpoint of the overlap between two
 *       independent forms' edges (if any). Used to position the
 *       Join icon. Returns null when no edges align.
 *
 *   - `joinTwoHouseForms({ rectanglesA, rectanglesB, joinsA, joinsB,
 *       offsetXMm, offsetYMm })`
 *     → merged HouseComposition (form B's primitives translated
 *       into form A's local frame), with the inferred join edge
 *       recorded. Returns a typed error if the merge would
 *       produce an invalid composition (no overlap, primitives
 *       interpenetrate, etc.).
 *
 * All three live here together because they share the
 * "rectangle-edge-segment" helpers (which edge of which rectangle
 * runs along which world-space line, and where do two such
 * segments overlap).
 *
 * Per-edge axis convention (mirrors `validateHouseComposition`):
 *   - south: y == originY            (the +x-running edge at minimum y)
 *   - north: y == originY + depth
 *   - west:  x == originX            (the +y-running edge at minimum x)
 *   - east:  x == originX + width
 */

/**
 * Minimum mm of overlap before two edges are treated as "joinable"
 * — matches the threshold `validateHouseComposition` enforces. If
 * the overlap is smaller, the icon shouldn't appear (it would
 * promise a Join the validator would reject).
 */
const SEAM_OVERLAP_MIN_MM = 1;

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

/**
 * Overlap segment between two edges. Returns null when they don't
 * overlap (different axes, different axis-coords beyond tolerance,
 * or range-overlap less than `SEAM_OVERLAP_MIN_MM`).
 */
function edgeOverlapSegment(
  a: EdgeSegment,
  b: EdgeSegment,
): EdgeSegment | null {
  if (a.axis !== b.axis) return null;
  if (Math.abs(a.axisCoordinate - b.axisCoordinate) > SEAM_OVERLAP_MIN_MM) {
    return null;
  }
  const overlapMin = Math.max(a.rangeMin, b.rangeMin);
  const overlapMax = Math.min(a.rangeMax, b.rangeMax);
  if (overlapMax - overlapMin < SEAM_OVERLAP_MIN_MM) return null;
  return {
    axis: a.axis,
    axisCoordinate: a.axisCoordinate,
    rangeMin: overlapMin,
    rangeMax: overlapMax,
  };
}

function edgeMidpoint(segment: EdgeSegment): Point2 {
  const along = (segment.rangeMin + segment.rangeMax) / 2;
  return segment.axis === "x"
    ? { x: along, y: segment.axisCoordinate }
    : { x: segment.axisCoordinate, y: along };
}

/**
 * Form-local midpoint of an internal join's overlapping segment.
 * The Detach icon renders at this point (in form-local mm; the
 * PlanViewport layer translates by the form's world transform
 * before drawing).
 *
 * Returns null when:
 *   - joinIndex is out of bounds
 *   - either referenced primitive is not an axis-aligned rectangle
 *     (v1 limit — composition validator would have rejected anyway,
 *     but the function is defensive)
 *   - the join's two edges don't overlap (defensive — the validator
 *     would have rejected, but corruption / hand-authored data is
 *     out there)
 */
export function findCompositionJoinSeamMidpoint(
  composition: HouseComposition,
  joinIndex: number,
): Point2 | null {
  if (joinIndex < 0 || joinIndex >= composition.joins.length) return null;
  const join = composition.joins[joinIndex]!;
  const fromPrimitive = composition.primitives[join.fromPrimitiveIndex];
  const toPrimitive = composition.primitives[join.toPrimitiveIndex];
  if (!fromPrimitive || !toPrimitive) return null;
  if (!isAxisAlignedRectangle(fromPrimitive) || !isAxisAlignedRectangle(toPrimitive)) {
    return null;
  }
  const fromEdge = rectangleEdge(fromPrimitive, join.fromEdge);
  const toEdge = rectangleEdge(toPrimitive, join.toEdge);
  const overlap = edgeOverlapSegment(fromEdge, toEdge);
  if (!overlap) return null;
  return edgeMidpoint(overlap);
}

/**
 * The result of detecting a shared seam between two independent
 * forms — the Join icon's position + the structural hand-off the
 * Join action needs to construct the merged composition.
 *
 * `midpointWorldMm`: where to render the icon (world space, mm).
 * `lengthMm`: how long the overlap is (informational — UX may
 *   modulate icon size, debug overlays, etc.).
 * `formAPrimitiveIndex` / `formAEdge`: which rectangle + edge in
 *   form A's composition the seam runs along.
 * `formBPrimitiveIndex` / `formBEdge`: same for form B.
 *
 * The two edges are guaranteed to be opposite-direction per
 * `validateHouseComposition` rules (north↔south or east↔west).
 */
export type SharedSeam = {
  midpointWorldMm: Point2;
  lengthMm: number;
  formAPrimitiveIndex: number;
  formAEdge: CompositionEdge;
  formBPrimitiveIndex: number;
  formBEdge: CompositionEdge;
};

/**
 * Inputs to `detectSharedSeamBetweenForms`. Each form's primitives
 * are taken at face value (already validated), and each form's
 * world offset is the translation to apply to its primitives'
 * `originXMm` / `originYMm` to land them in world coordinates.
 *
 * Rotation is intentionally NOT supported in v1 — composition's
 * `axisAlignedRectangle` primitive type forbids rotation, so the
 * two forms MUST share the same world rotation for any seam to
 * align in axis-aligned space. The PlanViewport layer is
 * responsible for skipping seam detection when rotations differ.
 */
export function detectSharedSeamBetweenForms(input: {
  formARectangles: ReadonlyArray<AxisAlignedRectangle>;
  formAWorldOffsetXMm: number;
  formAWorldOffsetYMm: number;
  formBRectangles: ReadonlyArray<AxisAlignedRectangle>;
  formBWorldOffsetXMm: number;
  formBWorldOffsetYMm: number;
}): SharedSeam | null {
  // For each pair (rectangle from A, rectangle from B), and for
  // each pair of opposite edges (north↔south, east↔west), check
  // whether the two edges align (same world-space axis coordinate
  // within tolerance) and overlap by SEAM_OVERLAP_MIN_MM or more.
  // The FIRST hit wins — v1 assumes at most one seam between two
  // adjacent forms (an L-arrangement has one shared edge; two
  // rectangles "kissing" at a corner produce zero seams below the
  // tolerance because corner-touch has no length).
  const EDGE_OPPOSITES: Array<{ a: CompositionEdge; b: CompositionEdge }> = [
    { a: "north", b: "south" },
    { a: "south", b: "north" },
    { a: "east", b: "west" },
    { a: "west", b: "east" },
  ];
  for (let i = 0; i < input.formARectangles.length; i += 1) {
    const rectA = translateRectangle(
      input.formARectangles[i]!,
      input.formAWorldOffsetXMm,
      input.formAWorldOffsetYMm,
    );
    for (let j = 0; j < input.formBRectangles.length; j += 1) {
      const rectB = translateRectangle(
        input.formBRectangles[j]!,
        input.formBWorldOffsetXMm,
        input.formBWorldOffsetYMm,
      );
      for (const pair of EDGE_OPPOSITES) {
        const edgeA = rectangleEdge(rectA, pair.a);
        const edgeB = rectangleEdge(rectB, pair.b);
        const overlap = edgeOverlapSegment(edgeA, edgeB);
        if (overlap) {
          return {
            midpointWorldMm: edgeMidpoint(overlap),
            lengthMm: overlap.rangeMax - overlap.rangeMin,
            formAPrimitiveIndex: i,
            formAEdge: pair.a,
            formBPrimitiveIndex: j,
            formBEdge: pair.b,
          };
        }
      }
    }
  }
  return null;
}

function translateRectangle(
  rectangle: AxisAlignedRectangle,
  dxMm: number,
  dyMm: number,
): AxisAlignedRectangle {
  return {
    kind: "axisAlignedRectangle",
    originXMm: rectangle.originXMm + dxMm,
    originYMm: rectangle.originYMm + dyMm,
    widthMm: rectangle.widthMm,
    depthMm: rectangle.depthMm,
    roofIntent: rectangle.roofIntent,
  };
}

/**
 * Join two house forms' compositions into a single composition.
 *
 * Algorithm:
 *   1. Translate every primitive in form B by
 *      `(formBOffsetXMm - formAOffsetXMm, formBOffsetYMm - formAOffsetYMm)`
 *      so it lives in form A's local coordinate frame.
 *   2. Detect a shared seam between the translated B primitives
 *      and form A's primitives.
 *   3. If no seam, return error — the two forms aren't actually
 *      edge-adjacent (Join shouldn't have been triggered).
 *   4. Construct the merged composition: form A's primitives
 *      first, then form B's translated primitives. Form A's joins
 *      keep their indices; form B's joins get their indices
 *      shifted by `formA.primitives.length`. Append the new join
 *      from the detected seam.
 *   5. The resulting composition keeps form A's world transform
 *      (caller's job — this function returns the composition only).
 *
 * Returns a typed error union; callers MUST exhaustively handle:
 *   - `no_shared_seam`: the two forms don't share an edge in
 *     world space. Caller probably shouldn't have called Join.
 *   - `merged_primitives_overlap`: the merge produces interior-
 *     overlapping rectangles. Snap got too aggressive; designer
 *     needs to move one of the forms before joining.
 */
export type JoinHouseFormsError =
  | { code: "no_shared_seam" }
  | {
      code: "merged_primitives_overlap";
      formAIndex: number;
      formBIndex: number;
    };

export type JoinHouseFormsResult =
  | { ok: true; merged: HouseComposition }
  | { ok: false; error: JoinHouseFormsError };

export function joinTwoHouseForms(input: {
  formA: HouseComposition;
  formAWorldOffsetXMm: number;
  formAWorldOffsetYMm: number;
  formB: HouseComposition;
  formBWorldOffsetXMm: number;
  formBWorldOffsetYMm: number;
}): JoinHouseFormsResult {
  const formARectangles: AxisAlignedRectangle[] = [];
  for (const primitive of input.formA.primitives) {
    if (!isAxisAlignedRectangle(primitive)) return { ok: false, error: { code: "no_shared_seam" } };
    formARectangles.push(primitive);
  }
  const formBRectanglesOriginal: AxisAlignedRectangle[] = [];
  for (const primitive of input.formB.primitives) {
    if (!isAxisAlignedRectangle(primitive)) return { ok: false, error: { code: "no_shared_seam" } };
    formBRectanglesOriginal.push(primitive);
  }

  // Translate every B primitive into A's local coordinate frame.
  const translationXMm = input.formBWorldOffsetXMm - input.formAWorldOffsetXMm;
  const translationYMm = input.formBWorldOffsetYMm - input.formAWorldOffsetYMm;
  const formBRectanglesInAFrame = formBRectanglesOriginal.map((rect) =>
    translateRectangle(rect, translationXMm, translationYMm),
  );

  // Find the seam in A's local frame.
  const seam = detectSharedSeamBetweenForms({
    formARectangles,
    formAWorldOffsetXMm: 0,
    formAWorldOffsetYMm: 0,
    formBRectangles: formBRectanglesInAFrame,
    formBWorldOffsetXMm: 0,
    formBWorldOffsetYMm: 0,
  });
  if (!seam) return { ok: false, error: { code: "no_shared_seam" } };

  // Check no merged primitives interpenetrate. Edge-touching is
  // fine (that's the seam); interior overlap exceeding 1mm² isn't.
  for (let i = 0; i < formARectangles.length; i += 1) {
    for (let j = 0; j < formBRectanglesInAFrame.length; j += 1) {
      const overlap = rectangleInteriorOverlapMm2(
        formARectangles[i]!,
        formBRectanglesInAFrame[j]!,
      );
      if (overlap > 1) {
        return {
          ok: false,
          error: { code: "merged_primitives_overlap", formAIndex: i, formBIndex: j },
        };
      }
    }
  }

  const offsetForB = formARectangles.length;
  const mergedPrimitives = [...formARectangles, ...formBRectanglesInAFrame];
  const mergedJoins: CompositionJoin[] = [
    ...input.formA.joins,
    ...input.formB.joins.map((join) => ({
      fromPrimitiveIndex: join.fromPrimitiveIndex + offsetForB,
      fromEdge: join.fromEdge,
      toPrimitiveIndex: join.toPrimitiveIndex + offsetForB,
      toEdge: join.toEdge,
    })),
    {
      fromPrimitiveIndex: seam.formAPrimitiveIndex,
      fromEdge: seam.formAEdge,
      toPrimitiveIndex: seam.formBPrimitiveIndex + offsetForB,
      toEdge: seam.formBEdge,
    },
  ];

  return { ok: true, merged: { primitives: mergedPrimitives, joins: mergedJoins } };
}

function rectangleInteriorOverlapMm2(
  a: AxisAlignedRectangle,
  b: AxisAlignedRectangle,
): number {
  const ax1 = a.originXMm + a.widthMm;
  const ay1 = a.originYMm + a.depthMm;
  const bx1 = b.originXMm + b.widthMm;
  const by1 = b.originYMm + b.depthMm;
  const overlapX = Math.max(0, Math.min(ax1, bx1) - Math.max(a.originXMm, b.originXMm));
  const overlapY = Math.max(0, Math.min(ay1, by1) - Math.max(a.originYMm, b.originYMm));
  return overlapX * overlapY;
}
