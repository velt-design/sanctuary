import { describe, expect, it } from 'vitest';
import type { GeometryTopProjectionShape, GeometryTopProjectionViewModel } from '@sp/geometry';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { buildWorkbenchSolvedModel } from './workbenchSolvedModel';
import { buildProjectHouseProjectionHealth } from './projectHouseProjectionHealth';
import type { ProjectHouseGeometryEntry } from './projectHouseGeometryRegistry';

function makeShape(overrides: Partial<GeometryTopProjectionShape>): GeometryTopProjectionShape {
  return {
    id: 'shape',
    family: 'house',
    kind: 'footprint',
    sourceType: 'house_reference',
    sourceId: 'house-form-1',
    sourceObjectId: 'house-form-1',
    polygon: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
    zOrder: 0,
    metadata: {},
    ...overrides,
  } as GeometryTopProjectionShape;
}

function makeProjection(shapes: GeometryTopProjectionShape[]): GeometryTopProjectionViewModel {
  return {
    coordinateSpace: 'world_xy_mm',
    screenAxis: { x: 'world_x_right', y: 'world_y_down' },
    shapes,
    extents: {
      minX: 0,
      minY: 0,
      maxX: 1,
      maxY: 1,
      widthMm: 1,
      heightMm: 1,
    },
  };
}

function makeHouseEntry(houseFormId: string): ProjectHouseGeometryEntry {
  return {
    houseFormId,
    referenceShape: makeShape({
      id: `house_reference:${houseFormId}`,
      sourceId: houseFormId,
      sourceObjectId: houseFormId,
    }),
    geometry: {} as ProjectHouseGeometryEntry['geometry'],
    model: {
      houseId: houseFormId,
      footprint: [],
      wallSegments: [{ id: 'wall-1' }],
      roofPlanes: [{ id: 'roof-plane-1' }],
      eave: null,
    } as unknown as ProjectHouseGeometryEntry['model'],
  };
}

describe('buildProjectHouseProjectionHealth', () => {
  it('reports visible reference fallback when a house has no roof or roof-material plan body', () => {
    const health = buildProjectHouseProjectionHealth({
      houseFormIds: ['house-form-2'],
      projectHouseGeometries: [makeHouseEntry('house-form-2')],
      projectPlanProjection: makeProjection([
        makeShape({
          id: 'house_reference:house-form-2',
          sourceId: 'house-form-2',
          sourceObjectId: 'house-form-2',
        }),
      ]),
    });

    expect(health).toEqual([
      expect.objectContaining({
        houseFormId: 'house-form-2',
        referencePresent: true,
        modelPresent: true,
        wallCount: 1,
        roofPlaneCount: 1,
        roofBodyCount: 0,
        roofMaterialBodyCount: 0,
        visibleReferenceFallbackIds: ['house_reference:house-form-2'],
      }),
    ]);
  });

  it('suppresses reference fallback health when a same-house roof-material body exists', () => {
    const health = buildProjectHouseProjectionHealth({
      houseFormIds: ['house-form-2'],
      projectHouseGeometries: [makeHouseEntry('house-form-2')],
      projectPlanProjection: makeProjection([
        makeShape({
          id: 'house_reference:house-form-2',
          sourceId: 'house-form-2',
          sourceObjectId: 'house-form-2',
        }),
        makeShape({
          id: 'house_roof_material:house-form-2:0',
          kind: 'house_roof_material',
          sourceType: 'house_roof_material',
          sourceId: 'house-form-2',
          metadata: { houseFormId: 'house-form-2' },
        }),
      ]),
    });

    expect(health[0]).toEqual(
      expect.objectContaining({
        houseFormId: 'house-form-2',
        roofMaterialBodyCount: 1,
        visibleReferenceFallbackIds: [],
      }),
    );
  });

  it('is stable for the multi-house fixture across active pergola switches', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('multi-house-u-two-pergola');
    if (!fixture) throw new Error('Missing multi-house fixture.');
    const pergolaOneActive = buildWorkbenchSolvedModel({
      snapshot: fixture.snapshot,
      draft: fixture.draft,
      moduleLabels: fixture.moduleLabels,
      activePergolaId: 'pergola-1',
    });
    const pergolaTwoActive = buildWorkbenchSolvedModel({
      snapshot: fixture.snapshot,
      draft: fixture.draft,
      moduleLabels: fixture.moduleLabels,
      activePergolaId: 'pergola-2',
    });

    expect(pergolaOneActive.projectHouseProjectionHealth).toEqual(
      pergolaTwoActive.projectHouseProjectionHealth,
    );
    expect(pergolaOneActive.projectHouseProjectionHealth).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          houseFormId: 'house-main',
          roofMaterialBodyCount: expect.any(Number),
          visibleReferenceFallbackIds: [],
        }),
        expect.objectContaining({
          houseFormId: 'house-form-2',
          roofMaterialBodyCount: expect.any(Number),
          visibleReferenceFallbackIds: [],
        }),
      ]),
    );
  });
});
