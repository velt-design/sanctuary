import { describe, expect, it } from 'vitest';
import type { PlanCoordinateAdapter, PlanSvgPoint } from '@/lib/drawings/views/plan/planCoordinateAdapter';
import { clientPointToPlanProjection, clientPointToSvg } from './pointerToPlan';

function svgWithLinearTransform(scale: number, offsetX: number, offsetY: number): SVGSVGElement {
  return {
    getScreenCTM: () => ({
      inverse: () => ({ scale, offsetX, offsetY }),
    }),
    createSVGPoint: () => ({
      x: 0,
      y: 0,
      matrixTransform(matrix: { scale: number; offsetX: number; offsetY: number }) {
        return {
          x: this.x * matrix.scale + matrix.offsetX,
          y: this.y * matrix.scale + matrix.offsetY,
        };
      },
    }),
  } as unknown as SVGSVGElement;
}

function svgWithoutCtm(): SVGSVGElement {
  return {
    getScreenCTM: () => null,
    createSVGPoint: () => ({
      x: 0,
      y: 0,
      matrixTransform() {
        return { x: 0, y: 0 };
      },
    }),
  } as unknown as SVGSVGElement;
}

describe('clientPointToSvg', () => {
  it('returns null when getScreenCTM is unavailable', () => {
    expect(clientPointToSvg(svgWithoutCtm(), 100, 200)).toBeNull();
  });

  it('applies the inverse client matrix to the pointer position', () => {
    const result = clientPointToSvg(svgWithLinearTransform(0.5, 10, 20), 100, 80);
    expect(result).toEqual({ x: 60, y: 60 });
  });

  it('preserves identity transforms', () => {
    expect(clientPointToSvg(svgWithLinearTransform(1, 0, 0), 42, 13)).toEqual({ x: 42, y: 13 });
  });
});

describe('clientPointToPlanProjection', () => {
  function passthroughAdapter(): PlanCoordinateAdapter {
    return {
      coordinateSpace: 'top_projection_world_m',
      projectionToSvg: (point) => point,
      projectionPolygonToSvg: (points) => points.map((point) => ({ ...point })),
      svgToProjectionPlanPoint: (point: PlanSvgPoint) => ({ x: point.x, y: point.y }),
      directionToSvg: (direction) => direction,
    };
  }

  it('returns null when the SVG has no CTM', () => {
    const result = clientPointToPlanProjection(svgWithoutCtm(), 5, 5, passthroughAdapter());
    expect(result).toBeNull();
  });

  it('routes the SVG point through the coordinate adapter', () => {
    const adapter = {
      ...passthroughAdapter(),
      svgToProjectionPlanPoint: (point: PlanSvgPoint) => ({ x: point.x * 1000, y: point.y * 1000 }),
    } satisfies PlanCoordinateAdapter;

    const result = clientPointToPlanProjection(svgWithLinearTransform(1, 0, 0), 1.5, 2.25, adapter);
    expect(result).toEqual({ x: 1500, y: 2250 });
  });

  it('returns null when the adapter rejects the point', () => {
    const adapter = {
      ...passthroughAdapter(),
      svgToProjectionPlanPoint: () => null,
    } satisfies PlanCoordinateAdapter;

    expect(clientPointToPlanProjection(svgWithLinearTransform(1, 0, 0), 1, 1, adapter)).toBeNull();
  });
});
