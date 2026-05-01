import { describe, expect, it } from 'vitest';
import type { GeometryTopProjectionViewModel } from '@sp/geometry';
import {
  buildTopProjectionPlanCoordinateAdapter,
  topProjectionDirectionToPlanSvg,
  topProjectionPointToPlanSvg,
  topProjectionSvgPointToPlanPoint,
} from './planCoordinateAdapter';

const projection: GeometryTopProjectionViewModel = {
  coordinateSpace: 'world_xy_mm',
  screenAxis: { x: 'world_x_left', y: 'world_y_down' },
  shapes: [],
  extents: {
    minX: 0,
    minY: 0,
    maxX: 10000,
    maxY: 6000,
    widthMm: 10000,
    heightMm: 6000,
  },
};

describe('planCoordinateAdapter', () => {
  it('round-trips top projection world points through plan SVG space', () => {
    const svgPoint = topProjectionPointToPlanSvg({ x: 2500, y: 1200 }, projection, 10, 20, 5);

    expect(svgPoint).toEqual({ x: 47.5, y: 26 });
    expect(topProjectionSvgPointToPlanPoint(svgPoint, projection, 10, 20, 5)).toEqual({
      x: 2.5,
      y: 1.2,
    });
  });

  it('exposes a reusable top-projection coordinate adapter contract', () => {
    const adapter = buildTopProjectionPlanCoordinateAdapter({
      projection,
      baseX: 10,
      baseY: 20,
      scale: 5,
    });

    expect(adapter.coordinateSpace).toBe('top_projection_world_m');
    expect(adapter.projectionToSvg({ x: 9000, y: 2000 })).toEqual({ x: 15, y: 30 });
    expect(adapter.svgToProjectionPlanPoint({ x: 15, y: 30 })).toEqual({ x: 9, y: 2 });
  });

  it('mirrors top-projection x directions when screen x is world-left', () => {
    expect(topProjectionDirectionToPlanSvg({ x: 1, y: -1 }, projection)).toEqual({ x: -1, y: -1 });
  });
});
