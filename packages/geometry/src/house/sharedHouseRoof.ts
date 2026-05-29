import type {
  HouseRoofForm,
  HouseRoofPrimaryFallDirection,
  HouseRoofRidgeAxis,
  Polygon3,
} from '../contracts';
import { validateHouseRoofSelection } from '../houseRoofValidation';
import { type HouseRoofBuildResult } from './_internal';
import { buildPrimaryHouseRoof, invalidHouseRoof } from './roofPrimary';

/**
 * Main entry point for building a house's roof geometry. Validates the
 * selected roof form against the footprint, then delegates to the
 * primary roof builder. PR-T8 (2026-05-29) removed the optional
 * appendage-band extension that used to layer additional roof planes
 * onto this result; the previous home for this function
 * (`packages/geometry/src/house/roofAppendages.ts`) was deleted with it.
 *
 * Kept in its own file (rather than merged into `roofPrimary.ts`)
 * because it owns the validation + invalid-roof short-circuit, which
 * is a different concern from the primary geometry build.
 */
export function buildSharedHouseRoof(input: {
  sourceFootprint: Polygon3;
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
  roofForm: HouseRoofForm;
  roofPrimaryFallDirection: HouseRoofPrimaryFallDirection;
  roofRidgeAxis: HouseRoofRidgeAxis;
  /**
   * Terminal-end ids that should render as open gables instead of hipped
   * slopes. Milestone 13 phase A: only the rectangular hipped path
   * honours this; joined / L-shape hipped roofs treat it as a no-op
   * until phase B lands. Empty/missing means all terminal ends are
   * hipped (legacy behaviour).
   */
  openTerminalEndIds?: ReadonlyArray<string> | null;
}): HouseRoofBuildResult {
  const roofSelectionValidation = validateHouseRoofSelection({
    roofForm: input.roofForm,
    footprint: input.sourceFootprint,
  });
  if (
    roofSelectionValidation.code === 'unsupported_roof_topology' ||
    roofSelectionValidation.code === 'unsupported_gable_topology' ||
    roofSelectionValidation.code === 'unsupported_hipped_topology' ||
    roofSelectionValidation.code === 'invalid_mono_fall_direction' ||
    roofSelectionValidation.code === 'invalid_ridge_axis'
  ) {
    return invalidHouseRoof({
      eavePolygon: input.eavePolygon,
      roofForm: input.roofForm,
      roofGeometry: 'rectilinear_joined_hipped',
      reason: roofSelectionValidation.code,
    });
  }

  return buildPrimaryHouseRoof({
    sourceFootprint: input.sourceFootprint,
    eavePolygon: input.eavePolygon,
    eaveHeightMm: input.eaveHeightMm,
    roofPitchDeg: input.roofPitchDeg,
    roofForm: input.roofForm,
    roofPrimaryFallDirection: input.roofPrimaryFallDirection,
    roofRidgeAxis: input.roofRidgeAxis,
    openTerminalEndIds: input.openTerminalEndIds ?? null,
  });
}
