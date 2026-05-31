import {
  buildHouseFootprintPolygon,
  type Polygon3,
  type RawHouseInput,
} from '@sp/geometry';
import { houseFormTransformToAssemblyPosition } from './houseFormTransform';
import type { HouseFormModel } from './objectFirstWorkbenchModel';
import { reconcileHouseFormRoofIntentForFootprint } from './houseFormRoofIntentForFootprint';

/**
 * Fallback pergola dimensions used to synthesize a preset footprint for a
 * standalone house form. The preset helper still expects pergola dims; the
 * house form transform supplies world placement.
 */
const FALLBACK_PERGOLA_WIDTH_MM = 6000;
const FALLBACK_PERGOLA_DEPTH_MM = 3000;

type HouseFormRawGeometryInput = {
  rawHouse: RawHouseInput;
  footprint: Polygon3;
};

function buildHouseFormFootprintPolygonMm(houseForm: HouseFormModel): Polygon3 {
  if (houseForm.footprint.mode === 'custom_polygon') {
    return houseForm.footprint.polygon.map((point) => ({
      x: Number(point.alongM) * 1000,
      y: -Number(point.depthM) * 1000,
      z: 0,
    }));
  }
  return buildHouseFootprintPolygon({
    pergolaWidthMm: FALLBACK_PERGOLA_WIDTH_MM,
    pergolaDepthMm: FALLBACK_PERGOLA_DEPTH_MM,
    preset: houseForm.footprint.preset,
    params: houseForm.footprint.params,
    attachmentSide: houseForm.footprint.attachmentSide,
  });
}

export function buildRawHouseInputFromHouseForm(houseForm: HouseFormModel): RawHouseInput {
  const reconciledHouseForm = reconcileHouseFormRoofIntentForFootprint(houseForm);
  return {
    houseId: reconciledHouseForm.id,
    footprintMode: reconciledHouseForm.footprint.mode,
    footprintPreset: reconciledHouseForm.footprint.preset,
    footprintParams: reconciledHouseForm.footprint.params,
    footprintPolygon:
      reconciledHouseForm.footprint.mode === 'custom_polygon' ? reconciledHouseForm.footprint.polygon : null,
    position: houseFormTransformToAssemblyPosition(reconciledHouseForm.transform),
    storeyMode: reconciledHouseForm.storeyMode,
    roofForm: reconciledHouseForm.roofIntent.form,
    roofMaterial: reconciledHouseForm.roofIntent.material,
    roofPrimaryFallDirection: reconciledHouseForm.roofIntent.primaryFallDirection,
    roofRidgeAxis: reconciledHouseForm.roofIntent.ridgeAxis,
    openGableEndIds: reconciledHouseForm.roofIntent.openGableEndIds,
    attachmentStrategy: reconciledHouseForm.attachmentStrategy,
    eaveHeightM: reconciledHouseForm.eaveHeightM ?? null,
    wallHeightM: reconciledHouseForm.wallHeightM ?? null,
    roofPitchDeg: reconciledHouseForm.roofIntent.primaryPitchDeg,
    eave: {
      soffitDepthMm: reconciledHouseForm.soffitDepthMm ?? null,
      fasciaHeightMm: reconciledHouseForm.fasciaHeightMm ?? null,
      gutterWidthMm: reconciledHouseForm.gutterWidthMm ?? null,
      gutterDepthMm: reconciledHouseForm.gutterDepthMm ?? null,
      gutterProjectionMm: reconciledHouseForm.gutterProjectionMm ?? null,
      eaveOverhangMm: reconciledHouseForm.eaveOverhangMm ?? null,
    },
  };
}

export function buildHouseFormRawGeometryInput(
  houseForm: HouseFormModel,
): HouseFormRawGeometryInput | null {
  const footprint = buildHouseFormFootprintPolygonMm(houseForm);
  if (footprint.length < 3) return null;
  return {
    rawHouse: buildRawHouseInputFromHouseForm(houseForm),
    footprint,
  };
}
