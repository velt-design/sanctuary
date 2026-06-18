/**
 * PR-COMP1 (2026-06-18): house composition geometry types.
 *
 * A `HouseComposition` is the canonical authored representation for
 * new house forms in the design workbench. It records:
 *   - the set of primitive shapes the designer placed
 *   - the explicit `Join` operations that bind those primitives into
 *     a single composite house form
 *
 * Snap (in the workbench UX) is positioning-only: it aligns
 * primitives edge-to-edge without making them act as one house.
 * `Join` is the explicit commitment — once joined, the primitives
 * share roof intent and render as one coherent roof.
 *
 * See `docs/house-composition-vision.md` for the model and
 * `docs/pr-comp1-plan.md` for this PR's scope.
 *
 * v1 ships only `axisAlignedRectangle` as a primitive kind. The
 * polymorphic union shape on `CompositionPrimitive` leaves room for
 * rotated rectangles, octagons, etc. without refactor; future
 * primitives drop in as additional union members.
 */

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
export type CompositionValidationError =
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
