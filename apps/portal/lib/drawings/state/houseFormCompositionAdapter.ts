import {
  deriveHouseGableTerminalEnds,
  type AxisAlignedRectangle,
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
  if (houseForm.footprint.mode !== "preset") return null;
  if (houseForm.footprint.preset !== "straight") return null;

  const widthMm = metresStringToMm(houseForm.footprint.params.widthM);
  const depthMm = metresStringToMm(houseForm.footprint.params.bandDepthM);
  if (widthMm <= 0 || depthMm <= 0) return null;

  // PR-COMP-PHASE4b followup (2026-06-19): match the legacy preset
  // polygon's form-local frame. For `attachmentSide: 'rear'` (the
  // default), `houseFootprintSideLocalPointToWorld` in
  // `@sp/geometry/footprints.ts` places the preset rectangle at
  // world coordinates:
  //   x ∈ [offsetXM,            offsetXM + widthM]
  //   y ∈ [-(setbackM + depthM), -setbackM]
  // i.e. the rectangle occupies the -Y half-plane (south of the
  // pergola attachment axis). If we leave originYMm = 0 here, the
  // composition rectangle sits at y ∈ [0, +depth] — opposite half-
  // plane — and the composition-driven roof renders ~depth metres
  // away from the legacy walls (visible as a roof translated south
  // off the house body, and Join chips at the wrong screen position).
  // Aligning origin to the legacy frame restores positional truth
  // for both the roof swap (Phase 3.2 / 4a.3) and the seam-icon
  // overlay (Phase 4b.3).
  const offsetXMm = metresStringToMm(houseForm.footprint.params.offsetXM);
  const setbackMm = metresStringToMm(houseForm.footprint.params.setbackM);
  const rectangle: AxisAlignedRectangle = {
    kind: "axisAlignedRectangle",
    originXMm: offsetXMm,
    originYMm: -(setbackMm + depthMm),
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
