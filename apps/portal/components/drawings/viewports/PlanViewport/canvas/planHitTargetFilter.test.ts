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

  it('keeps a hip-end roof facet tagged with openGableEndId metadata as a hit target', () => {
    // Milestone 13: roof shapes are normally decorative, but when the
    // top-projection enrichment tags a hip facet with openGableEndId
    // it becomes a click target for the open-as-gable toggle. This
    // exception is what makes the plan-view click + hover work.
    const item = makeItem('house', 'roof', 'house-roof-min-x');
    item.shape.metadata = { openGableEndId: 'house-gable-end-x-4', isOpen: false };
    expect(isPlanHitTarget(item)).toBe(true);
  });

  it('still drops a hip-end roof facet without the openGableEndId tag', () => {
    // Untagged roof facets (long along-ridge slopes, or roof shapes on
    // a non-hipped form) should still fall through to the canonical
    // house outline as before.
    expect(isPlanHitTarget(makeItem('house', 'roof'))).toBe(false);
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
