import type { GeometryTopProjectionViewModel } from '@sp/geometry';
import {
  planHouseFormOwner,
  planShapeIsHouseRoofBody,
  planShapeIsHouseRoofMaterialBody,
  planShapeIsVisibleHouseReferenceFallback,
} from '@/lib/drawings/views/plan/planShapeOwnership';
import type { ProjectHouseGeometryEntry } from './projectHouseGeometryRegistry';

export type ProjectHouseProjectionHealth = {
  houseFormId: string;
  referencePresent: boolean;
  modelPresent: boolean;
  wallCount: number;
  roofPlaneCount: number;
  roofBodyCount: number;
  roofMaterialBodyCount: number;
  visibleReferenceFallbackIds: string[];
  roofValidationStatus: string | null;
  roofValidationCode: string | null;
};

function pushUnique(values: string[], value: string): void {
  if (!values.includes(value)) values.push(value);
}

export function buildProjectHouseProjectionHealth(input: {
  houseFormIds: ReadonlyArray<string>;
  projectHouseGeometries: ReadonlyArray<ProjectHouseGeometryEntry>;
  projectPlanProjection: GeometryTopProjectionViewModel | null;
}): ProjectHouseProjectionHealth[] {
  const entriesByHouseFormId = new Map(
    input.projectHouseGeometries.map((entry) => [entry.houseFormId, entry]),
  );
  const healthByHouseFormId = new Map<string, ProjectHouseProjectionHealth>();

  for (const houseFormId of input.houseFormIds) {
    if (healthByHouseFormId.has(houseFormId)) continue;
    const entry = entriesByHouseFormId.get(houseFormId) ?? null;
    healthByHouseFormId.set(houseFormId, {
      houseFormId,
      referencePresent: Boolean(entry?.referenceShape),
      modelPresent: Boolean(entry?.model),
      wallCount: entry?.model.wallSegments.length ?? 0,
      roofPlaneCount: entry?.model.roofPlanes.length ?? 0,
      roofBodyCount: 0,
      roofMaterialBodyCount: 0,
      visibleReferenceFallbackIds: [],
      roofValidationStatus: null,
      roofValidationCode: null,
    });
  }

  for (const shape of input.projectPlanProjection?.shapes ?? []) {
    const houseFormId = planHouseFormOwner(shape);
    if (!houseFormId) continue;
    const entry = entriesByHouseFormId.get(houseFormId) ?? null;
    const health =
      healthByHouseFormId.get(houseFormId) ??
      {
        houseFormId,
        referencePresent: false,
        modelPresent: Boolean(entry?.model),
        wallCount: entry?.model.wallSegments.length ?? 0,
        roofPlaneCount: entry?.model.roofPlanes.length ?? 0,
        roofBodyCount: 0,
        roofMaterialBodyCount: 0,
        visibleReferenceFallbackIds: [],
        roofValidationStatus: null,
        roofValidationCode: null,
      };

    if (shape.sourceType === 'house_reference') {
      health.referencePresent = true;
    }
    if (planShapeIsHouseRoofBody(shape)) {
      health.roofBodyCount += 1;
    }
    if (planShapeIsHouseRoofMaterialBody(shape)) {
      health.roofMaterialBodyCount += 1;
    }
    healthByHouseFormId.set(houseFormId, health);
  }

  for (const shape of input.projectPlanProjection?.shapes ?? []) {
    const houseFormId = planHouseFormOwner(shape);
    if (!houseFormId || !planShapeIsVisibleHouseReferenceFallback(shape)) continue;
    const health = healthByHouseFormId.get(houseFormId);
    if (!health || health.roofBodyCount > 0 || health.roofMaterialBodyCount > 0) continue;
    pushUnique(health.visibleReferenceFallbackIds, shape.id);
  }

  return Array.from(healthByHouseFormId.values())
    .map((health) => ({
      ...health,
      visibleReferenceFallbackIds: [...health.visibleReferenceFallbackIds].sort(),
    }))
    .sort((left, right) => left.houseFormId.localeCompare(right.houseFormId));
}
