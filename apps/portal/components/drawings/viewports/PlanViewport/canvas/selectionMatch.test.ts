import { describe, expect, it } from 'vitest';
import type { GeometryTopProjectionShape } from '@sp/geometry';
import type { WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import { activeObjectMatchesPlanShape } from './selectionMatch';

function shape(overrides: Partial<GeometryTopProjectionShape>): GeometryTopProjectionShape {
  return {
    id: 'shape-1',
    sourceObjectId: 'shape-1',
    sourceId: null,
    sourceType: 'house_surface',
    family: 'house',
    kind: 'footprint',
    polygon: [],
    zOrder: 0,
    zMin: null,
    zMax: null,
    ...overrides,
  };
}

function ref(family: WorkbenchObjectRef['family'], objectId: string | null = null): WorkbenchObjectRef {
  return { family, objectId };
}

describe('activeObjectMatchesPlanShape', () => {
  it('returns false when active ref is null or undefined', () => {
    expect(activeObjectMatchesPlanShape(null, shape({ kind: 'deck' }))).toBe(false);
    expect(activeObjectMatchesPlanShape(undefined, shape({ kind: 'deck' }))).toBe(false);
  });

  describe('decks family', () => {
    it('matches a house/deck shape with an identity equal to the active id', () => {
      expect(
        activeObjectMatchesPlanShape(
          ref('decks', 'deck-7'),
          shape({ family: 'house', kind: 'deck', sourceObjectId: 'deck-7' }),
        ),
      ).toBe(true);
    });

    it('matches when the identity comes from metadata.deckId rather than sourceObjectId', () => {
      expect(
        activeObjectMatchesPlanShape(
          ref('decks', 'deck-7'),
          shape({
            family: 'house',
            kind: 'deck',
            sourceObjectId: 'deck-rendered-7',
            metadata: { deckId: 'deck-7' },
          }),
        ),
      ).toBe(true);
    });

    it('does not match a non-deck shape even when the id matches', () => {
      expect(
        activeObjectMatchesPlanShape(
          ref('decks', 'deck-7'),
          shape({ family: 'house', kind: 'footprint', sourceObjectId: 'deck-7' }),
        ),
      ).toBe(false);
    });

    it('does not match when the active ref has no id', () => {
      expect(
        activeObjectMatchesPlanShape(
          ref('decks', null),
          shape({ family: 'house', kind: 'deck', sourceObjectId: 'deck-7' }),
        ),
      ).toBe(false);
    });
  });

  describe('openings family', () => {
    it('matches both opening_marker and opening_outline shapes', () => {
      const ref1 = ref('openings', 'opening-3');
      expect(
        activeObjectMatchesPlanShape(
          ref1,
          shape({ family: 'house', kind: 'opening_marker', sourceObjectId: 'opening-3' }),
        ),
      ).toBe(true);
      expect(
        activeObjectMatchesPlanShape(
          ref1,
          shape({ family: 'house', kind: 'opening_outline', sourceObjectId: 'opening-3' }),
        ),
      ).toBe(true);
    });

    it('does not match a deck shape with the same id', () => {
      expect(
        activeObjectMatchesPlanShape(
          ref('openings', 'opening-3'),
          shape({ family: 'house', kind: 'deck', sourceObjectId: 'opening-3' }),
        ),
      ).toBe(false);
    });
  });

  describe('pergolas family', () => {
    it('matches a pergola shape with a matching pergolaId in metadata', () => {
      expect(
        activeObjectMatchesPlanShape(
          ref('pergolas', 'pergola-A'),
          shape({
            family: 'pergola',
            kind: 'roof_plane',
            sourceObjectId: 'rendered-1',
            metadata: { pergolaId: 'pergola-A' },
          }),
        ),
      ).toBe(true);
    });

    it('does not match a house shape with the same id', () => {
      expect(
        activeObjectMatchesPlanShape(
          ref('pergolas', 'pergola-A'),
          shape({ family: 'house', kind: 'footprint', sourceObjectId: 'pergola-A' }),
        ),
      ).toBe(false);
    });
  });

  describe('house_forms family', () => {
    it('matches a non-deck/opening house shape when sourceType starts with house_', () => {
      expect(
        activeObjectMatchesPlanShape(
          ref('house_forms', 'house-1'),
          shape({ family: 'house', kind: 'footprint', sourceType: 'house_surface' }),
        ),
      ).toBe(true);
    });

    it('matches without a specific id when sourceType is house-derived', () => {
      expect(
        activeObjectMatchesPlanShape(
          ref('house_forms', null),
          shape({ family: 'house', kind: 'roof', sourceType: 'house_surface' }),
        ),
      ).toBe(true);
    });

    it('does not match deck or opening shapes', () => {
      const houseRef = ref('house_forms', 'house-1');
      expect(
        activeObjectMatchesPlanShape(houseRef, shape({ family: 'house', kind: 'deck' })),
      ).toBe(false);
      expect(
        activeObjectMatchesPlanShape(
          houseRef,
          shape({ family: 'house', kind: 'opening_marker' }),
        ),
      ).toBe(false);
    });
  });
});
