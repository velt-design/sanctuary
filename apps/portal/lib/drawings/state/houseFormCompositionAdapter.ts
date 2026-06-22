import {
  deriveHouseGableTerminalEnds,
  resolveHouseFootprintParams,
  validateHouseComposition,
  type AxisAlignedRectangle,
  type HouseComposition,
  type HouseRoofPrimaryFallDirection,
  type HouseRoofRidgeAxis,
  type Point3,
  type Polygon3,
  type RectangleRoofIntent,
} from "@sp/geometry";
import type { HouseFormRoofIntentModel } from "./objectFirstWorkbenchModel";

/**
 * PR-WB-COMPOSITION-ONLY (2026-06-19): composition is now the only
 * authoring representation of a house form's shape. This adapter
 * has two responsibilities:
 *
 *   1. NEW FORM CREATION — `buildDefaultRectangleComposition`
 *      produces a fresh single-rectangle composition for the Add
 *      structure flow.
 *
 *   2. LEGACY MIGRATION — `migrateLegacyFootprintToComposition`
 *      reads a persisted form's legacy `footprint` data (mode,
 *      preset, params, polygon) and synthesises a composition.
 *      Called by the normaliser exactly once per persisted form;
 *      the result is written back as the form's composition and
 *      the legacy fields are dropped.
 *
 * Pre-refactor the adapter had many specialised exports
 * (`buildSingleRectangleCompositionFromHouseForm`,
 * `syncSingleRectangleComposition`,
 * `buildSingleRectangleCompositionFromCustomPolygonForm`,
 * `deriveSeamIconCompositionForForm`) because composition was
 * optional and downstream consumers had to do inference on the
 * fly. Composition is now required on every form, so those
 * consumers read `form.composition` directly and the adapter
 * collapses to its two responsibilities above.
 */

const DEFAULT_RECTANGLE_WIDTH_MM = 6000;
const DEFAULT_RECTANGLE_DEPTH_MM = 4000;
const FALLBACK_PERGOLA_WIDTH_M = 6;
const FALLBACK_PERGOLA_DEPTH_M = 3;

/**
 * The shape of the legacy `footprint` sub-object as it was
 * persisted before PR-WB-COMPOSITION-ONLY. The normaliser passes
 * any persisted data through this type when migrating.
 */
export type LegacyFootprintInput = {
  mode?: string | null;
  preset?: string | null;
  params?: {
    widthM?: string;
    bandDepthM?: string;
    offsetXM?: string;
    setbackM?: string;
    returnRunM?: string;
    recessWidthM?: string;
    recessDepthM?: string;
    leftLegRunM?: string;
    rightLegRunM?: string;
    sideRunM?: string;
  } | null;
  polygon?: Array<{ alongM: string; depthM: string }> | null;
  attachmentSide?: string | null;
  position?: unknown;
};

/**
 * Build the default single-rectangle composition the Add structure
 * flow uses. The rectangle is 6m × 4m, placed in the legacy frame
 * (originY = -depth so it sits south of the pergola attachment
 * line), and carries the supplied roof intent.
 */
export function buildDefaultRectangleComposition(
  roofIntent: HouseFormRoofIntentModel,
): HouseComposition {
  const widthMm = DEFAULT_RECTANGLE_WIDTH_MM;
  const depthMm = DEFAULT_RECTANGLE_DEPTH_MM;
  const rectangle: AxisAlignedRectangle = {
    kind: "axisAlignedRectangle",
    originXMm: 0,
    originYMm: -depthMm,
    widthMm,
    depthMm,
    roofIntent: deriveRectangleRoofIntent({
      roofIntent,
      widthMm,
      depthMm,
    }),
  };
  return { primitives: [rectangle], joins: [] };
}

/**
 * One-shot legacy-to-composition migration. Tries (in order):
 *   1. existing composition (if valid, return as-is)
 *   2. preset+straight → straight rectangle from params
 *   3. preset+non-straight (l_left, u_shape, etc.) → multi-rectangle
 *      from `buildPresetCompositionFromLegacyData`
 *   4. custom_polygon with 4-vertex axis-aligned polygon → rectangle
 *   5. custom_polygon with anything else → bounding-box rectangle
 *      stamped `approximationReasons` so the rail can flag it
 *   6. nothing usable → default 6m × 4m rectangle
 *
 * Always returns a composition; designed to be called by the
 * normaliser without a null-check guard.
 */
export function migrateLegacyFootprintToComposition(input: {
  existingComposition?: HouseComposition | null | undefined;
  legacyFootprint?: LegacyFootprintInput | null | undefined;
  roofIntent: HouseFormRoofIntentModel;
}): HouseComposition {
  if (input.existingComposition) {
    const validation = validateHouseComposition(input.existingComposition);
    if (validation.ok) return input.existingComposition;
  }
  const legacy = input.legacyFootprint;
  if (legacy) {
    if (legacy.mode === "preset") {
      const preset = buildPresetCompositionFromLegacyData({
        legacyFootprint: legacy,
        roofIntent: input.roofIntent,
      });
      if (preset) return preset;
    }
    if (legacy.mode === "custom_polygon" && legacy.polygon) {
      const rect = buildRectangleFromLegacyPolygon({
        polygon: legacy.polygon,
        roofIntent: input.roofIntent,
      });
      if (rect) return rect;
      const bbox = buildBoundingBoxCompositionFromLegacyPolygon({
        polygon: legacy.polygon,
        roofIntent: input.roofIntent,
      });
      if (bbox) return bbox;
    }
  }
  return buildDefaultRectangleComposition(input.roofIntent);
}

/**
 * Internal: build a composition from a `preset` legacy footprint.
 * Mirrors `buildPresetLocalPoints` from `@sp/geometry/footprints.ts`
 * — each preset shape is expressed as a multi-rectangle
 * composition whose union polygon equals the legacy preset polygon.
 *
 * Returns null for non-rear attachment side (legacy frame math
 * verified for `rear` only). Caller falls back to defaults.
 */
function buildPresetCompositionFromLegacyData(input: {
  legacyFootprint: LegacyFootprintInput;
  roofIntent: HouseFormRoofIntentModel;
}): HouseComposition | null {
  const legacy = input.legacyFootprint;
  if (legacy.mode !== "preset") return null;
  if ((legacy.attachmentSide ?? "rear") !== "rear") return null;

  const params = legacy.params ?? {};
  const resolved = resolveHouseFootprintParams({
    params: {
      widthM: params.widthM ?? "0",
      offsetXM: params.offsetXM ?? "0",
      setbackM: params.setbackM ?? "0",
      bandDepthM: params.bandDepthM ?? "0",
      returnRunM: params.returnRunM ?? "0",
      recessWidthM: params.recessWidthM ?? "0",
      recessDepthM: params.recessDepthM ?? "0",
      leftLegRunM: params.leftLegRunM ?? "0",
      rightLegRunM: params.rightLegRunM ?? "0",
      sideRunM: params.sideRunM ?? "0",
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

  const sharedRoofIntent = deriveRectangleRoofIntent({
    roofIntent: input.roofIntent,
    widthMm,
    depthMm: bandDepthMm,
  });

  function rect(rectInput: {
    originXMm: number;
    originYMm: number;
    widthMm: number;
    depthMm: number;
  }): AxisAlignedRectangle {
    return {
      kind: "axisAlignedRectangle",
      originXMm: rectInput.originXMm,
      originYMm: rectInput.originYMm,
      widthMm: rectInput.widthMm,
      depthMm: rectInput.depthMm,
      roofIntent: sharedRoofIntent,
    };
  }

  const south = -(setbackMm + bandDepthMm);
  const north = -setbackMm;

  switch (legacy.preset) {
    case "straight":
    case null:
    case undefined:
      return {
        primitives: [
          rect({ originXMm: offsetXMm, originYMm: south, widthMm, depthMm: bandDepthMm }),
        ],
        joins: [],
      };
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
 * Internal: detect when a legacy `custom_polygon` is structurally
 * a 4-vertex axis-aligned rectangle and synthesise a single-
 * rectangle composition from it. Returns null when the polygon
 * isn't recognisably a rectangle.
 */
function buildRectangleFromLegacyPolygon(input: {
  polygon: ReadonlyArray<{ alongM: string; depthM: string }>;
  roofIntent: HouseFormRoofIntentModel;
}): HouseComposition | null {
  if (input.polygon.length !== 4) return null;
  const points = input.polygon.map((point) => ({
    x: Number(point.alongM) * 1000,
    y: -Number(point.depthM) * 1000,
  }));
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
      roofIntent: input.roofIntent,
      widthMm,
      depthMm,
    }),
  };
  return { primitives: [rectangle], joins: [] };
}

/**
 * Last-resort migration: take any legacy polygon (free-form or
 * otherwise) and build a single-rectangle composition covering
 * its bounding box. Lossy — the rendered shape no longer matches
 * the original outline. The composition is stamped
 * `approximationReasons: ['legacy_polygon_bounding_box']` so the
 * rail can surface a banner asking the designer to recreate the
 * form intentionally.
 *
 * Returns null when the polygon is degenerate (< 3 vertices or
 * collapses to zero area).
 */
function buildBoundingBoxCompositionFromLegacyPolygon(input: {
  polygon: ReadonlyArray<{ alongM: string; depthM: string }>;
  roofIntent: HouseFormRoofIntentModel;
}): HouseComposition | null {
  if (input.polygon.length < 3) return null;
  const points = input.polygon.map((point) => ({
    x: Number(point.alongM) * 1000,
    y: -Number(point.depthM) * 1000,
  }));
  const xs = points.map((p) => p.x).filter((value) => Number.isFinite(value));
  const ys = points.map((p) => p.y).filter((value) => Number.isFinite(value));
  if (xs.length < 3 || ys.length < 3) return null;
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
      roofIntent: input.roofIntent,
      widthMm,
      depthMm,
    }),
  };
  return { primitives: [rectangle], joins: [] };
}

/**
 * Workbench roof-intent (string pitch, string-keyed terminal end
 * IDs) → geometry `RectangleRoofIntent` (number pitch, per-end
 * cap choices). Pure conversion; no domain decisions.
 */
function deriveRectangleRoofIntent(input: {
  roofIntent: HouseFormRoofIntentModel;
  widthMm: number;
  depthMm: number;
}): RectangleRoofIntent {
  const intent = input.roofIntent;
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
      return "negative_y";
  }
}

function point(x: number, y: number): Point3 {
  return { x, y, z: 0 };
}
