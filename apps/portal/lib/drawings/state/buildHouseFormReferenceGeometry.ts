import type { HouseReferenceGeometry } from '@sp/geometry';
import type { HouseFormModel } from './objectFirstWorkbenchModel';
import { buildHouseFormGeometryInputForForm } from './houseFormGeometryInput';

/**
 * Build a freestanding `HouseReferenceGeometry` for a workbench house form.
 * Returns world-space geometry with `model` populated and `position` baked
 * into every vertex.
 *
 * The pipeline:
 *   1. Derive a footprint `Polygon3` in mm from the house form's own
 *      footprint fields. Preset-mode forms use their own preset frame;
 *      custom polygons translate alongM/depthM directly into mm.
 *   2. Map the object-first `HouseFormModel` to the package house geometry
 *      input so `buildHouseModel3DFromRawHouseInput` can produce a full
 *      `HouseModel3D` (walls + roof + envelope).
 *   3. Wrap the resulting `HouseModel3D` in a `HouseReferenceGeometry`
 *      with attachment fields null and `position` set from the form's
 *      transform.
 *   4. Bake the position into every vertex via `applyHouseReferencePosition`
 *      (PR8c-i). The returned geometry is in world coords.
 *
 * Returns `null` when `buildHouseModel3DFromRawHouseInput` can't produce
 * a model (e.g. an empty/degenerate footprint).
 */
export function buildHouseFormReferenceGeometry(input: {
  houseForm: HouseFormModel;
}): HouseReferenceGeometry | null {
  const result = buildHouseFormGeometryInputForForm(input.houseForm);
  return result.ok ? result.geometry : null;
}
