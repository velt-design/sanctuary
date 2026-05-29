import {
  applyHouseReferencePosition,
  buildHouseModel3DFromRawHouseInput,
  type HouseReferenceGeometry,
} from '@sp/geometry';
import { houseFormTransformToAssemblyPosition } from './houseFormTransform';
import type { HouseFormModel } from './objectFirstWorkbenchModel';
import { buildHouseFormRawGeometryInput } from './houseFormRawGeometry';

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
  const rawGeometry = buildHouseFormRawGeometryInput(input.houseForm);
  if (!rawGeometry) return null;

  const model = buildHouseModel3DFromRawHouseInput({
    rawHouse: rawGeometry.rawHouse,
    footprint: rawGeometry.footprint,
    pergolaAttachment: null,
  });
  if (!model) return null;

  const houseLocal: HouseReferenceGeometry = {
    wallPlane: null,
    fasciaLine: null,
    roofEdgeLine: null,
    soffitDepthMm: model.eave?.soffitDepthMm ?? null,
    footprint: rawGeometry.footprint,
    model,
    attachmentTarget: null,
    position: null,
  };

  const position = houseFormTransformToAssemblyPosition(input.houseForm.transform);
  return applyHouseReferencePosition(houseLocal, position);
}
