import {
  validateHouseRoofSelection,
  type Polygon3,
} from '@sp/geometry';
import type {
  HouseModel,
  HouseRoofForm,
  HouseRoofPrimaryFallDirection,
  HouseRoofRidgeAxis,
} from './houseFirstWorkbenchModel';

/**
 * Thin wrapper over `@sp/geometry`'s `validateHouseRoofSelection` that
 * adapts the geometry-package validation result into the
 * `HouseModel['roof']['validation']` shape consumed by the workbench
 * adapter. The empty `approximationReasons` array is filled in later by
 * the adapter — that lifecycle stays in the caller so this helper
 * remains a pure projection of the validation contract.
 */
export function validateSharedRoof(input: {
  footprint: Polygon3;
  roofForm: HouseRoofForm;
  roofPrimaryFallDirection: HouseRoofPrimaryFallDirection;
  roofPrimaryFallDirectionExplicit: boolean;
  preferredMonoFallDirection: HouseRoofPrimaryFallDirection | null;
  attachmentRequiresDrainEdge: boolean;
  roofRidgeAxis: HouseRoofRidgeAxis;
  roofRidgeAxisExplicit: boolean;
  preferredRidgeAxis: HouseRoofRidgeAxis | null;
}): HouseModel['roof']['validation'] {
  const result = validateHouseRoofSelection({
    roofForm: input.roofForm,
    footprint: input.footprint,
    roofPrimaryFallDirection: input.roofPrimaryFallDirection,
    roofPrimaryFallDirectionExplicit: input.roofPrimaryFallDirectionExplicit,
    preferredMonoFallDirection: input.preferredMonoFallDirection,
    enforcePreferredMonoFallDirection: input.attachmentRequiresDrainEdge,
    roofRidgeAxis: input.roofRidgeAxis,
    roofRidgeAxisExplicit: input.roofRidgeAxisExplicit,
    preferredRidgeAxis: input.preferredRidgeAxis,
  });
  return {
    status: result.status,
    code: result.code,
    message: result.message,
    approximationReasons: [],
  };
}
