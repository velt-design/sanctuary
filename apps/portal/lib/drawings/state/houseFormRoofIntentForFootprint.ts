import {
  composeFootprintFromComposition,
  deriveHouseGableTerminalEnds,
  getHouseRoofFormBehavior,
  isAxisAlignedRectangle,
  type HouseComposition,
  type HouseRoofRidgeAxis as GeoRidgeAxis,
  type Polygon3,
} from "@sp/geometry";
import type {
  HouseFormModel,
  HouseFormRoofIntentModel,
  HouseRoofRidgeAxis,
} from "./objectFirstWorkbenchModel";
import {
  resolveHouseRoofIntentForAuthorship,
  type HouseRoofIntentAuthorshipResolution,
} from "./objectFirstWorkbenchModel";

/**
 * PR-WB-COMPOSITION-ONLY (2026-06-19): roof intent reconciler
 * now derives polygon + ridge axis + terminal ends from the
 * composition directly. The pre-cleanup version branched on
 * `footprint.mode` (preset vs custom_polygon) and called the
 * legacy preset polygon builder; that footprint sub-object is
 * gone.
 *
 * Ridge axis preference:
 *   - Single-primitive composition: use the primitive's roof
 *     intent ridge axis if it's a hipped roof (mirrors what the
 *     designer authored when they typed in the rail). Otherwise
 *     default to 'x'.
 *   - Multi-primitive composition: use the form's authored
 *     roofIntent.ridgeAxis. Multi-rectangle composites are
 *     stitched, so the per-form ridge axis is the dominant signal.
 */

export type HouseFormRoofIntentForFootprintResolution =
  HouseRoofIntentAuthorshipResolution & {
    roofIntent: HouseFormRoofIntentModel;
  };

export function resolveHouseFormRoofIntentForFootprint(input: {
  houseForm: Pick<HouseFormModel, "composition" | "roofIntent"> &
    Partial<Pick<HouseFormModel, "roofIntentAuthored">>;
}): HouseFormRoofIntentForFootprintResolution {
  const authoredResolution = resolveHouseRoofIntentForAuthorship({
    roofIntent: input.houseForm.roofIntent,
    roofIntentAuthored: input.houseForm.roofIntentAuthored,
  });
  const roofIntent = authoredResolution.roofIntent;
  const behavior = getHouseRoofFormBehavior(roofIntent.form);
  if (!behavior.controls.ridgeAxis) {
    const resolvedRoofIntent =
      roofIntent.ridgeAxis === "x"
        ? roofIntent
        : { ...roofIntent, ridgeAxis: "x" as HouseRoofRidgeAxis };
    return {
      ...authoredResolution,
      roofIntent: resolvedRoofIntent,
      resolvedForm: resolvedRoofIntent.form,
    };
  }

  const composition = input.houseForm.composition;
  const polygon = composeFootprintFromComposition(composition);
  const ridgeAxis = deriveRidgeAxisFromComposition(composition, roofIntent.ridgeAxis);
  const terminalEndIds = new Set(
    deriveHouseGableTerminalEnds({
      footprint: polygon,
      ridgeAxis: ridgeAxis as GeoRidgeAxis,
    }).map((end) => end.id),
  );
  const openGableEndIds = (roofIntent.openGableEndIds ?? []).filter((id) =>
    terminalEndIds.has(id),
  );

  if (
    roofIntent.ridgeAxis === ridgeAxis &&
    openGableEndIds.length === roofIntent.openGableEndIds.length
  ) {
    return authoredResolution;
  }
  const resolvedRoofIntent = {
    ...roofIntent,
    ridgeAxis,
    openGableEndIds,
  };
  return {
    ...authoredResolution,
    roofIntent: resolvedRoofIntent,
    resolvedForm: resolvedRoofIntent.form,
  };
}

export function deriveHouseFormRoofIntentForFootprint(input: {
  houseForm: Pick<HouseFormModel, "composition" | "roofIntent"> &
    Partial<Pick<HouseFormModel, "roofIntentAuthored">>;
}): HouseFormRoofIntentModel {
  return resolveHouseFormRoofIntentForFootprint(input).roofIntent;
}

export function reconcileHouseFormRoofIntentForFootprint<
  T extends Pick<HouseFormModel, "composition" | "roofIntent"> &
    Partial<Pick<HouseFormModel, "roofIntentAuthored">>,
>(houseForm: T): T {
  const roofIntent = deriveHouseFormRoofIntentForFootprint({ houseForm });
  return roofIntent === houseForm.roofIntent
    ? houseForm
    : {
        ...houseForm,
        roofIntent,
      };
}

function deriveRidgeAxisFromComposition(
  composition: HouseComposition,
  fallback: HouseRoofRidgeAxis,
): HouseRoofRidgeAxis {
  // For single-primitive forms, use the primitive's own ridge axis
  // (this is what the designer authored). For multi-primitive
  // composites, use the form-level ridge axis.
  if (composition.primitives.length === 1) {
    const primitive = composition.primitives[0]!;
    if (isAxisAlignedRectangle(primitive)) {
      const intent = primitive.roofIntent;
      if (intent.form === "hipped") {
        return intent.ridgeAxis === "y" ? "y" : "x";
      }
    }
  }
  return fallback === "y" ? "y" : "x";
}

// Kept for compatibility — used by callers that received the
// legacy polygon shape directly.
export function legacyPolygonToGeometryPolygon(
  polygon: ReadonlyArray<{ alongM: string; depthM: string }>,
): Polygon3 {
  return polygon.map((point) => ({
    x: Number(point.alongM) * 1000,
    y: Number(point.depthM) * 1000,
    z: 0,
  }));
}
