import {
  deriveHouseGableTerminalEnds,
  resolveHouseFootprintParams,
  type AxisAlignedRectangle,
  type CompositionJoin,
  type HouseComposition,
  type HouseRoofPrimaryFallDirection,
  type HouseRoofRidgeAxis,
  type Point3,
  type Polygon3,
  type RectangleRoofIntent,
} from "@sp/geometry";
import type { HouseFormModel } from "./objectFirstWorkbenchModel";

/**
 * PR-COMP-PHASE3 (2026-06-18): adapter from the workbench's
 * authored `HouseFormModel` into a single-rectangle
 * `HouseComposition`.
 *
 * Returns `null` (NOT a composition) when the form is not
 * representable as a clean single rectangle:
 *   - footprint mode is `custom_polygon` (free-form, legacy
 *     authoring path — Phase 4's Join is the route to compose
 *     legacy shapes into rectangles, not this helper)
 *   - footprint preset is anything other than `straight` (L / U /
 *     etc. presets are multi-rectangle compositions, deferred to
 *     Phase 4 when designers can author multi-rectangle composites
 *     directly)
 *   - width or depth is non-positive
 *
 * When invoked at the normalisation boundary, a `null` return
 * means the form's `composition` field stays undefined and the
 * form continues to render via the legacy free-form pipeline.
 * Multi-rectangle compositions (Phase 4 authored) are left
 * untouched by the normaliser — see `syncSingleRectangleComposition`.
 */
export function buildSingleRectangleCompositionFromHouseForm(
  houseForm: Pick<HouseFormModel, "footprint" | "roofIntent">,
): HouseComposition | null {
  return buildPresetCompositionFromHouseForm(houseForm);
}

/**
 * PR-WB-PRESETS-AS-COMPOSITIONS (2026-06-19): generalises the
 * single-rectangle adapter to handle every preset shape. Each
 * preset's polygon (from `@sp/geometry/footprints.ts:buildPresetLocalPoints`)
 * is expressed here as a multi-rectangle composition: the
 * primitives' union polygon matches the legacy preset polygon, and
 * the primitives carry the form's roof intent so the composition-
 * driven roof solver produces a stitched per-rectangle roof
 * matching the preset's shape.
 *
 * Why this matters: before this PR, only straight-preset forms got
 * an authored composition. L / U / recess / wrap presets stayed
 * composition-less, fell back to the legacy polygon pipeline, and
 * (when resized via drag) became custom_polygon forms with no
 * composition — invisible to Join detection, labelled "Custom
 * footprint" in the rail, badged read-only by the inspector. After
 * this PR, every preset is composition-driven from creation; the
 * Phase 4a.3 union-polygon substitution renders walls along the
 * union of the constituent rectangles (which equals the legacy
 * preset polygon by construction), and the roof comes from the
 * composition path.
 *
 * Returns null for:
 *   - non-preset modes (custom_polygon takes the
 *     `buildSingleRectangleCompositionFromCustomPolygonForm` path
 *     when the polygon is a rectangle, or stays composition-less
 *     for genuinely free-form shapes)
 *   - non-rear attachment sides (legacy frame math is verified for
 *     `rear` only; front / left / right deferred)
 *   - degenerate dimensions (zero-area rectangles)
 *
 * Preset-specific frame (form-local mm, attachmentSide 'rear',
 * inverted from `houseFootprintSideLocalPointToWorld`):
 *   - x axis: pergola-parallel; offsetXM shifts the form east
 *   - y axis: negative = south (away from attachment line);
 *             setbackM pushes the form south away from y=0
 *
 * Rectangle layouts derived from `buildPresetLocalPoints` (preset
 * coords with depthM=positive=south, before y-negation):
 *
 *   straight: 1 rect (south band only)
 *   l_left  : 2 rects (south band + west arm going north)
 *   l_right : 2 rects (south band + east arm going north)
 *   u_shape : 3 rects (south band + west arm + east arm)
 *   recess_left  : 2 rects (full bottom + NE quadrant minus notch)
 *   recess_right : 2 rects (full bottom + NW quadrant minus notch)
 *   wrap_left  : 3 rects (south band + west arm + wrap-around top)
 *   wrap_right : 3 rects (south band + east arm + wrap-around top)
 *
 * For wrap presets, the arm depth is the pergola fallback (3000mm)
 * — matches `FALLBACK_PERGOLA_DEPTH_MM` in `houseFormRawGeometry.ts`
 * so the legacy polygon and the composition union polygon agree.
 */
export function buildPresetCompositionFromHouseForm(
  houseForm: Pick<HouseFormModel, "footprint" | "roofIntent">,
): HouseComposition | null {
  if (houseForm.footprint.mode !== "preset") return null;
  if (houseForm.footprint.attachmentSide !== "rear") return null;

  const FALLBACK_PERGOLA_WIDTH_M = 6;
  const FALLBACK_PERGOLA_DEPTH_M = 3;
  const resolved = resolveHouseFootprintParams({
    params: {
      widthM: houseForm.footprint.params.widthM,
      offsetXM: houseForm.footprint.params.offsetXM,
      setbackM: houseForm.footprint.params.setbackM,
      bandDepthM: houseForm.footprint.params.bandDepthM,
      returnRunM: houseForm.footprint.params.returnRunM,
      recessWidthM: houseForm.footprint.params.recessWidthM,
      recessDepthM: houseForm.footprint.params.recessDepthM,
      leftLegRunM: houseForm.footprint.params.leftLegRunM,
      rightLegRunM: houseForm.footprint.params.rightLegRunM,
      sideRunM: houseForm.footprint.params.sideRunM,
    },
    pergolaWidthM: FALLBACK_PERGOLA_WIDTH_M,
    pergolaDepthM: FALLBACK_PERGOLA_DEPTH_M,
  });

  const widthMm = resolved.widthM * 1000;
  const bandDepthMm = resolved.bandDepthM * 1000;
  const offsetXMm = resolved.offsetXM * 1000;
  const setbackMm = resolved.setbackM * 1000;
  const returnRunMm = resolved.returnRunM * 1000;
  const recessWidthMm = resolved.recessWidthM * 1000;
  const recessDepthMm = resolved.recessDepthM * 1000;
  const leftLegRunMm = resolved.leftLegRunM * 1000;
  const rightLegRunMm = resolved.rightLegRunM * 1000;
  const sideRunMm = resolved.sideRunM * 1000;
  const armDepthMm = FALLBACK_PERGOLA_DEPTH_M * 1000;

  if (widthMm <= 0 || bandDepthMm <= 0) return null;

  // The roof intent every primitive carries. Per-primitive overrides
  // are deferred (Phase 4 vision punts on that).
  const sharedRoofIntent = deriveRectangleRoofIntent({
    houseForm,
    widthMm,
    depthMm: bandDepthMm,
  });

  function rect(input: {
    originXMm: number;
    originYMm: number;
    widthMm: number;
    depthMm: number;
  }): AxisAlignedRectangle {
    return {
      kind: "axisAlignedRectangle",
      originXMm: input.originXMm,
      originYMm: input.originYMm,
      widthMm: input.widthMm,
      depthMm: input.depthMm,
      roofIntent: sharedRoofIntent,
    };
  }

  const south = -(setbackMm + bandDepthMm);
  const north = -setbackMm;

  switch (houseForm.footprint.preset) {
    case "straight": {
      return {
        primitives: [
          rect({ originXMm: offsetXMm, originYMm: south, widthMm, depthMm: bandDepthMm }),
        ],
        joins: [],
      };
    }
    case "l_left": {
      if (returnRunMm <= 0) return null;
      return {
        primitives: [
          rect({
            originXMm: offsetXMm - bandDepthMm,
            originYMm: south,
            widthMm: widthMm + bandDepthMm,
            depthMm: bandDepthMm,
          }),
          rect({
            originXMm: offsetXMm - bandDepthMm,
            originYMm: north,
            widthMm: bandDepthMm,
            depthMm: returnRunMm,
          }),
        ],
        joins: [
          { fromPrimitiveIndex: 0, fromEdge: "north", toPrimitiveIndex: 1, toEdge: "south" },
        ],
      };
    }
    case "l_right": {
      if (returnRunMm <= 0) return null;
      return {
        primitives: [
          rect({
            originXMm: offsetXMm,
            originYMm: south,
            widthMm: widthMm + bandDepthMm,
            depthMm: bandDepthMm,
          }),
          rect({
            originXMm: offsetXMm + widthMm,
            originYMm: north,
            widthMm: bandDepthMm,
            depthMm: returnRunMm,
          }),
        ],
        joins: [
          { fromPrimitiveIndex: 0, fromEdge: "north", toPrimitiveIndex: 1, toEdge: "south" },
        ],
      };
    }
    case "u_shape": {
      if (leftLegRunMm <= 0 || rightLegRunMm <= 0) return null;
      return {
        primitives: [
          rect({
            originXMm: offsetXMm - bandDepthMm,
            originYMm: south,
            widthMm: widthMm + 2 * bandDepthMm,
            depthMm: bandDepthMm,
          }),
          rect({
            originXMm: offsetXMm - bandDepthMm,
            originYMm: north,
            widthMm: bandDepthMm,
            depthMm: leftLegRunMm,
          }),
          rect({
            originXMm: offsetXMm + widthMm,
            originYMm: north,
            widthMm: bandDepthMm,
            depthMm: rightLegRunMm,
          }),
        ],
        joins: [
          { fromPrimitiveIndex: 0, fromEdge: "north", toPrimitiveIndex: 1, toEdge: "south" },
          { fromPrimitiveIndex: 0, fromEdge: "north", toPrimitiveIndex: 2, toEdge: "south" },
        ],
      };
    }
    case "recess_left": {
      if (recessWidthMm <= 0 || recessDepthMm <= 0) return null;
      if (recessWidthMm >= widthMm) return null;
      return {
        primitives: [
          rect({
            originXMm: offsetXMm,
            originYMm: -(setbackMm + bandDepthMm + recessDepthMm),
            widthMm,
            depthMm: bandDepthMm,
          }),
          rect({
            originXMm: offsetXMm + recessWidthMm,
            originYMm: -(setbackMm + recessDepthMm),
            widthMm: widthMm - recessWidthMm,
            depthMm: recessDepthMm,
          }),
        ],
        joins: [
          { fromPrimitiveIndex: 0, fromEdge: "north", toPrimitiveIndex: 1, toEdge: "south" },
        ],
      };
    }
    case "recess_right": {
      if (recessWidthMm <= 0 || recessDepthMm <= 0) return null;
      if (recessWidthMm >= widthMm) return null;
      return {
        primitives: [
          rect({
            originXMm: offsetXMm,
            originYMm: -(setbackMm + bandDepthMm + recessDepthMm),
            widthMm,
            depthMm: bandDepthMm,
          }),
          rect({
            originXMm: offsetXMm,
            originYMm: -(setbackMm + recessDepthMm),
            widthMm: widthMm - recessWidthMm,
            depthMm: recessDepthMm,
          }),
        ],
        joins: [
          { fromPrimitiveIndex: 0, fromEdge: "north", toPrimitiveIndex: 1, toEdge: "south" },
        ],
      };
    }
    case "wrap_left": {
      if (sideRunMm <= 0 || armDepthMm <= 0) return null;
      return {
        primitives: [
          rect({
            originXMm: offsetXMm - bandDepthMm,
            originYMm: south,
            widthMm: widthMm + bandDepthMm,
            depthMm: bandDepthMm,
          }),
          rect({
            originXMm: offsetXMm - bandDepthMm,
            originYMm: north,
            widthMm: bandDepthMm,
            depthMm: armDepthMm,
          }),
          rect({
            originXMm: offsetXMm - bandDepthMm,
            originYMm: armDepthMm - setbackMm,
            widthMm: sideRunMm + bandDepthMm,
            depthMm: bandDepthMm,
          }),
        ],
        joins: [
          { fromPrimitiveIndex: 0, fromEdge: "north", toPrimitiveIndex: 1, toEdge: "south" },
          { fromPrimitiveIndex: 1, fromEdge: "north", toPrimitiveIndex: 2, toEdge: "south" },
        ],
      };
    }
    case "wrap_right": {
      if (sideRunMm <= 0 || armDepthMm <= 0) return null;
      return {
        primitives: [
          rect({
            originXMm: offsetXMm,
            originYMm: south,
            widthMm: widthMm + bandDepthMm,
            depthMm: bandDepthMm,
          }),
          rect({
            originXMm: offsetXMm + widthMm,
            originYMm: north,
            widthMm: bandDepthMm,
            depthMm: armDepthMm,
          }),
          rect({
            originXMm: offsetXMm + widthMm - sideRunMm,
            originYMm: armDepthMm - setbackMm,
            widthMm: sideRunMm + bandDepthMm,
            depthMm: bandDepthMm,
          }),
        ],
        joins: [
          { fromPrimitiveIndex: 0, fromEdge: "north", toPrimitiveIndex: 1, toEdge: "south" },
          { fromPrimitiveIndex: 1, fromEdge: "north", toPrimitiveIndex: 2, toEdge: "south" },
        ],
      };
    }
    default:
      return null;
  }
}

/**
 * Re-derive the rectangle of a single-rectangle composition from
 * the form's current footprint + roof intent. Used at the
 * normalisation boundary to keep `composition` in sync with
 * resize / roof-intent edits without requiring every commit
 * action to also touch the composition explicitly.
 *
 * Multi-rectangle compositions (Phase 4 authored) are returned
 * UNCHANGED — once a designer manually composes a multi-rectangle
 * house form, the system treats it as authored data and does not
 * overwrite it from the legacy footprint params.
 *
 * Single-rectangle compositions are treated as derived data and
 * are kept fresh from the footprint + roof intent on every
 * normalisation pass.
 */
export function syncSingleRectangleComposition(input: {
  existing: HouseComposition | null | undefined;
  houseForm: Pick<HouseFormModel, "footprint" | "roofIntent">;
}): HouseComposition | null {
  if (input.existing && input.existing.primitives.length > 1) {
    return input.existing;
  }
  return buildSingleRectangleCompositionFromHouseForm(input.houseForm);
}

/**
 * PR-WB-CUSTOM-POLY-COMPOSITION (2026-06-19): derive a synthetic
 * single-rectangle composition for a `custom_polygon` form whose
 * polygon happens to be a 4-vertex axis-aligned rectangle.
 *
 * Why this exists: the plan-view resize handles commit a custom
 * polygon (because the polygon shape changed), which switches
 * `footprint.mode` to `custom_polygon` and drops the form's
 * `composition`. The seam-icon layer's filter
 * `form.composition` then excludes the resized form from Join
 * detection — designers see no chip even when the form is flush
 * against another. This helper restores composition awareness
 * for any custom_polygon form that's structurally still a
 * rectangle, so Join / Detach UX behave consistently for
 * resize-by-drag and Add-structure flows.
 *
 * Returns null when:
 *   - mode is not `custom_polygon` (caller should use the
 *     standard `buildSingleRectangleCompositionFromHouseForm`)
 *   - polygon is not 4 vertices
 *   - polygon edges are not all axis-aligned (the polygon is a
 *     truly free-form shape, not a rectangle — composition can't
 *     model it in v1)
 *
 * The form-local frame matches `buildHouseFormFootprintPolygonMm`
 * (in `houseFormRawGeometry.ts`): `alongM → x`, `-depthM → y`.
 * Composition origin lands at (xMin, yMin) so the rectangle
 * occupies the same form-local extent the legacy walls render.
 */
export function buildSingleRectangleCompositionFromCustomPolygonForm(
  houseForm: Pick<HouseFormModel, "footprint" | "roofIntent">,
): HouseComposition | null {
  if (houseForm.footprint.mode !== "custom_polygon") return null;
  const polygon = houseForm.footprint.polygon;
  if (polygon.length !== 4) return null;
  const points = polygon.map((point) => ({
    x: Number(point.alongM) * 1000,
    y: -Number(point.depthM) * 1000,
  }));
  // Axis-aligned check: every consecutive edge must be horizontal
  // (same y) or vertical (same x), within a tiny tolerance for
  // float noise from drag-commit-encoded coordinates.
  const TOL_MM = 1;
  for (let i = 0; i < 4; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % 4]!;
    const horizontal = Math.abs(a.y - b.y) <= TOL_MM;
    const vertical = Math.abs(a.x - b.x) <= TOL_MM;
    if (!horizontal && !vertical) return null;
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const widthMm = xMax - xMin;
  const depthMm = yMax - yMin;
  if (widthMm <= 0 || depthMm <= 0) return null;
  const rectangle: AxisAlignedRectangle = {
    kind: "axisAlignedRectangle",
    originXMm: xMin,
    originYMm: yMin,
    widthMm,
    depthMm,
    roofIntent: deriveRectangleRoofIntent({
      houseForm,
      widthMm,
      depthMm,
    }),
  };
  return { primitives: [rectangle], joins: [] };
}

/**
 * PR-WB-CUSTOM-POLY-COMPOSITION (2026-06-19): unified accessor
 * the seam-icon layer + any other consumer that needs "the
 * composition for this form, for Join/Detach purposes."
 *
 * Resolution order:
 *   1. If the form has an authored `composition`, use it.
 *   2. Else if the form is a `custom_polygon` whose polygon is a
 *      4-vertex axis-aligned rectangle, synthesise a single-
 *      rectangle composition. Covers the resize-converted-form
 *      case and legacy data that happens to be a rectangle.
 *   3. Else (truly free-form polygon, or absent), return null —
 *      the form doesn't participate in seam icons.
 *
 * The returned composition is for downstream consumption only;
 * it is NOT written back to the form. Authoring composition is
 * the job of `buildSingleRectangleCompositionFromHouseForm` and
 * the Phase 3.1 normaliser sync.
 */
export function deriveSeamIconCompositionForForm(
  houseForm: Pick<HouseFormModel, "composition" | "footprint" | "roofIntent">,
): HouseComposition | null {
  if (houseForm.composition) return houseForm.composition;
  return buildSingleRectangleCompositionFromCustomPolygonForm(houseForm);
}

/**
 * Workbench roof-intent (string pitch, string-keyed terminal end
 * IDs) → geometry `RectangleRoofIntent` (number pitch, per-end
 * cap choices). Pure conversion; no domain decisions.
 *
 * For `hipped`: derives `startCap` / `endCap` from
 * `openGableEndIds` by deriving the rectangle's terminal-end IDs
 * (via `deriveHouseGableTerminalEnds`) and sorting by midpoint on
 * the ridge axis. Mirrors the start/end derivation in
 * `buildHippedHouseRoof` so the workbench → geometry round-trip
 * stays consistent.
 */
function deriveRectangleRoofIntent(input: {
  houseForm: Pick<HouseFormModel, "roofIntent">;
  widthMm: number;
  depthMm: number;
}): RectangleRoofIntent {
  const intent = input.houseForm.roofIntent;
  const pitchDeg = parsePitchDeg(intent.primaryPitchDeg);

  if (intent.form === "flat") {
    return { form: "flat" };
  }
  if (intent.form === "mono") {
    return {
      form: "mono",
      pitchDeg,
      fallDirection: normalizeFallDirection(intent.primaryFallDirection),
    };
  }
  // hipped
  const ridgeAxis: HouseRoofRidgeAxis =
    intent.ridgeAxis === "y" ? "y" : "x";
  const caps = deriveStartEndCaps({
    widthMm: input.widthMm,
    depthMm: input.depthMm,
    ridgeAxis,
    openGableEndIds: intent.openGableEndIds,
  });
  return {
    form: "hipped",
    pitchDeg,
    ridgeAxis,
    startCap: caps.startCap,
    endCap: caps.endCap,
  };
}

function deriveStartEndCaps(input: {
  widthMm: number;
  depthMm: number;
  ridgeAxis: HouseRoofRidgeAxis;
  openGableEndIds: string[];
}): { startCap: "hipped" | "open_gable"; endCap: "hipped" | "open_gable" } {
  const footprint: Polygon3 = [
    point(0, 0),
    point(input.widthMm, 0),
    point(input.widthMm, input.depthMm),
    point(0, input.depthMm),
  ];
  const openIds = new Set(input.openGableEndIds);
  const terminalEnds = deriveHouseGableTerminalEnds({
    footprint,
    ridgeAxis: input.ridgeAxis,
  });
  // Sort by midpoint on the ridge axis (matches buildHippedHouseRoof).
  const sorted = [...terminalEnds]
    .map((terminalEnd) => {
      const trailing = terminalEnd.id.match(/-(\d+)$/);
      const edgeIndex = trailing ? Number(trailing[1]) - 1 : null;
      if (edgeIndex == null || edgeIndex < 0 || edgeIndex >= footprint.length) {
        return null;
      }
      const start = footprint[edgeIndex]!;
      const end = footprint[(edgeIndex + 1) % footprint.length]!;
      const midOnRidge =
        input.ridgeAxis === "x"
          ? (start.x + end.x) / 2
          : (start.y + end.y) / 2;
      return { id: terminalEnd.id, midOnRidge };
    })
    .filter((entry): entry is { id: string; midOnRidge: number } => entry !== null)
    .sort((left, right) => left.midOnRidge - right.midOnRidge);
  const startId = sorted[0]?.id ?? null;
  const endId = sorted[sorted.length - 1]?.id ?? null;
  return {
    startCap:
      startId !== null && openIds.has(startId) ? "open_gable" : "hipped",
    endCap:
      endId !== null && endId !== startId && openIds.has(endId)
        ? "open_gable"
        : "hipped",
  };
}

function metresStringToMm(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed * 1000 : 0;
}

function parsePitchDeg(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeFallDirection(
  value: string,
): HouseRoofPrimaryFallDirection {
  switch (value) {
    case "positive_x":
    case "negative_x":
    case "positive_y":
    case "negative_y":
      return value;
    default:
      return "positive_y";
  }
}

function point(x: number, y: number): Point3 {
  return { x, y, z: 0 };
}
