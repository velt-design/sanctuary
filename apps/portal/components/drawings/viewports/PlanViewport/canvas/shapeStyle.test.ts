import { describe, expect, it } from 'vitest';
import type { GeometryTopProjectionShape } from '@sp/geometry';
import { planCommittedBodyTokenClass, planShapeClass, planShapeClassForLayer } from './shapeStyle';

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

describe('planShapeClass', () => {
  describe('house family', () => {
    const cases: Array<{ kind: string; expected: RegExp }> = [
      { kind: 'deck', expected: /modulePlanHouseSurface.*modulePlanHouseDeck/ },
      { kind: 'opening_marker', expected: /modulePlanHouseSurface.*modulePlanHouseOpening/ },
      { kind: 'opening_outline', expected: /modulePlanHouseSurface.*modulePlanHouseOpening/ },
      { kind: 'roof', expected: /modulePlanHouseSurface.*modulePlanHouseRoof/ },
      { kind: 'house_roof_material', expected: /modulePlanHouseSurface.*modulePlanHouseRoof/ },
      { kind: 'soffit', expected: /modulePlanHouseSurface.*modulePlanHouseSoffit/ },
      { kind: 'fascia', expected: /modulePlanHouseSurface.*modulePlanHouseFascia/ },
      { kind: 'attachment_zone', expected: /modulePlanHouseSurface.*modulePlanHouseAttachmentZone/ },
      { kind: 'footprint', expected: /modulePlanHouseSurface.*modulePlanHouseFootprint/ },
      { kind: 'gutter', expected: /modulePlanHouseSurface.*modulePlanTopProjectionLine/ },
      { kind: 'roof_feature', expected: /modulePlanHouseSurface.*modulePlanTopProjectionLine/ },
      { kind: 'wall_segment', expected: /modulePlanHouseSurface.*modulePlanTopProjectionLine/ },
    ];

    for (const { kind, expected } of cases) {
      it(`maps house/${kind} to the expected class chain`, () => {
        expect(planShapeClass(shape({ family: 'house', kind }))).toMatch(expected);
      });
    }

    it('falls back to footprint+reference for unknown house kinds', () => {
      expect(planShapeClass(shape({ family: 'house', kind: 'mystery' }))).toMatch(
        /modulePlanHouseFootprint.*modulePlanTopProjectionReference/,
      );
    });
  });

  describe('pergola family', () => {
    it('maps roof_cladding to box inset', () => {
      expect(planShapeClass(shape({ family: 'pergola', kind: 'roof_cladding' }))).toMatch(
        /modulePlanBoxInset/,
      );
    });

    it('maps rafter to rafter class', () => {
      expect(planShapeClass(shape({ family: 'pergola', kind: 'rafter' }))).toMatch(
        /modulePlanRafter/,
      );
    });

    it('maps ridge to ridge band', () => {
      expect(planShapeClass(shape({ family: 'pergola', kind: 'ridge' }))).toMatch(
        /modulePlanRidgeBand/,
      );
    });

    it('falls back to primary zone for posts, beams, gutters, and joiners', () => {
      for (const kind of ['post', 'beam', 'ledger', 'gutter', 'joiner', 'roof_plane']) {
        expect(planShapeClass(shape({ family: 'pergola', kind }))).toMatch(/modulePlanPrimaryZone/);
      }
    });
  });

  describe('reference family', () => {
    it('uses the top-projection reference class', () => {
      expect(planShapeClass(shape({ family: 'reference', kind: 'roof_outline' }))).toMatch(
        /modulePlanTopProjectionReference/,
      );
    });
  });
});

describe('planShapeClassForLayer', () => {
  it('overrides committed body styling with the line class on the contextLines layer', () => {
    expect(
      planShapeClassForLayer(shape({ family: 'house', kind: 'deck' }), 'contextLines'),
    ).toMatch(/modulePlanTopProjectionLine/);
  });

  it('passes through to planShapeClass for committed body and hit-target layers', () => {
    expect(
      planShapeClassForLayer(shape({ family: 'house', kind: 'deck' }), 'committedBodies'),
    ).toMatch(/modulePlanHouseDeck/);
    expect(
      planShapeClassForLayer(shape({ family: 'house', kind: 'deck' }), 'hitTargets'),
    ).toMatch(/modulePlanHouseDeck/);
  });
});

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
