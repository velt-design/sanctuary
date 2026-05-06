import { describe, it, expect } from 'vitest';
import type { GeometryTopProjectionShape } from '@sp/geometry';
import type { PlanRenderItem } from './planRenderItem';
import { filterPlanHitTargets, isPlanHitTarget } from './planHitTargetFilter';

function makeItem(family: string, kind: string, id = `${family}-${kind}`): PlanRenderItem {
  const shape = {
    id,
    sourceObjectId: id,
    sourceId: id,
    sourceType: 'house_surface_solid',
    family,
    kind,
    polygon: [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 1000 },
      { x: 0, y: 1000 },
    ],
    zOrder: 0,
    zMin: 0,
    zMax: 0,
    metadata: {},
  } as unknown as GeometryTopProjectionShape;
  return { shape, points: [], layer: 'committedBodies' };
}

describe('planHitTargetFilter', () => {
  it('drops decorative house kinds (roof, fascia, soffit, gutter, roof_feature, house_roof_material)', () => {
    for (const kind of ['roof', 'fascia', 'soffit', 'gutter', 'roof_feature', 'house_roof_material']) {
      expect(isPlanHitTarget(makeItem('house', kind))).toBe(false);
    }
  });

  it('keeps the canonical house footprint as a hit target', () => {
    expect(isPlanHitTarget(makeItem('house', 'footprint'))).toBe(true);
  });

  it('keeps decks, openings, walls, attachment zones', () => {
    for (const kind of ['deck', 'opening_marker', 'opening_outline', 'wall', 'wall_segment', 'attachment_zone']) {
      expect(isPlanHitTarget(makeItem('house', kind))).toBe(true);
    }
  });

  it('keeps non-house families regardless of kind', () => {
    expect(isPlanHitTarget(makeItem('pergola', 'roof_plane'))).toBe(true);
    expect(isPlanHitTarget(makeItem('pergola', 'outline'))).toBe(true);
    expect(isPlanHitTarget(makeItem('reference', 'guideline'))).toBe(true);
  });

  it('filterPlanHitTargets removes only decorative house items', () => {
    const items = [
      makeItem('house', 'footprint'),
      makeItem('house', 'roof'),
      makeItem('house', 'deck'),
      makeItem('house', 'fascia'),
      makeItem('pergola', 'outline'),
    ];
    const filtered = filterPlanHitTargets(items);
    expect(filtered.map((item) => `${item.shape.family}:${item.shape.kind}`)).toEqual([
      'house:footprint',
      'house:deck',
      'pergola:outline',
    ]);
  });
});
