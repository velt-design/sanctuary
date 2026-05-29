import {
  applyHouseReferencePosition,
  buildHouseModel3DFromRawHouseInput,
  buildHouseFootprintPolygon,
  type HouseReferenceGeometry,
  type Polygon3,
  type RawHouseInput,
} from '@sp/geometry';
import { houseFormTransformToAssemblyPosition } from './houseFormTransform';
import type { HouseFormModel } from './objectFirstWorkbenchModel';

/**
 * Fallback pergola dimensions used to synthesise a preset footprint for
 * a standalone house form. The preset helper still expects pergola dims,
 * and the house form's transform supplies world placement.
 */
const FALLBACK_PERGOLA_WIDTH_MM = 6000;
const FALLBACK_PERGOLA_DEPTH_MM = 3000;

function buildHouseFormFootprintPolygonMm(houseForm: HouseFormModel): Polygon3 {
  if (houseForm.footprint.mode === 'custom_polygon') {
    // Custom polygons are stored in `{alongM, depthM}` portal-frame.
    // Convert to `Polygon3` (mm) by lifting onto the ground plane (z=0).
    // The polygon stays in house-local coords; `applyHouseReferencePosition`
    // translates to world via the form's transform.
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

function houseFormToRawHouseInput(houseForm: HouseFormModel): RawHouseInput {
  return {
    houseId: houseForm.id,
    footprintMode: houseForm.footprint.mode,
    footprintPreset: houseForm.footprint.preset,
    footprintParams: houseForm.footprint.params,
    footprintPolygon:
      houseForm.footprint.mode === 'custom_polygon' ? houseForm.footprint.polygon : null,
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

/**
 * Build a freestanding `HouseReferenceGeometry` for a workbench house form.
 * Returns world-space geometry with `model` populated and `position` baked
 * into every vertex.
 *
 * The pipeline:
 *   1. Derive a footprint `Polygon3` in mm. Preset-mode forms go through
 *      `buildHouseFootprintPolygon` with fallback pergola dims (the
 *      preset machinery needs a frame; the form's own transform replaces
 *      pergola anchoring). Custom polygons translate alongM/depthM
 *      directly into mm.
 *   2. Map the object-first `HouseFormModel` to the geometry
 *      `RawHouseInput` so `buildHouseModel3DFromRawHouseInput` can
 *      produce a full `HouseModel3D` (walls + roof + envelope). PR-G2
 *      dropped the synthetic `pergolaContext` stub: freestanding forms
 *      now pass `pergolaAttachment: null` and the geometry package
 *      handles the attachment-edge short-circuit internally.
 *   3. Wrap the resulting `HouseModel3D` in a `HouseReferenceGeometry`
 *      with pergola-attachment fields null and `position` set from the
 *      form's transform via PR8a's converter.
 *   4. Bake the position into every vertex via `applyHouseReferencePosition`
 *      (PR8c-i). The returned geometry is in world coords.
 *
 * Returns `null` when `buildHouseModel3DFromRawHouseInput` can't produce
 * a model (e.g. an empty/degenerate footprint).
 */
export function buildHouseFormReferenceGeometry(input: {
  houseForm: HouseFormModel;
}): HouseReferenceGeometry | null {
  const footprint = buildHouseFormFootprintPolygonMm(input.houseForm);
  if (footprint.length < 3) return null;

  const rawHouse = houseFormToRawHouseInput(input.houseForm);
  const model = buildHouseModel3DFromRawHouseInput({
    rawHouse,
    footprint,
    pergolaAttachment: null,
  });
  if (!model) return null;

  const houseLocal: HouseReferenceGeometry = {
    wallPlane: null,
    fasciaLine: null,
    roofEdgeLine: null,
    soffitDepthMm: model.eave?.soffitDepthMm ?? null,
    footprint,
    model,
    attachmentTarget: null,
    position: null,
  };

  const position = houseFormTransformToAssemblyPosition(input.houseForm.transform);
  return applyHouseReferencePosition(houseLocal, position);
}
