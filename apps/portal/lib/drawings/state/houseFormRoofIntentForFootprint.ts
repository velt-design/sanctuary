import {
  buildHouseFootprintPresetSideLocalPoints,
  deriveHouseGableTerminalEnds,
  getHouseRoofFormBehavior,
  type Polygon3,
} from '@sp/geometry';
import type { CalculatorHouseFootprintPolygonPoint } from '@/lib/types/calculator';
import type {
  HouseFormFootprintModel,
  HouseFormModel,
  HouseFormRoofIntentModel,
} from './objectFirstWorkbenchModel';
import { resolveDerivedRidgeAxis } from './houseRoofFormRidgeAxis';

const FALLBACK_PRESET_WIDTH_MM = 6000;
const FALLBACK_PRESET_DEPTH_MM = 3000;

function footprintLocalPolygonToGeometryPolygon(
  polygon: CalculatorHouseFootprintPolygonPoint[],
): Polygon3 {
  return polygon.map((point) => ({
    x: Number(point.alongM) * 1000,
    y: Number(point.depthM) * 1000,
    z: 0,
  }));
}

function resolveHouseFormFootprintSideLocalPolygon(input: {
  footprint: HouseFormFootprintModel;
  fallbackWidthMm?: number;
  fallbackDepthMm?: number;
}): CalculatorHouseFootprintPolygonPoint[] {
  if (input.footprint.mode === 'custom_polygon' && input.footprint.polygon.length) {
    return input.footprint.polygon;
  }
  return buildHouseFootprintPresetSideLocalPoints({
    pergolaWidthMm: input.fallbackWidthMm ?? FALLBACK_PRESET_WIDTH_MM,
    pergolaDepthMm: input.fallbackDepthMm ?? FALLBACK_PRESET_DEPTH_MM,
    preset: input.footprint.preset,
    params: input.footprint.params,
    attachmentSide: input.footprint.attachmentSide,
  }).map((point) => ({
    alongM: String(point.alongM),
    depthM: String(point.depthM),
  }));
}

export function deriveHouseFormRoofIntentForFootprint(input: {
  houseForm: Pick<HouseFormModel, 'footprint' | 'roofIntent'>;
  nextFootprint?: HouseFormFootprintModel;
  footprintPolygon?: CalculatorHouseFootprintPolygonPoint[] | null;
}): HouseFormRoofIntentModel {
  const footprint = input.nextFootprint ?? input.houseForm.footprint;
  const roofIntent = input.houseForm.roofIntent;
  const behavior = getHouseRoofFormBehavior(roofIntent.form);
  if (!behavior.controls.ridgeAxis) {
    return roofIntent.ridgeAxis === 'x' ? roofIntent : { ...roofIntent, ridgeAxis: 'x' };
  }

  const polygon =
    input.footprintPolygon && input.footprintPolygon.length > 0
      ? input.footprintPolygon
      : resolveHouseFormFootprintSideLocalPolygon({ footprint });
  const ridgeAxis = resolveDerivedRidgeAxis({
    footprintMode: footprint.mode,
    footprintPreset: footprint.preset,
    footprintParams: footprint.params,
    footprintPolygon: polygon,
  }).value;
  const terminalEndIds = new Set(
    deriveHouseGableTerminalEnds({
      footprint: footprintLocalPolygonToGeometryPolygon(polygon),
      ridgeAxis,
    }).map((end) => end.id),
  );
  const openGableEndIds = (roofIntent.openGableEndIds ?? []).filter((id) =>
    terminalEndIds.has(id),
  );

  if (
    roofIntent.ridgeAxis === ridgeAxis &&
    openGableEndIds.length === roofIntent.openGableEndIds.length
  ) {
    return roofIntent;
  }
  return {
    ...roofIntent,
    ridgeAxis,
    openGableEndIds,
  };
}

export function reconcileHouseFormRoofIntentForFootprint<T extends Pick<HouseFormModel, 'footprint' | 'roofIntent'>>(
  houseForm: T,
): T {
  const roofIntent = deriveHouseFormRoofIntentForFootprint({ houseForm });
  return roofIntent === houseForm.roofIntent
    ? houseForm
    : {
        ...houseForm,
        roofIntent,
      };
}
