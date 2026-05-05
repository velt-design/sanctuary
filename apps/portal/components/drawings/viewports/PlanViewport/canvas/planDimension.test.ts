import { describe, expect, it } from 'vitest';
import type { GeometryTopProjectionViewModel } from '@sp/geometry';
import { buildTopProjectionPlanCoordinateAdapter } from '@/lib/drawings/views/plan/planCoordinateAdapter';
import {
  DEFAULT_DIMENSION_OFFSET_MM,
  buildEdgeDimensions,
  buildSelectionDimensions,
  formatDimensionLengthMm,
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

    it('emits per-edge dims when a primary edit polygon is found', () => {
      const dims = buildSelectionDimensions([HOUSE_FOOTPRINT_RECT], 'house_forms');
      expect(dims).toHaveLength(4);
      for (let i = 0; i < 4; i += 1) {
        expect(dims[i]?.id).toBe(`house-footprint:edge:${i}`);
      }
    });

    it('falls back to bounding-box dims when no primary kind is found in the selection', () => {
      const dims = buildSelectionDimensions(
        [
          {
            id: 'house-wall',
            family: 'house',
            kind: 'wall_segment',
            polygon: [
              { x: 0, y: 0 },
              { x: 1000, y: 0 },
              { x: 1000, y: 100 },
              { x: 0, y: 100 },
            ],
          },
        ],
        'house_forms',
      );
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
      expect(dims.every((dim) => dim.id.startsWith('house-footprint:edge:'))).toBe(true);
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
      expect(dims.length).toBe(4);
      expect(dims[0]?.id).toBe('landing-floor:edge:0');
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
