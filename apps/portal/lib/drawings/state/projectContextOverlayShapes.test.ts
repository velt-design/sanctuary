import { describe, expect, it } from 'vitest';
import type { GeometryTopProjectionShape } from '@sp/geometry';
import { buildProjectContextOverlayShapes } from './workbenchSolvedModel';

function shape(overrides: Partial<GeometryTopProjectionShape>): GeometryTopProjectionShape {
  return {
    id: 'shape',
    sourceObjectId: 'source',
    sourceId: 'source',
    sourceType: 'pergola_reference',
    family: 'pergola',
    kind: 'outline',
    polygon: [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 1000 },
      { x: 0, y: 1000 },
    ],
    zOrder: 1,
    zMin: 0,
    zMax: 0,
    metadata: { isCanonicalOutline: true },
    ...overrides,
  };
}

describe('buildProjectContextOverlayShapes (step 5d Option A)', () => {
  // The active module's topProjection already renders the active pergola
  // (full detail) and the house reference. This filter trims the project
  // reference shape list to ONLY the shapes the overlay should add — i.e.
  // outlines of OTHER pergolas. The active pergola's outline and the
  // house reference are dropped to avoid double rendering.

  it('drops the house_reference (active artifact already renders it)', () => {
    const result = buildProjectContextOverlayShapes({
      projectReferenceShapes: [
        shape({
          id: 'house_reference:house-form-A',
          sourceType: 'house_reference',
          family: 'house',
          kind: 'footprint',
          sourceObjectId: 'house-form-A',
        }),
        shape({
          id: 'pergola_reference:pergola-1',
          sourceObjectId: 'pergola-1',
        }),
      ],
      activePergolaSourceId: 'pergola-1',
    });
    expect(result).toEqual([]);
  });

  it("drops the active pergola's own outline", () => {
    const result = buildProjectContextOverlayShapes({
      projectReferenceShapes: [
        shape({ id: 'pergola_reference:pergola-1', sourceObjectId: 'pergola-1' }),
        shape({ id: 'pergola_reference:pergola-2', sourceObjectId: 'pergola-2' }),
      ],
      activePergolaSourceId: 'pergola-1',
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.sourceObjectId).toBe('pergola-2');
  });

  it('keeps all non-active pergola outlines for the overlay', () => {
    const result = buildProjectContextOverlayShapes({
      projectReferenceShapes: [
        shape({
          id: 'house_reference:house-form-A',
          sourceType: 'house_reference',
          family: 'house',
          kind: 'footprint',
          sourceObjectId: 'house-form-A',
        }),
        shape({ id: 'pergola_reference:pergola-1', sourceObjectId: 'pergola-1' }),
        shape({ id: 'pergola_reference:pergola-2', sourceObjectId: 'pergola-2' }),
        shape({ id: 'pergola_reference:pergola-3', sourceObjectId: 'pergola-3' }),
      ],
      activePergolaSourceId: 'pergola-2',
    });
    expect(result.map((s) => s.sourceObjectId)).toEqual(['pergola-1', 'pergola-3']);
  });

  it('returns all pergola outlines (still excluding house) when active pergola id is null', () => {
    // No active pergola — the overlay shows ALL pergola outlines.
    const result = buildProjectContextOverlayShapes({
      projectReferenceShapes: [
        shape({
          id: 'house_reference:house-form-A',
          sourceType: 'house_reference',
          family: 'house',
          kind: 'footprint',
          sourceObjectId: 'house-form-A',
        }),
        shape({ id: 'pergola_reference:pergola-1', sourceObjectId: 'pergola-1' }),
        shape({ id: 'pergola_reference:pergola-2', sourceObjectId: 'pergola-2' }),
      ],
      activePergolaSourceId: null,
    });
    expect(result.map((s) => s.sourceObjectId)).toEqual(['pergola-1', 'pergola-2']);
  });

  it('returns an empty array when input is empty', () => {
    expect(
      buildProjectContextOverlayShapes({
        projectReferenceShapes: [],
        activePergolaSourceId: 'pergola-1',
      }),
    ).toEqual([]);
  });

  it('preserves shape order and metadata for the kept shapes', () => {
    const inputShapes = [
      shape({ id: 'pergola_reference:p2', sourceObjectId: 'p2', zOrder: 2 }),
      shape({ id: 'pergola_reference:p3', sourceObjectId: 'p3', zOrder: 3 }),
      shape({ id: 'pergola_reference:p1', sourceObjectId: 'p1', zOrder: 1 }),
    ];
    const result = buildProjectContextOverlayShapes({
      projectReferenceShapes: inputShapes,
      activePergolaSourceId: 'p1',
    });
    // Order preserved (no re-sorting).
    expect(result.map((s) => s.sourceObjectId)).toEqual(['p2', 'p3']);
    // Metadata preserved.
    for (const s of result) {
      expect(s.metadata?.isCanonicalOutline).toBe(true);
    }
  });
});
