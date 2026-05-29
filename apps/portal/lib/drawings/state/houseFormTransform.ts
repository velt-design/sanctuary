import type { AssemblyPosition } from '@sp/geometry';
import type { HouseFormTransformModel } from './objectFirstWorkbenchModel';

/**
 * Convert a portal-side `HouseFormTransformModel` to the geometry-package
 * `AssemblyPosition` contract that `buildHouseReferenceGeometry` consumes via
 * `houseContext.position`. Two unit changes happen here:
 *
 *   1. `offsetXM`/`offsetYM` (metres) → `origin.x`/`origin.y` (millimetres).
 *      Geometry has always been mm-everywhere (see the "mm everywhere" contract
 *      in the workbench architecture); portal stores the offset in metres
 *      because that's the unit the user types in the rail.
 *   2. `rotationQuarterTurns` (0|1|2|3) → `rotationDeg` (multiples of 90).
 *      Portal constrains rotation to orthogonal turns so wall edges always
 *      align with the world axes; the geometry contract is fully general
 *      degrees, but PR8 only ever feeds it the discrete values.
 *
 * Lives in the portal package -- the geometry contract intentionally doesn't
 * know about portal-domain types. This converter is the bridge.
 */
export function houseFormTransformToAssemblyPosition(
  transform: HouseFormTransformModel,
): AssemblyPosition {
  return {
    origin: {
      x: transform.offsetXM * 1000,
      y: transform.offsetYM * 1000,
    },
    rotationDeg: transform.rotationQuarterTurns * 90,
  };
}

export function houseFormTransformToWorldPositionMm(
  transform: HouseFormTransformModel,
): { x: number; y: number; rotationDeg: number } {
  const position = houseFormTransformToAssemblyPosition(transform);
  return {
    x: Number(position.origin.x) || 0,
    y: Number(position.origin.y) || 0,
    rotationDeg: Number(position.rotationDeg) || 0,
  };
}
