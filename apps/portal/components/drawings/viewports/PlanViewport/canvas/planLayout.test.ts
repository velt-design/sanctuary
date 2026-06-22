import { describe, expect, it } from 'vitest';
import type { GeometryTopProjectionViewModel } from '@sp/geometry';
import {
  planBoundsFromPolygon,
  resolvePlanLayout,
} from './planLayout';

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

describe('resolvePlanLayout', () => {
  it('produces an SVG viewBox sized to projection extents plus padding', () => {
    const layout = resolvePlanLayout(makeProjection());

    expect(layout.scale).toBe(100);
    expect(layout.width).toBe(5000 / 1000 * 100 + 12);
    expect(layout.height).toBe(3000 / 1000 * 100 + 12);
    expect(layout.viewBox).toBe('0 0 512.00 312.00');
    expect(layout.worldBoxValue).toBe('0 0 5000 3000');
  });

  it('clamps width and height to a 0.1 m floor for tiny extents', () => {
    const layout = resolvePlanLayout(
      makeProjection({
        extents: {
          minX: 0,
          minY: 0,
          maxX: 50,
          maxY: 30,
          widthMm: 50,
          heightMm: 30,
        },
      }),
    );

    expect(layout.width).toBe(0.1 * 100 + 12);
    expect(layout.height).toBe(0.1 * 100 + 12);
  });

  it('falls back to a 1m square when extents are absent', () => {
    const layout = resolvePlanLayout(makeProjection({ extents: undefined }));

    expect(layout.width).toBe(1 * 100 + 12);
    expect(layout.height).toBe(1 * 100 + 12);
    expect(layout.worldBoxValue).toBe('0 0 1000 1000');
  });

  it('shifts baseX/baseY so non-zero-origin extents anchor to the padding', () => {
    const layout = resolvePlanLayout(
      makeProjection({
        extents: {
          minX: 1000,
          minY: 500,
          maxX: 4000,
          maxY: 2500,
          widthMm: 3000,
          heightMm: 2000,
        },
      }),
    );

    expect(layout.baseX).toBe(6 - 100);
    expect(layout.baseY).toBe(6 - 50);
  });
});

describe('planBoundsFromPolygon', () => {
  it('returns null for an empty polygon', () => {
    expect(planBoundsFromPolygon([])).toBeNull();
  });

  it('returns the axis-aligned bounding box of a polygon', () => {
    expect(
      planBoundsFromPolygon([
        { x: 100, y: 200 },
        { x: 500, y: 50 },
        { x: 300, y: 600 },
      ]),
    ).toEqual({ minX: 100, minY: 50, maxX: 500, maxY: 600 });
  });

  it('returns null when any coordinate is non-finite', () => {
    expect(
      planBoundsFromPolygon([
        { x: 100, y: 200 },
        { x: Number.NaN, y: 300 },
      ]),
    ).toBeNull();
  });
});
