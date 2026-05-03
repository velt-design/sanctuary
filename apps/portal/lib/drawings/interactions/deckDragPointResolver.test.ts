import { describe, expect, it, vi } from 'vitest';
import {
  isProjectionBackedDeckDrag,
  resolveDeckDragPlanPoint,
} from './deckDragPointResolver';

describe('deck drag point resolver', () => {
  it('uses only the top-projection resolver for projection-backed deck drags', () => {
    const deckPoint = { x: 1, y: 2 };
    const legacyPlanPointResolver = vi.fn(() => ({ x: 9, y: 9 }));

    expect(
      resolveDeckDragPlanPoint({
        clientX: 10,
        clientY: 20,
        projectionBackedDeckDrag: true,
        deckDragPointResolver: () => deckPoint,
        legacyPlanPointResolver,
      }),
    ).toBe(deckPoint);
    expect(legacyPlanPointResolver).not.toHaveBeenCalled();
  });

  it('blocks projection-backed deck drags when the top-projection resolver is missing', () => {
    expect(
      resolveDeckDragPlanPoint({
        clientX: 10,
        clientY: 20,
        projectionBackedDeckDrag: true,
        deckDragPointResolver: null,
        legacyPlanPointResolver: () => ({ x: 9, y: 9 }),
      }),
    ).toBeNull();
  });

  it('falls back to the legacy plan resolver for non-projection drags', () => {
    const legacyPoint = { x: 3, y: 4 };

    expect(
      resolveDeckDragPlanPoint({
        clientX: 10,
        clientY: 20,
        projectionBackedDeckDrag: false,
        deckDragPointResolver: null,
        legacyPlanPointResolver: () => legacyPoint,
      }),
    ).toBe(legacyPoint);
  });

  it('detects projection-backed drag metadata', () => {
    expect(isProjectionBackedDeckDrag({ dragSource: 'top_projection_committed' })).toBe(true);
    expect(isProjectionBackedDeckDrag({ dragCoordinateSpace: 'top_projection_world_m' })).toBe(true);
    expect(isProjectionBackedDeckDrag({ dragSource: 'legacy', dragCoordinateSpace: 'legacy_plan_m' })).toBe(false);
  });
});
