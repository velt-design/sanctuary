import { describe, expect, it } from 'vitest';
import type { GeometryTopProjectionShape } from '@sp/geometry';
import { planCommittedBodyTokenClass } from './shapeStyle';

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

describe('planCommittedBodyTokenClass', () => {
  describe('house family', () => {
    const cases: Array<{ kind: string; expected: RegExp }> = [
      { kind: 'deck', expected: /bodyHouseDeck/ },
      { kind: 'opening_marker', expected: /bodyHouseOpening/ },
      { kind: 'opening_outline', expected: /bodyHouseOpening/ },
      { kind: 'roof', expected: /bodyHouseRoof/ },
      { kind: 'soffit', expected: /bodyHouseSoffit/ },
      { kind: 'fascia', expected: /bodyHouseFascia/ },
      { kind: 'attachment_zone', expected: /bodyHouseAttachmentZone/ },
      { kind: 'footprint', expected: /bodyHouseFootprint/ },
      { kind: 'gutter', expected: /bodyHouseLine/ },
      { kind: 'roof_feature', expected: /bodyHouseLine/ },
      { kind: 'wall_segment', expected: /bodyHouseLine/ },
    ];

    for (const { kind, expected } of cases) {
      it(`maps house/${kind} to the expected token class`, () => {
        expect(planCommittedBodyTokenClass(shape({ family: 'house', kind }))).toMatch(expected);
      });
    }

    it('falls back to the reference token class for unknown house kinds', () => {
      expect(planCommittedBodyTokenClass(shape({ family: 'house', kind: 'mystery' }))).toMatch(
        /bodyReference/,
      );
    });

    it('renders visible house_reference fallbacks with the outline-only fallback token', () => {
      expect(
        planCommittedBodyTokenClass(
          shape({
            family: 'house',
            kind: 'footprint',
            sourceType: 'house_reference',
          }),
        ),
      ).toMatch(/bodyHouseReferenceFallback/);
    });

    it('keeps a hip-end facet on the standard roof style even when tagged with openGableEndId metadata', () => {
      // Milestone 13: terminal-end click targets reuse the EXISTING
      // hip facet (kind: 'roof') by tagging its metadata. The styling
      // is intentionally identical to a non-toggleable hipped roof so
      // the marker only reveals itself through explicit hover chrome.
      // The toggle vs selection split is
      // resolved by the selection router, not the shape style.
      expect(
        planCommittedBodyTokenClass(
          shape({
            family: 'house',
            kind: 'roof',
            metadata: { isOpen: false, openGableEndId: 'house-gable-end-x-2' },
          }),
        ),
      ).toMatch(/bodyHouseRoof/);
    });

    it('renders synthetic terminal-end plan projection targets transparent', () => {
      expect(
        planCommittedBodyTokenClass(
          shape({
            family: 'house',
            kind: 'roof',
            metadata: {
              isOpen: false,
              openGableEndId: 'house-gable-end-x-2',
              planProjectionSource: 'house_terminal_end',
            },
          }),
        ),
      ).toMatch(/bodyTransparent/);
    });
  });

  describe('pergola family', () => {
    const cases: Array<{ kind: string; expected: RegExp }> = [
      { kind: 'roof_cladding', expected: /bodyPergolaCladding/ },
      { kind: 'rafter', expected: /bodyPergolaRafter/ },
      { kind: 'ridge', expected: /bodyPergolaRidge/ },
      { kind: 'roof_plane', expected: /bodyPergolaRoof/ },
      { kind: 'post', expected: /bodyPergolaRoof/ },
      { kind: 'beam', expected: /bodyPergolaRoof/ },
    ];

    for (const { kind, expected } of cases) {
      it(`maps pergola/${kind} to the expected token class`, () => {
        expect(planCommittedBodyTokenClass(shape({ family: 'pergola', kind }))).toMatch(expected);
      });
    }
  });

  describe('reference family', () => {
    it('uses the reference token class', () => {
      expect(planCommittedBodyTokenClass(shape({ family: 'reference', kind: 'roof_outline' }))).toMatch(
        /bodyReference/,
      );
    });
  });
});
