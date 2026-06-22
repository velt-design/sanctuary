import {
  composeFootprintFromComposition,
  type Polygon3,
  type RawHouseInput,
} from '@sp/geometry';
import { houseFormTransformToAssemblyPosition } from './houseFormTransform';
import type { HouseFormModel } from './objectFirstWorkbenchModel';
import { reconcileHouseFormRoofIntentForFootprint } from './houseFormRoofIntentForFootprint';

type HouseFormRawGeometryInput = {
  rawHouse: RawHouseInput;
  footprint: Polygon3;
};

/**
 * PR-WB-COMPOSITION-ONLY (2026-06-19): polygon comes from the
 * composition's union. The pre-cleanup version dispatched on
 * `footprint.mode` (preset vs custom_polygon) and called either
 * `buildHouseFootprintPolygon` or read the stored polygon; both
 * paths are gone.
 */
function buildHouseFormFootprintPolygonMm(houseForm: HouseFormModel): Polygon3 {
  return composeFootprintFromComposition(houseForm.composition);
}

export function buildRawHouseInputFromHouseForm(houseForm: HouseFormModel): RawHouseInput {
  const reconciledHouseForm = reconcileHouseFormRoofIntentForFootprint(houseForm);
  const polygon = composeFootprintFromComposition(reconciledHouseForm.composition);
  // Translate composition's mm Polygon3 back into the workbench's
  // (alongM, depthM) vocabulary the legacy `RawHouseInput.footprintPolygon`
  // field expects. alongM = x in metres, depthM = -y in metres
  // (the y-negation convention from `buildHouseFormFootprintPolygonMm`).
  const footprintPolygon = polygon.map((point) => ({
    alongM: String(point.x / 1000),
    depthM: String(-point.y / 1000),
  }));
  return {
    houseId: reconciledHouseForm.id,
    // PR-WB-COMPOSITION-ONLY: emit the legacy raw-input shape's
    // fields with sensible defaults — the downstream geometry
    // pipeline doesn't branch on these anymore (it uses the
    // composition's union polygon directly via Phase 4a.3) but
    // the contract still includes them.
    footprintMode: 'custom_polygon',
    footprintPreset: 'straight',
    footprintParams: {
      widthM: '0', offsetXM: '0', setbackM: '0', bandDepthM: '0',
      returnRunM: '0', recessWidthM: '0', recessDepthM: '0',
      leftLegRunM: '0', rightLegRunM: '0', sideRunM: '0',
    },
    footprintPolygon,
    position: houseFormTransformToAssemblyPosition(reconciledHouseForm.transform),
    storeyMode: reconciledHouseForm.storeyMode,
    roofForm: reconciledHouseForm.roofIntent.form,
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
