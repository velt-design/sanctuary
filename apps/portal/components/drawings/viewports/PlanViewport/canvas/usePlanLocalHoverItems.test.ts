import { describe, expect, it } from 'vitest';
import type { GeometryTopProjectionShape } from '@sp/geometry';
import type { PlanRenderItem } from './planRenderItem';
import { buildPlanLocalHoverItems } from './usePlanLocalHoverItems';

function item(id: string): PlanRenderItem {
  return {
    shape: {
      id,
      sourceObjectId: id,
      sourceId: id,
      sourceType: 'house_reference',
      family: 'house',
      kind: 'footprint',
      polygon: [],
      zOrder: 0,
      zMin: null,
      zMax: null,
    } as GeometryTopProjectionShape,
    points: [],
    layer: 'hitTargets',
  };
}

describe('buildPlanLocalHoverItems', () => {
  it('returns the hovered hit target as explicit hover chrome', () => {
    expect(
      buildPlanLocalHoverItems({
        hoveredShape: { shapeId: 'house_reference:house-form-2', family: 'house', kind: 'footprint' },
        hitTargetItems: [item('house_reference:house-form-1'), item('house_reference:house-form-2')],
        selectionHaloItems: [],
      }).map((hoverItem) => hoverItem.shape.id),
    ).toEqual(['house_reference:house-form-2']);
  });

  it('suppresses local hover chrome for the active selection shape', () => {
    const selected = item('house_reference:house-form-2');
    expect(
      buildPlanLocalHoverItems({
        hoveredShape: { shapeId: selected.shape.id, family: 'house', kind: 'footprint' },
        hitTargetItems: [selected],
        selectionHaloItems: [selected],
      }),
    ).toEqual([]);
  });
});
