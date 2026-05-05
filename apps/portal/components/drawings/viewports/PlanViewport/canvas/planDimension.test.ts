import { describe, expect, it } from 'vitest';
import type { GeometryTopProjectionViewModel } from '@sp/geometry';
import { buildTopProjectionPlanCoordinateAdapter } from '@/lib/drawings/views/plan/planCoordinateAdapter';
import {
  DEFAULT_DIMENSION_OFFSET_MM,
  buildEdgeDimensions,
  buildSelectionDimensions,
  buildSliceDimensions,
  extractAxisSlices,
  formatDimensionLengthMm,
  isRectilinearPolygon,
  resolvePlanDimensionGeometry,
  type PlanDimension,
} from './planDimension';
import { resolvePlanLayout } from './planLayout';

function makeProjection(
  overrides: Partial<GeometryTopProjectionViewModel> = {},
): GeometryTopProjectionViewModel {
  return {
    coordinateSpace: 'world_xy_mm',
    screenAxis: { x: 'world_x_right', y: 'world_y_down' },
    extents: {
      minX: 0,
      minY: 0,
      maxX: 5000,
      maxY: 3000,
      widthMm: 5000,
      heightMm: 3000,
    },
    shapes: [],
    ...overrides,
  };
}

function buildAdapter(projection = makeProjection()) {
  const layout = resolvePlanLayout(projection);
  return buildTopProjectionPlanCoordinateAdapter({
    projection,
    baseX: layout.baseX,
    baseY: layout.baseY,
    scale: layout.scale,
  });
}

const HORIZONTAL_DIM: PlanDimension = {
  id: 'dim-horizontal',
  start: { x: 0, y: 0 },
  end: { x: 2000, y: 0 },
};

describe('formatDimensionLengthMm', () => {
  it('rounds to whole millimetres', () => {
    expect(formatDimensionLengthMm(2399.6)).toBe('2400');
    expect(formatDimensionLengthMm(2399.4)).toBe('2399');
  });
});

describe('resolvePlanDimensionGeometry', () => {
  it('returns null for a zero-length dimension', () => {
    const adapter = buildAdapter();
    const result = resolvePlanDimensionGeometry(
      { id: 'd', start: { x: 100, y: 100 }, end: { x: 100, y: 100 } },
      adapter,
    );
    expect(result).toBeNull();
  });

  it('places the dim line offset perpendicular to the start-end axis', () => {
    const adapter = buildAdapter();
    const result = resolvePlanDimensionGeometry(HORIZONTAL_DIM, adapter);
    expect(result).not.toBeNull();
    const geometry = result!;

    // For a horizontal segment going +x, the perpendicular normal points +y
    // (atan2 of (dy, dx)=( -dy,  dx)/len → ( 0, 1)). With y_down screen axis,
    // the SVG y of the dim-line endpoints should be greater than the extension
    // start (since we offset by +y in projection mm).
    expect(geometry.dimLine.from.y).toBeGreaterThan(geometry.extensionStart.from.y);
    expect(geometry.dimLine.to.y).toBeGreaterThan(geometry.extensionEnd.from.y);
    // The dim line should be parallel to the original segment in SVG space.
    expect(geometry.dimLine.from.y).toBeCloseTo(geometry.dimLine.to.y);
  });

  it('extension lines connect input endpoints to the offset dim line', () => {
    const adapter = buildAdapter();
    const geometry = resolvePlanDimensionGeometry(HORIZONTAL_DIM, adapter)!;
    expect(geometry.extensionStart.from).toEqual(adapter.projectionToSvg({ x: 0, y: 0 }));
    expect(geometry.extensionStart.to).toEqual(geometry.dimLine.from);
    expect(geometry.extensionEnd.from).toEqual(adapter.projectionToSvg({ x: 2000, y: 0 }));
    expect(geometry.extensionEnd.to).toEqual(geometry.dimLine.to);
  });

  it('uses an explicit label when provided', () => {
    const adapter = buildAdapter();
    const geometry = resolvePlanDimensionGeometry(
      { ...HORIZONTAL_DIM, label: 'A' },
      adapter,
    )!;
    expect(geometry.label).toBe('A');
  });

  it('defaults the label to the rounded length in mm', () => {
    const adapter = buildAdapter();
    const geometry = resolvePlanDimensionGeometry(HORIZONTAL_DIM, adapter)!;
    expect(geometry.label).toBe('2000');
    expect(geometry.lengthMm).toBe(2000);
  });

  it('honours an explicit offsetMm', () => {
    const adapter = buildAdapter();
    const customOffset = 600;
    const geometry = resolvePlanDimensionGeometry(
      { ...HORIZONTAL_DIM, offsetMm: customOffset },
      adapter,
    )!;
    const defaultGeometry = resolvePlanDimensionGeometry(HORIZONTAL_DIM, adapter)!;
    const customDelta = geometry.dimLine.from.y - geometry.extensionStart.from.y;
    const defaultDelta = defaultGeometry.dimLine.from.y - defaultGeometry.extensionStart.from.y;
    expect(customDelta / defaultDelta).toBeCloseTo(customOffset / DEFAULT_DIMENSION_OFFSET_MM);
  });

  it('keeps the label rotation within readable range [-90, 90]', () => {
    const adapter = buildAdapter();
    const upsideDown: PlanDimension = {
      id: 'flip',
      start: { x: 2000, y: 0 },
      end: { x: 0, y: 0 },
    };
    const geometry = resolvePlanDimensionGeometry(upsideDown, adapter)!;
    expect(geometry.labelRotationDeg).toBeGreaterThanOrEqual(-90);
    expect(geometry.labelRotationDeg).toBeLessThanOrEqual(90);
  });
});

describe('buildSelectionDimensions', () => {
  it('returns an empty list when no items are selected', () => {
    expect(buildSelectionDimensions([])).toEqual([]);
  });

  it('emits one width + height pair around the bounding box of a single item', () => {
    const dims = buildSelectionDimensions([
      {
        id: 'pergola-1',
        polygon: [
          { x: 0, y: 0 },
          { x: 4500, y: 0 },
          { x: 4500, y: 8000 },
          { x: 0, y: 8000 },
        ],
      },
    ]);
    expect(dims).toHaveLength(2);
    expect(dims[0]?.id).toBe('selection:width');
    expect(dims[0]?.start).toEqual({ x: 0, y: 0 });
    expect(dims[0]?.end).toEqual({ x: 4500, y: 0 });
    expect(dims[1]?.id).toBe('selection:height');
    expect(dims[1]?.start).toEqual({ x: 0, y: 8000 });
    expect(dims[1]?.end).toEqual({ x: 0, y: 0 });
  });

  it('unions multiple items into a single width + height pair around the merged bbox', () => {
    const dims = buildSelectionDimensions([
      {
        id: 'a',
        polygon: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
        ],
      },
      {
        id: 'b',
        polygon: [
          { x: 1000, y: 1000 },
          { x: 1500, y: 1000 },
          { x: 1500, y: 1300 },
          { x: 1000, y: 1300 },
        ],
      },
    ]);
    expect(dims).toHaveLength(2);
    expect(dims[0]?.id).toBe('selection:width');
    expect(dims[0]?.start).toEqual({ x: 0, y: 0 });
    expect(dims[0]?.end).toEqual({ x: 1500, y: 0 });
    expect(dims[1]?.id).toBe('selection:height');
    expect(dims[1]?.start).toEqual({ x: 0, y: 1300 });
    expect(dims[1]?.end).toEqual({ x: 0, y: 0 });
  });

  it('ignores items whose polygon has no extent and unions the rest', () => {
    const dims = buildSelectionDimensions([
      { id: 'degenerate', polygon: [{ x: 100, y: 100 }, { x: 100, y: 100 }] },
      {
        id: 'real',
        polygon: [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
          { x: 1000, y: 500 },
          { x: 0, y: 500 },
        ],
      },
    ]);
    expect(dims.map((dim) => dim.id)).toEqual(['selection:width', 'selection:height']);
    expect(dims[0]?.end).toEqual({ x: 1000, y: 0 });
  });

  it('returns an empty list when the unioned bbox has zero extent', () => {
    expect(
      buildSelectionDimensions([
        { id: 'a', polygon: [{ x: 100, y: 100 }, { x: 100, y: 100 }] },
        { id: 'b', polygon: [{ x: 100, y: 100 }, { x: 100, y: 100 }] },
      ]),
    ).toEqual([]);
  });

  describe('with an active family', () => {
    const HOUSE_FOOTPRINT_RECT = {
      id: 'house-footprint',
      family: 'house',
      kind: 'footprint',
      polygon: [
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
        { x: 4000, y: 3000 },
        { x: 0, y: 3000 },
      ],
    };

    it('emits slice dims for a rectilinear primary edit polygon (one chain per side)', () => {
      const dims = buildSelectionDimensions([HOUSE_FOOTPRINT_RECT], 'house_forms');
      expect(dims).toHaveLength(4);
      expect(dims.map((dim) => dim.id)).toEqual([
        'house-footprint:slice:x:top:0-4000',
        'house-footprint:slice:x:bottom:0-4000',
        'house-footprint:slice:y:left:0-3000',
        'house-footprint:slice:y:right:0-3000',
      ]);
    });

    it('emits slice + total dims on every side for a U-shape footprint', () => {
      const dims = buildSelectionDimensions(
        [
          {
            id: 'u-house',
            family: 'house',
            kind: 'footprint',
            polygon: [
              { x: 0, y: 0 },
              { x: 6000, y: 0 },
              { x: 6000, y: 4000 },
              { x: 4000, y: 4000 },
              { x: 4000, y: 1500 },
              { x: 2000, y: 1500 },
              { x: 2000, y: 4000 },
              { x: 0, y: 4000 },
            ],
          },
        ],
        'house_forms',
      );
      const ids = dims.map((dim) => dim.id);
      expect(ids).toEqual([
        'u-house:slice:x:top:0-2000',
        'u-house:slice:x:bottom:0-2000',
        'u-house:slice:x:top:2000-4000',
        'u-house:slice:x:bottom:2000-4000',
        'u-house:slice:x:top:4000-6000',
        'u-house:slice:x:bottom:4000-6000',
        'u-house:total:x:top',
        'u-house:total:x:bottom',
        'u-house:slice:y:left:0-1500',
        'u-house:slice:y:right:0-1500',
        'u-house:slice:y:left:1500-4000',
        'u-house:slice:y:right:1500-4000',
        'u-house:total:y:left',
        'u-house:total:y:right',
      ]);
    });

    it('falls back to per-edge dims for a non-rectilinear edit polygon', () => {
      const rotatedTriangle = {
        id: 'tri',
        family: 'pergola',
        kind: 'roof_plane',
        polygon: [
          { x: 0, y: 0 },
          { x: 1000, y: 100 },
          { x: 500, y: 800 },
        ],
      };
      const dims = buildSelectionDimensions([rotatedTriangle], 'pergolas');
      expect(dims.every((dim) => dim.id.startsWith('tri:edge:'))).toBe(true);
      expect(dims).toHaveLength(3);
    });

    it('derives slice dims from merged halo vertices when no primary edit polygon exists', () => {
      const dims = buildSelectionDimensions(
        [
          {
            id: 'roof-1',
            family: 'house',
            kind: 'roof',
            polygon: [
              { x: 0, y: 0 },
              { x: 2000, y: 0 },
              { x: 1000, y: 1000 },
            ],
          },
          {
            id: 'roof-2',
            family: 'house',
            kind: 'roof',
            polygon: [
              { x: 2000, y: 0 },
              { x: 4000, y: 0 },
              { x: 3000, y: 1000 },
            ],
          },
        ],
        'house_forms',
      );
      const ids = dims.map((dim) => dim.id);
      expect(ids).toContain('selection-merged:slice:x:top:0-1000');
      expect(ids).toContain('selection-merged:slice:x:top:1000-2000');
      expect(ids).toContain('selection-merged:slice:x:top:2000-3000');
      expect(ids).toContain('selection-merged:slice:x:top:3000-4000');
      expect(ids).toContain('selection-merged:total:x:top');
      expect(ids).toContain('selection-merged:slice:x:bottom:0-1000');
      expect(ids).toContain('selection-merged:total:x:bottom');
    });

    it('falls back to bounding-box dims when merged halo would produce too many slices', () => {
      const noisyItems = Array.from({ length: 12 }).map((_, i) => ({
        id: `noise-${i}`,
        family: 'house',
        kind: 'roof',
        polygon: [
          { x: i * 137, y: 0 },
          { x: i * 137 + 100, y: 0 },
          { x: i * 137 + 100, y: i * 91 + 50 },
          { x: i * 137, y: i * 91 + 50 },
        ],
      }));
      const dims = buildSelectionDimensions(noisyItems, 'house_forms');
      expect(dims.map((dim) => dim.id)).toEqual(['selection:width', 'selection:height']);
    });

    it('picks the largest matching shape when multiple primary candidates are present', () => {
      const dims = buildSelectionDimensions(
        [
          {
            id: 'house-small',
            family: 'house',
            kind: 'footprint',
            polygon: [
              { x: 0, y: 0 },
              { x: 100, y: 0 },
              { x: 100, y: 100 },
              { x: 0, y: 100 },
            ],
          },
          HOUSE_FOOTPRINT_RECT,
        ],
        'house_forms',
      );
      expect(dims.every((dim) => dim.id.startsWith('house-footprint:'))).toBe(true);
    });

    it('accepts deck and landing kinds for the decks family', () => {
      const dims = buildSelectionDimensions(
        [
          {
            id: 'landing-floor',
            family: 'house',
            kind: 'landing',
            polygon: [
              { x: 0, y: 0 },
              { x: 1500, y: 0 },
              { x: 1500, y: 1500 },
              { x: 0, y: 1500 },
            ],
          },
        ],
        'decks',
      );
      expect(dims).toHaveLength(4);
      expect(dims.map((dim) => dim.id)).toEqual([
        'landing-floor:slice:x:top:0-1500',
        'landing-floor:slice:x:bottom:0-1500',
        'landing-floor:slice:y:left:0-1500',
        'landing-floor:slice:y:right:0-1500',
      ]);
    });
  });
});

describe('buildEdgeDimensions', () => {
  const RECT = {
    id: 'rect',
    polygon: [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 2000 },
      { x: 0, y: 2000 },
    ],
  };

  it('emits one dim per edge', () => {
    const dims = buildEdgeDimensions(RECT);
    expect(dims).toHaveLength(4);
  });

  it('uses sequential edge ids tied to the source id', () => {
    const dims = buildEdgeDimensions(RECT);
    expect(dims.map((dim) => dim.id)).toEqual([
      'rect:edge:0',
      'rect:edge:1',
      'rect:edge:2',
      'rect:edge:3',
    ]);
  });

  it('returns an empty list for polygons with fewer than 3 vertices', () => {
    expect(buildEdgeDimensions({ id: 'line', polygon: [{ x: 0, y: 0 }, { x: 100, y: 0 }] })).toEqual([]);
  });

  it('skips zero-length edges between duplicate vertices', () => {
    const dims = buildEdgeDimensions({
      id: 'has-dupe',
      polygon: [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 1000, y: 1000 },
        { x: 0, y: 1000 },
      ],
    });
    expect(dims).toHaveLength(4);
  });

  it('emits dims for every edge of a U-shape (8 edges total)', () => {
    const dims = buildEdgeDimensions({
      id: 'u',
      polygon: [
        { x: 0, y: 0 },
        { x: 6000, y: 0 },
        { x: 6000, y: 4000 },
        { x: 4000, y: 4000 },
        { x: 4000, y: 1500 },
        { x: 2000, y: 1500 },
        { x: 2000, y: 4000 },
        { x: 0, y: 4000 },
      ],
    });
    expect(dims).toHaveLength(8);
  });

  it('places every dim line further from the polygon centroid than the edge it labels', () => {
    const dims = buildEdgeDimensions(RECT);
    const centroid = { x: 2000, y: 1000 };
    for (const dim of dims) {
      const dx = dim.end.x - dim.start.x;
      const dy = dim.end.y - dim.start.y;
      const len = Math.hypot(dx, dy);
      const nx = -dy / len;
      const ny = dx / len;
      const midX = (dim.start.x + dim.end.x) / 2;
      const midY = (dim.start.y + dim.end.y) / 2;
      const dimCenterX = midX + nx * dim.offsetMm!;
      const dimCenterY = midY + ny * dim.offsetMm!;
      const edgeRadius = Math.hypot(midX - centroid.x, midY - centroid.y);
      const dimRadius = Math.hypot(dimCenterX - centroid.x, dimCenterY - centroid.y);
      expect(dimRadius).toBeGreaterThan(edgeRadius);
    }
  });
});

describe('isRectilinearPolygon', () => {
  it('returns true for a basic axis-aligned rectangle', () => {
    expect(
      isRectilinearPolygon([
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 1000, y: 500 },
        { x: 0, y: 500 },
      ]),
    ).toBe(true);
  });

  it('returns true for an axis-aligned U-shape', () => {
    expect(
      isRectilinearPolygon([
        { x: 0, y: 0 },
        { x: 6000, y: 0 },
        { x: 6000, y: 4000 },
        { x: 4000, y: 4000 },
        { x: 4000, y: 1500 },
        { x: 2000, y: 1500 },
        { x: 2000, y: 4000 },
        { x: 0, y: 4000 },
      ]),
    ).toBe(true);
  });

  it('returns false for a polygon with a single diagonal edge', () => {
    expect(
      isRectilinearPolygon([
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 1500, y: 800 },
        { x: 0, y: 800 },
      ]),
    ).toBe(false);
  });

  it('returns false for a polygon with fewer than 3 vertices', () => {
    expect(isRectilinearPolygon([{ x: 0, y: 0 }, { x: 100, y: 0 }])).toBe(false);
  });

  it('tolerates small angular noise within the default 5 degree threshold', () => {
    expect(
      isRectilinearPolygon([
        { x: 0, y: 0 },
        { x: 1000, y: 30 },
        { x: 1000, y: 500 },
        { x: 0, y: 500 },
      ]),
    ).toBe(true);
  });
});

describe('extractAxisSlices', () => {
  it('returns one x-slice and one y-slice for a rectangle', () => {
    const { xSlices, ySlices } = extractAxisSlices([
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 3000 },
      { x: 0, y: 3000 },
    ]);
    expect(xSlices).toEqual([[0, 4000]]);
    expect(ySlices).toEqual([[0, 3000]]);
  });

  it('returns 3 x-slices and 2 y-slices for the canonical U-shape', () => {
    const { xSlices, ySlices } = extractAxisSlices([
      { x: 0, y: 0 },
      { x: 6000, y: 0 },
      { x: 6000, y: 4000 },
      { x: 4000, y: 4000 },
      { x: 4000, y: 1500 },
      { x: 2000, y: 1500 },
      { x: 2000, y: 4000 },
      { x: 0, y: 4000 },
    ]);
    expect(xSlices).toEqual([
      [0, 2000],
      [2000, 4000],
      [4000, 6000],
    ]);
    expect(ySlices).toEqual([
      [0, 1500],
      [1500, 4000],
    ]);
  });
});

describe('buildSliceDimensions', () => {
  const RECT = {
    id: 'rect',
    polygon: [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 3000 },
      { x: 0, y: 3000 },
    ],
  };

  it('emits a slice chain on each side (4 dims, no totals) for a single-slice rectangle', () => {
    const dims = buildSliceDimensions(RECT);
    expect(dims.map((dim) => dim.id)).toEqual([
      'rect:slice:x:top:0-4000',
      'rect:slice:x:bottom:0-4000',
      'rect:slice:y:left:0-3000',
      'rect:slice:y:right:0-3000',
    ]);
  });

  it('emits totals on each side only when there are 2+ slices on an axis', () => {
    const dims = buildSliceDimensions({
      id: 'u',
      polygon: [
        { x: 0, y: 0 },
        { x: 6000, y: 0 },
        { x: 6000, y: 4000 },
        { x: 4000, y: 4000 },
        { x: 4000, y: 1500 },
        { x: 2000, y: 1500 },
        { x: 2000, y: 4000 },
        { x: 0, y: 4000 },
      ],
    });
    expect(dims.find((dim) => dim.id === 'u:total:x:top')).toBeDefined();
    expect(dims.find((dim) => dim.id === 'u:total:x:bottom')).toBeDefined();
    expect(dims.find((dim) => dim.id === 'u:total:y:left')).toBeDefined();
    expect(dims.find((dim) => dim.id === 'u:total:y:right')).toBeDefined();
  });

  it('places top vs bottom and left vs right slice chains on opposite sides of the polygon', () => {
    const dims = buildSliceDimensions(RECT);
    const xTop = dims.find((dim) => dim.id === 'rect:slice:x:top:0-4000')!;
    const xBottom = dims.find((dim) => dim.id === 'rect:slice:x:bottom:0-4000')!;
    const yLeft = dims.find((dim) => dim.id === 'rect:slice:y:left:0-3000')!;
    const yRight = dims.find((dim) => dim.id === 'rect:slice:y:right:0-3000')!;
    expect(xTop.start.y).toBe(0);
    expect(xBottom.start.y).toBe(3000);
    expect(yLeft.start.x).toBe(0);
    expect(yRight.start.x).toBe(4000);
    expect(Math.sign(xTop.offsetMm!)).not.toBe(Math.sign(xBottom.offsetMm!));
    expect(Math.sign(yLeft.offsetMm!)).not.toBe(Math.sign(yRight.offsetMm!));
  });

  it('places the x-total dim further from the polygon than the x-slice chain', () => {
    const dims = buildSliceDimensions({
      id: 'u',
      polygon: [
        { x: 0, y: 0 },
        { x: 6000, y: 0 },
        { x: 6000, y: 4000 },
        { x: 4000, y: 4000 },
        { x: 4000, y: 1500 },
        { x: 2000, y: 1500 },
        { x: 2000, y: 4000 },
        { x: 0, y: 4000 },
      ],
    });
    const slice = dims.find((dim) => dim.id === 'u:slice:x:top:0-2000')!;
    const total = dims.find((dim) => dim.id === 'u:total:x:top')!;
    expect(Math.abs(total.offsetMm!)).toBeGreaterThan(Math.abs(slice.offsetMm!));
  });

  it('returns an empty list for an empty or degenerate polygon', () => {
    expect(buildSliceDimensions({ id: 'empty', polygon: [] })).toEqual([]);
  });
});
