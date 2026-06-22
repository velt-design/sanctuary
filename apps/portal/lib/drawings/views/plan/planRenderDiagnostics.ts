import type { GeometryTopProjectionShape } from '@sp/geometry';
import {
  planHouseFormOwner,
  planShapeIsHouseRoofBody,
  planShapeIsVisibleHouseReferenceFallback,
} from './planShapeOwnership';
import type { ProjectionPlanGraphItem } from './planRenderGraph';

type PlanHouseRenderDiagnostics = {
  houseFormId: string;
  referenceIds: string[];
  roofBodyIds: string[];
  visibleReferenceFallbackIds: string[];
  hitTargetIds: string[];
};

type PlanRenderDiagnostics = {
  houses: PlanHouseRenderDiagnostics[];
  visibleReferenceFallbackIds: string[];
};

function ensureHouse(
  houses: Map<string, PlanHouseRenderDiagnostics>,
  houseFormId: string,
): PlanHouseRenderDiagnostics {
  const existing = houses.get(houseFormId);
  if (existing) return existing;
  const next: PlanHouseRenderDiagnostics = {
    houseFormId,
    referenceIds: [],
    roofBodyIds: [],
    visibleReferenceFallbackIds: [],
    hitTargetIds: [],
  };
  houses.set(houseFormId, next);
  return next;
}

function pushUnique(values: string[], value: string): void {
  if (!values.includes(value)) values.push(value);
}

function collectHouseShape(input: {
  houses: Map<string, PlanHouseRenderDiagnostics>;
  shape: GeometryTopProjectionShape;
  visibleCommittedBody: boolean;
  diagnosticFallback: boolean;
  hitTarget: boolean;
}): void {
  const houseFormId = planHouseFormOwner(input.shape);
  if (!houseFormId) return;
  const house = ensureHouse(input.houses, houseFormId);

  if (input.shape.sourceType === 'house_reference') {
    pushUnique(house.referenceIds, input.shape.id);
    if (input.diagnosticFallback && planShapeIsVisibleHouseReferenceFallback(input.shape)) {
      pushUnique(house.visibleReferenceFallbackIds, input.shape.id);
    }
  }
  if (input.visibleCommittedBody && planShapeIsHouseRoofBody(input.shape)) {
    pushUnique(house.roofBodyIds, input.shape.id);
  }
  if (input.hitTarget) {
    pushUnique(house.hitTargetIds, input.shape.id);
  }
}

export function buildPlanRenderDiagnostics<TItem extends { shape: GeometryTopProjectionShape }>(input: {
  committedBodies: ReadonlyArray<ProjectionPlanGraphItem<TItem>>;
  diagnosticFallbacks: ReadonlyArray<ProjectionPlanGraphItem<TItem>>;
  hitTargets: ReadonlyArray<ProjectionPlanGraphItem<TItem>>;
}): PlanRenderDiagnostics {
  const houses = new Map<string, PlanHouseRenderDiagnostics>();

  for (const item of input.committedBodies) {
    collectHouseShape({
      houses,
      shape: item.shape,
      visibleCommittedBody: true,
      diagnosticFallback: false,
      hitTarget: false,
    });
  }
  for (const item of input.diagnosticFallbacks) {
    collectHouseShape({
      houses,
      shape: item.shape,
      visibleCommittedBody: false,
      diagnosticFallback: true,
      hitTarget: false,
    });
  }
  for (const item of input.hitTargets) {
    collectHouseShape({
      houses,
      shape: item.shape,
      visibleCommittedBody: false,
      diagnosticFallback: false,
      hitTarget: true,
    });
  }

  const houseDiagnostics = Array.from(houses.values()).map((house) => ({
    ...house,
    referenceIds: house.referenceIds.sort(),
    roofBodyIds: house.roofBodyIds.sort(),
    visibleReferenceFallbackIds: house.visibleReferenceFallbackIds.sort(),
    hitTargetIds: house.hitTargetIds.sort(),
  })).sort((left, right) => left.houseFormId.localeCompare(right.houseFormId));

  return {
    houses: houseDiagnostics,
    visibleReferenceFallbackIds: houseDiagnostics
      .flatMap((house) => house.visibleReferenceFallbackIds)
      .sort(),
  };
}
