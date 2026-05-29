import {
  buildHouseFootprintPolygon,
  type Polygon3,
  type RawHouseInput,
} from '@sp/geometry';
import { houseFormTransformToAssemblyPosition } from './houseFormTransform';
import type { HouseFormModel } from './objectFirstWorkbenchModel';

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
  return {
    houseId: houseForm.id,
    footprintMode: houseForm.footprint.mode,
    footprintPreset: houseForm.footprint.preset,
    footprintParams: houseForm.footprint.params,
    footprintPolygon:
      houseForm.footprint.mode === 'custom_polygon' ? houseForm.footprint.polygon : null,
    position: houseFormTransformToAssemblyPosition(houseForm.transform),
    storeyMode: houseForm.storeyMode,
    roofForm: houseForm.roofIntent.form,
    roofMaterial: houseForm.roofIntent.material,
    roofPrimaryFallDirection: houseForm.roofIntent.primaryFallDirection,
    roofRidgeAxis: houseForm.roofIntent.ridgeAxis,
    openGableEndIds: houseForm.roofIntent.openGableEndIds,
    attachmentStrategy: houseForm.attachmentStrategy,
    eaveHeightM: houseForm.eaveHeightM ?? null,
    wallHeightM: houseForm.wallHeightM ?? null,
    roofPitchDeg: houseForm.roofIntent.primaryPitchDeg,
    eave: {
      soffitDepthMm: houseForm.soffitDepthMm ?? null,
      fasciaHeightMm: houseForm.fasciaHeightMm ?? null,
      gutterWidthMm: houseForm.gutterWidthMm ?? null,
      gutterDepthMm: houseForm.gutterDepthMm ?? null,
      gutterProjectionMm: houseForm.gutterProjectionMm ?? null,
      eaveOverhangMm: houseForm.eaveOverhangMm ?? null,
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
