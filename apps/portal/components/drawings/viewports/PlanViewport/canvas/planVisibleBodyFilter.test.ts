import { describe, expect, it } from 'vitest';
import type { GeometryTopProjectionShape } from '@sp/geometry';
import { filterPlanVisibleBodies } from './planVisibleBodyFilter';
import type { PlanRenderItem } from './planRenderItem';

function item(
  override: Partial<GeometryTopProjectionShape> &
    Pick<GeometryTopProjectionShape, 'id' | 'family' | 'kind' | 'sourceType'>,
): PlanRenderItem {
  return {
    shape: {
      sourceObjectId: override.id,
      sourceId: override.sourceId ?? override.id,
      polygon: override.polygon ?? [],
      zOrder: override.zOrder ?? 0,
      zMin: override.zMin ?? null,
      zMax: override.zMax ?? null,
      metadata: override.metadata,
      ...override,
    } as GeometryTopProjectionShape,
    points: [],
    layer: 'committedBodies',
  };
}

describe('filterPlanVisibleBodies', () => {
  it('drops house_reference + footprint when the same house form has a roof body, so the visible stroke does not double up over the roof outline', () => {
    const items: PlanRenderItem[] = [
      item({
        id: 'roof',
        family: 'house',
        kind: 'roof',
        sourceType: 'house_surface_solid',
        metadata: { houseFormId: 'house-main' },
      }),
      item({
        id: 'house_reference:footprint',
        sourceObjectId: 'house-main',
        family: 'house',
        kind: 'footprint',
        sourceType: 'house_reference',
      }),
    ];
    expect(filterPlanVisibleBodies(items).map(({ shape }) => shape.id)).toEqual(['roof']);
  });

  it('drops house_reference + footprint when the same house form has a roof-material body', () => {
    const items: PlanRenderItem[] = [
      item({
        id: 'house_roof_material:house-form-2:roof-material',
        family: 'house',
        kind: 'house_roof_material',
        sourceType: 'house_roof_material',
        metadata: { houseFormId: 'house-form-2' },
      }),
      item({
        id: 'house_reference:house-form-2',
        sourceObjectId: 'house-form-2',
        family: 'house',
        kind: 'footprint',
        sourceType: 'house_reference',
      }),
      item({
        id: 'house_reference:house-main',
        sourceObjectId: 'house-main',
        family: 'house',
        kind: 'footprint',
        sourceType: 'house_reference',
      }),
    ];
    expect(filterPlanVisibleBodies(items).map(({ shape }) => shape.id)).toEqual([
      'house_roof_material:house-form-2:roof-material',
      'house_reference:house-main',
    ]);
  });

  it('keeps house + footprint when no roof body exists, so houses without roof geometry still render an outline', () => {
    const items: PlanRenderItem[] = [
      item({
        id: 'house_reference:footprint',
        family: 'house',
        kind: 'footprint',
        sourceType: 'house_reference',
      }),
    ];
    expect(filterPlanVisibleBodies(items).map(({ shape }) => shape.id)).toEqual([
      'house_reference:footprint',
    ]);
  });

  it('drops house + footprint shapes only for the house form that has a roof body', () => {
    const items: PlanRenderItem[] = [
      item({
        id: 'roof',
        family: 'house',
        kind: 'roof',
        sourceType: 'house_surface_solid',
        metadata: { houseFormId: 'house-main' },
      }),
      item({
        id: 'house_reference:house-main',
        sourceObjectId: 'house-main',
        family: 'house',
        kind: 'footprint',
        sourceType: 'house_reference',
      }),
      item({
        id: 'house_surface_solid:house-main-footprint',
        family: 'house',
        kind: 'footprint',
        sourceType: 'house_surface_solid',
        metadata: { houseFormId: 'house-main' },
      }),
      item({
        id: 'house_reference:house-form-2',
        sourceObjectId: 'house-form-2',
        family: 'house',
        kind: 'footprint',
        sourceType: 'house_reference',
      }),
    ];
    expect(filterPlanVisibleBodies(items).map(({ shape }) => shape.id)).toEqual([
      'roof',
      'house_reference:house-form-2',
    ]);
  });

  it('passes non-house shapes through regardless of roof presence', () => {
    const items: PlanRenderItem[] = [
      item({ id: 'roof', family: 'house', kind: 'roof', sourceType: 'house_surface_solid' }),
      item({
        id: 'pergola_reference:pergola',
        family: 'pergola',
        kind: 'outline',
        sourceType: 'pergola_reference',
      }),
      item({ id: 'deck-1', family: 'house', kind: 'deck', sourceType: 'house_surface_solid' }),
    ];
    expect(filterPlanVisibleBodies(items).map(({ shape }) => shape.id)).toEqual([
      'roof',
      'pergola_reference:pergola',
      'deck-1',
    ]);
  });
});
