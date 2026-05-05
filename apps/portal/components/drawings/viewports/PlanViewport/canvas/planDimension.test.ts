import { describe, expect, it } from 'vitest';
import type { GeometryTopProjectionViewModel } from '@sp/geometry';
import { buildTopProjectionPlanCoordinateAdapter } from '@/lib/drawings/views/plan/planCoordinateAdapter';
import {
  DEFAULT_DIMENSION_OFFSET_MM,
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

  it('emits two dims (width + height) per selected item', () => {
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
    expect(dims[0]?.id).toBe('pergola-1:width');
    expect(dims[0]?.start).toEqual({ x: 0, y: 0 });
    expect(dims[0]?.end).toEqual({ x: 4500, y: 0 });
    expect(dims[1]?.id).toBe('pergola-1:height');
    expect(dims[1]?.start).toEqual({ x: 0, y: 8000 });
    expect(dims[1]?.end).toEqual({ x: 0, y: 0 });
  });

  it('skips items whose polygon has zero area', () => {
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
    expect(dims.map((dim) => dim.id)).toEqual(['real:width', 'real:height']);
  });

  it('emits dims for multiple selected items independently', () => {
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
    expect(dims.map((dim) => dim.id)).toEqual(['a:width', 'a:height', 'b:width', 'b:height']);
  });
});
