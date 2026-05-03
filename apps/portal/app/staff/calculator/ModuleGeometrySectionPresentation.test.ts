import { describe, expect, it } from 'vitest';
import type { GeometrySectionViewModel } from '@sp/geometry';
import { DEFAULT_ESTIMATE_DRAWING_SCALE } from '@/lib/estimates/drawingSheet';
import {
  buildGeometrySectionPresentation,
  getGeometrySectionRealExtents,
} from './ModuleGeometrySectionPresentation';

function makeGeometrySectionFixture(overrides: Partial<GeometrySectionViewModel> = {}): GeometrySectionViewModel {
  const base: GeometrySectionViewModel = {
    family: 'mono',
    connectionType: 'soffit',
    sectionKind: 'mono',
    roofForm: {
      mono: true,
      gable: false,
      box: false,
    },
    sliceXMm: 3000,
    baseline: {
      start: { x: 0, y: 0 },
      end: { x: 3000, y: 0 },
    },
    house: {
      referenceLine: {
        start: { x: 0, y: 0 },
        end: { x: 0, y: 2400 },
      },
      surfaces: [
        {
          id: 'house-wall-section',
          kind: 'wall',
          boundary: [
            { x: -450, y: 0 },
            { x: 0, y: 0 },
            { x: 0, y: 2600 },
            { x: -450, y: 2600 },
          ],
        },
      ],
      lines: [
        {
          id: 'house-attachment-target',
          kind: 'attachment_target',
          line: {
            start: { x: 0, y: 2400 },
            end: { x: 650, y: 2400 },
          },
        },
      ],
    },
    members: {
      posts: [
        {
          id: 'outer-post',
          role: 'post',
          projection: {
            start: { x: 3000, y: 0 },
            end: { x: 3000, y: 2100 },
          },
          profile: { shape: 'rectangular', widthMm: 90, depthMm: 90, profileKey: '90x90' },
        },
      ],
      ledgers: [
        {
          id: 'house-ledger',
          role: 'ledger',
          projection: {
            start: { x: 0, y: 2400 },
            end: { x: 150, y: 2400 },
          },
          profile: { shape: 'rectangular', widthMm: 50, depthMm: 100, profileKey: '50x100' },
        },
      ],
      supportBeams: [],
      gutters: [],
      rafters: [
        {
          id: 'section-rafter',
          role: 'rafter',
          projection: {
            start: { x: 150, y: 2470 },
            end: { x: 2900, y: 2170 },
          },
          profile: { shape: 'rectangular', widthMm: 50, depthMm: 150, profileKey: '50x150' },
        },
      ],
      ridge: [],
      joiners: [],
    },
    surfaces: {
      roofPlanes: [
        {
          id: 'section-roof-plane',
          kind: 'roof_plane',
          line: {
            start: { x: 0, y: 2470 },
            end: { x: 3000, y: 2170 },
          },
        },
      ],
      roofCladding: [],
    },
    anchors: {
      span: {
        start: { x: 0, y: 0 },
        end: { x: 3000, y: 0 },
      },
      leftEdgeHeight: {
        point: { x: 0, y: 2400 },
        valueMm: 2400,
      },
      rightEdgeHeight: {
        point: { x: 3000, y: 2100 },
        valueMm: 2100,
      },
      ridgeHeight: null,
      pitch: {
        point: { x: 1500, y: 2600 },
        degrees: 5,
        fallDirection: 'negativeY',
      },
    },
    metrics: {
      spanMm: 3000,
      leftEdgeHeightMm: 2400,
      rightEdgeHeightMm: 2100,
      ridgeHeightMm: null,
      pitchDeg: 5,
      boxRiseMm: null,
    },
    extents: {
      minProjectionMm: -450,
      maxProjectionMm: 3000,
      minHeightMm: 0,
      maxHeightMm: 2600,
    },
  };

  return { ...base, ...overrides };
}

describe('buildGeometrySectionPresentation', () => {
  it('maps geometry section extents, members, roof lines, and house context into SVG presentation data', () => {
    const section = makeGeometrySectionFixture();
    const presentation = buildGeometrySectionPresentation({
      section,
      presentation: 'sheet',
      drawingScale: DEFAULT_ESTIMATE_DRAWING_SCALE,
    });

    expect(presentation.source).toBe('solved_geometry');
    expect(presentation.sectionKind).toBe('mono');
    expect(presentation.scale).toBeGreaterThan(0);
    expect(presentation.members.map((member) => member.id)).toContain('section-rafter');
    expect(presentation.roofLines).toHaveLength(1);
    expect(presentation.houseSurfaces).toHaveLength(1);
    expect(presentation.houseLines[0]?.kind).toBe('attachment_target');
    expect(presentation.dimensions.span.label).toBe('3.00m');
    expect(presentation.dimensions.leftHeight?.label).toBe('2.40m');
    expect(presentation.dimensions.pitch?.label).toBe('Pitch 5.0 deg');
    expect(presentation.outlines.annotatedBounds).not.toBeNull();
  });

  it('preserves geometry extents in metres without consulting legacy section models', () => {
    expect(getGeometrySectionRealExtents(makeGeometrySectionFixture())).toMatchObject({
      minProjectionM: -0.45,
      maxProjectionM: 3,
      widthM: 3.45,
      maxHeightM: 2.6,
    });
  });
});
