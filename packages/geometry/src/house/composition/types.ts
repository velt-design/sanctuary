import type { HouseRoofPrimaryFallDirection, HouseRoofRidgeAxis } from "../../contracts";

/**
 * PR-COMP1 (2026-06-18): house composition geometry types.
 *
 * A `HouseComposition` is the canonical authored representation for
 * new house forms in the design workbench. It records:
 *   - the set of primitive shapes the designer placed
 *   - per-primitive roof intent (form, pitch, ridge axis, etc.)
 *   - the explicit `Join` operations that bind primitives into a
 *     single composite house form
 *
 * Snap (in the workbench UX) is positioning-only: it aligns
 * primitives edge-to-edge without making them act as one house.
 * `Join` is the explicit commitment — once joined, the composite
 * is one house form, but each constituent rectangle keeps its own
 * roof intent (per-rectangle: hipped, mono, flat, with optional
 * Dutch hip on hipped ends).
 *
 * v1 ships only `axisAlignedRectangle` as a primitive kind. The
 * polymorphic union shape on `CompositionPrimitive` leaves room for
 * rotated rectangles, octagons, etc. without refactor; future
 * primitives drop in as additional union members.
 *
 * See `docs/house-composition-vision.md` for the model and
 * `docs/pr-comp1-plan.md` for this PR's scope.
 */

/**
 * Per-rectangle roof intent. Each constituent rectangle in a
 * composition picks its own form independently — a designer can
 * compose a main-block hipped roof with an extension skillion, or
 * two hipped wings forming an L, etc. The composite solver wires
 * each per-rectangle solve into the unified result.
 *
 * v1 supports `flat`, `mono`, and `hipped`. Hipped supports Dutch
 * hip via per-end `startCap`/`endCap` choices.
 */
export type RectangleRoofIntent =
  | {
      form: "flat";
    }
  | {
      form: "mono";
      pitchDeg: number;
      fallDirection: HouseRoofPrimaryFallDirection;
    }
  | {
      form: "hipped";
      pitchDeg: number;
      ridgeAxis: HouseRoofRidgeAxis;
      /**
       * Cap on the ridge-start (min-axis) end. `'hipped'` = full hip
       * triangle. `'open_gable'` = ridge extends to the eave; the end
       * face becomes a vertical gable wall (Dutch hip when only one
       * end is open). Mirrors `RidgeEndCap` from `roofRectangle.ts`.
       */
      startCap: "hipped" | "open_gable";
      endCap: "hipped" | "open_gable";
    };

/**
 * An axis-aligned rectangle primitive. Origin is the south-west
 * corner (minimum x, minimum y); the rectangle extends `widthMm`
 * along +x and `depthMm` along +y. All measurements are in
 * millimetres in the project world frame.
 */
export type AxisAlignedRectangle = {
  kind: "axisAlignedRectangle";
  originXMm: number;
  originYMm: number;
  widthMm: number;
  depthMm: number;
  /**
   * Per-rectangle roof intent. Designer picks this when placing the
   * rectangle; the composite solver uses each rectangle's own
   * intent to compute its roof. Composite shares one
   * `eaveHeightMm` (passed to the composer) so joined roofs meet
   * cleanly at the shared eave edges.
   */
  roofIntent: RectangleRoofIntent;
};

/**
 * Polymorphic primitive type. v1: only axis-aligned rectangles.
 * The `unknown` arm exists to keep this type extensible without
 * the union collapsing to `AxisAlignedRectangle`; future primitives
 * (e.g. rotated rectangle) drop in by replacing the unknown arm
 * with the real shape.
 */
export type CompositionPrimitive =
  | AxisAlignedRectangle
  | { kind: "unknown"; reserved: true };

/**
 * The four cardinal edges of an axis-aligned rectangle:
 *   - south: y == originY    (the +x-running edge at minimum y)
 *   - north: y == originY + depth
 *   - west:  x == originX    (the +y-running edge at minimum x)
 *   - east:  x == originX + width
 */
export type CompositionEdge = "north" | "south" | "east" | "west";

/**
 * An explicit `Join` operation. Records which edge of which primitive
 * connects to which edge of which other primitive. World-space
 * positions on the primitives themselves are the source of truth;
 * the join is the designer's declaration of intent + the geometric
 * topology marker.
 *
 * Valid joins:
 *   - both edges are on opposite axes' opposite directions
 *     (north↔south, east↔west) — perpendicular edges can never join
 *   - the two named edges geometrically overlap by at least 1mm
 *
 * `validateHouseComposition` enforces both rules.
 */
export type CompositionJoin = {
  fromPrimitiveIndex: number;
  fromEdge: CompositionEdge;
  toPrimitiveIndex: number;
  toEdge: CompositionEdge;
};

/**
 * A house composition: N primitives + M explicit joins.
 *
 * v1 invariants (enforced by `validateHouseComposition`):
 *   - all primitives are axis-aligned rectangles
 *   - every join references valid primitive indexes
 *   - join edges are opposite-direction (north↔south, east↔west)
 *   - join edges geometrically overlap by at least 1mm
 *   - no two primitives have overlapping interiors
 *
 * A single-rectangle composition (`primitives.length === 1`,
 * `joins.length === 0`) is the smallest valid composition — every
 * new house form starts here.
 */
export type HouseComposition = {
  primitives: CompositionPrimitive[];
  joins: CompositionJoin[];
};

/**
 * Typed validation outcomes. Keep this a closed union so callers
 * can exhaustively switch on the error code; do not add an
 * `unknown` arm.
 */
type CompositionValidationError =
  | { code: "empty_composition" }
  | { code: "unsupported_primitive_kind"; primitiveIndex: number; kind: string }
  | { code: "non_positive_rectangle"; primitiveIndex: number }
  | { code: "invalid_join_index"; joinIndex: number; referenced: number }
  | { code: "join_edges_same_axis"; joinIndex: number; fromEdge: CompositionEdge; toEdge: CompositionEdge }
  | { code: "join_edges_do_not_overlap"; joinIndex: number }
  | { code: "primitive_interiors_overlap"; primitiveIndexA: number; primitiveIndexB: number };

export type CompositionValidationResult =
  | { ok: true }
  | { ok: false; error: CompositionValidationError };

/**
 * Convenience type guard for narrowing the polymorphic primitive.
 * Use this everywhere downstream code needs to access rectangle
 * fields; never destructure the union directly.
 */
export function isAxisAlignedRectangle(
  primitive: CompositionPrimitive,
): primitive is AxisAlignedRectangle {
  return primitive.kind === "axisAlignedRectangle";
}
