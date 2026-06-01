import type { GeometryTopProjectionShape } from '@sp/geometry';
import {
  comparePlanDiagnosticFallbackItems,
  withDiagnosticFallbackLayer,
} from './planDiagnosticFallbacks';
import {
  planHouseFormOwner,
  planShapeIsHouseRoofBody,
  planShapeIsHouseRoofMaterialBody,
} from './planShapeOwnership';
import type { ProjectionPlanGraphItem } from './planRenderGraph';

function houseFootprintHasMatchingRoof(input: {
  footprint: GeometryTopProjectionShape;
  roofOwners: ReadonlySet<string>;
  hasUnownedRoof: boolean;
}): boolean {
  const owner = planHouseFormOwner(input.footprint);
  return owner ? input.roofOwners.has(owner) : input.hasUnownedRoof;
}

function houseRoofSolidHasMatchingRoofMaterial(input: {
  shape: GeometryTopProjectionShape;
  roofMaterialOwners: ReadonlySet<string>;
  hasUnownedRoofMaterial: boolean;
}): boolean {
  if (input.shape.family !== 'house') return false;
  if (input.shape.kind !== 'roof') return false;
  if (input.shape.sourceType !== 'house_surface_solid' && input.shape.sourceType !== 'house_surface') {
    return false;
  }
  const owner = planHouseFormOwner(input.shape);
  return owner ? input.roofMaterialOwners.has(owner) : input.hasUnownedRoofMaterial;
}

function visualStackRank(shape: GeometryTopProjectionShape): number {
  if (shape.family === 'pergola') return 10;
  if (shape.family === 'reference') return 15;
  if (shape.family === 'house') {
    if (shape.kind === 'deck') return 20;
    if (planShapeIsHouseRoofBody(shape)) return 30;
    if (shape.kind === 'footprint') return 35;
    return 25;
  }
  return 50;
}

function compareCommittedBodyItems<TItem extends { shape: GeometryTopProjectionShape }>(
  left: ProjectionPlanGraphItem<TItem>,
  right: ProjectionPlanGraphItem<TItem>,
): number {
  return (
    visualStackRank(left.shape) - visualStackRank(right.shape) ||
    left.shape.zOrder - right.shape.zOrder ||
    left.shape.id.localeCompare(right.shape.id)
  );
}

export function buildPlanCommittedBodyVisualStack<TItem extends { shape: GeometryTopProjectionShape }>(input: {
  committedBodies: ReadonlyArray<ProjectionPlanGraphItem<TItem>>;
  hitTargets: ReadonlyArray<ProjectionPlanGraphItem<TItem>>;
  projectionOnlyModelSpace?: boolean;
  topProjectionShapeAllowedInProjectionOnlyModel: (shape: GeometryTopProjectionShape) => boolean;
}): {
  committedBodies: Array<ProjectionPlanGraphItem<TItem>>;
  diagnosticFallbacks: Array<ProjectionPlanGraphItem<TItem>>;
  suppressedCommittedBodies: Array<ProjectionPlanGraphItem<TItem>>;
} {
  const houseRoofOwners = new Set<string>();
  const houseRoofMaterialOwners = new Set<string>();
  let hasUnownedHouseRoofCommittedBody = false;
  let hasUnownedHouseRoofMaterialBody = false;

  for (const { shape } of input.committedBodies) {
    if (!planShapeIsHouseRoofBody(shape)) continue;
    const owner = planHouseFormOwner(shape);
    if (owner) houseRoofOwners.add(owner);
    else hasUnownedHouseRoofCommittedBody = true;
    if (planShapeIsHouseRoofMaterialBody(shape)) {
      if (owner) houseRoofMaterialOwners.add(owner);
      else hasUnownedHouseRoofMaterialBody = true;
    }
  }

  const projectionOnlyAllowed = (shape: GeometryTopProjectionShape): boolean =>
    !input.projectionOnlyModelSpace || input.topProjectionShapeAllowedInProjectionOnlyModel(shape);

  const houseReferenceFallbacks = input.hitTargets
    .filter(({ shape }) => {
      if (shape.family !== 'house' || shape.kind !== 'footprint') return false;
      if (shape.sourceType !== 'house_reference') return false;
      return !houseFootprintHasMatchingRoof({
        footprint: shape,
        roofOwners: houseRoofOwners,
        hasUnownedRoof: hasUnownedHouseRoofCommittedBody,
      });
    })
    .filter(({ shape }) => projectionOnlyAllowed(shape))
    .map(withDiagnosticFallbackLayer)
    .sort(comparePlanDiagnosticFallbackItems);

  const committedBodies = input.committedBodies
    .filter(({ shape }) => {
      if (!projectionOnlyAllowed(shape)) return false;
      if (
        houseRoofSolidHasMatchingRoofMaterial({
          shape,
          roofMaterialOwners: houseRoofMaterialOwners,
          hasUnownedRoofMaterial: hasUnownedHouseRoofMaterialBody,
        })
      ) {
        return false;
      }
      return !(
        shape.family === 'house' &&
        shape.kind === 'footprint' &&
        shape.sourceType !== 'house_reference' &&
        houseFootprintHasMatchingRoof({
          footprint: shape,
          roofOwners: houseRoofOwners,
          hasUnownedRoof: hasUnownedHouseRoofCommittedBody,
        })
      );
    })
    .sort(compareCommittedBodyItems);

  return {
    committedBodies,
    diagnosticFallbacks: houseReferenceFallbacks,
    suppressedCommittedBodies: input.committedBodies.filter((item) => !committedBodies.includes(item)),
  };
}
