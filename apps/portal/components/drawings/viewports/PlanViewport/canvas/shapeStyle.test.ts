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
      { kind: 'house_roof_material', expected: /bodyHouseRoof/ },
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

    it('maps a closed house_terminal_end (isOpen=false) to the closed marker style', () => {
      expect(
        planCommittedBodyTokenClass(
          shape({
            family: 'house',
            kind: 'house_terminal_end',
            metadata: { isOpen: false, openGableEndId: 'house-gable-end-x-2' },
          }),
        ),
      ).toMatch(/bodyHouseTerminalEndClosed/);
    });

    it('maps an open house_terminal_end (isOpen=true) to the open marker style', () => {
      expect(
        planCommittedBodyTokenClass(
          shape({
            family: 'house',
            kind: 'house_terminal_end',
            metadata: { isOpen: true, openGableEndId: 'house-gable-end-x-2' },
          }),
        ),
      ).toMatch(/bodyHouseTerminalEndOpen/);
    });

    it('treats a house_terminal_end without isOpen metadata as closed (defensive default)', () => {
      // Older or test-built shapes may omit metadata. A missing flag
      // should not blow up the styling pipeline -- default to closed.
      expect(
        planCommittedBodyTokenClass(shape({ family: 'house', kind: 'house_terminal_end' })),
      ).toMatch(/bodyHouseTerminalEndClosed/);
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
