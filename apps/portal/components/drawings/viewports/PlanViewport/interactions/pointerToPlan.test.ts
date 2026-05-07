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

  describe('viewport pan/zoom inverse (regression for intermittent hover bug)', () => {
    // Polygons live inside `<g transform="translate(panX panY) scale(zoom)">`,
    // so polygon `points` are in the group's local coord system. Pointer
    // events arrive in client coords; `getScreenCTM` only maps client → SVG
    // viewBox space, NOT through the group transform. Without inverse-applying
    // the group transform, every pointer-derived world coord drifts by
    // `(panX, panY) / zoom` whenever pan or zoom is non-identity — which
    // looks like the cursor "intermittently" being way off the visible edges.
    //
    // These tests lock the contract: passing the live `viewportTransform`
    // produces the correct world coord regardless of pan/zoom state.
    it('produces identical world coords across different pan/zoom states for a fixed visible position', () => {
      // Visible polygon vertex in viewBox space: (200, 200).
      // For zoom=1 pan=0: viewBox = local. Local svg = (200, 200).
      // For zoom=2 pan=0: viewBox = 2 * local. Local svg = (100, 100). Visible at viewBox (200, 200) means client at (200, 200) (with identity CTM).
      // For zoom=1 pan=(50, 50): viewBox = local + 50. Visible at viewBox (200, 200) means local (150, 150).
      const adapter: PlanCoordinateAdapter = {
        coordinateSpace: 'top_projection_world_m',
        projectionToSvg: (p) => p,
        projectionPolygonToSvg: (p) => p.map((q) => ({ ...q })),
        svgToProjectionPlanPoint: (p) => ({ x: p.x, y: p.y }),
        directionToSvg: (d) => d,
      };
      // Cursor at client (200, 200), with identity SVG CTM, hovers over a
      // polygon vertex placed at LOCAL (100, 100) under zoom=2 pan=0.
      const resultZoomed = clientPointToPlanProjection(
        svgWithLinearTransform(1, 0, 0),
        200,
        200,
        adapter,
        { panX: 0, panY: 0, zoom: 2 },
      );
      expect(resultZoomed).toEqual({ x: 100, y: 100 });

      // Same client coord, identity CTM, hovers over a polygon at LOCAL
      // (150, 150) under zoom=1 pan=(50, 50).
      const resultPanned = clientPointToPlanProjection(
        svgWithLinearTransform(1, 0, 0),
        200,
        200,
        adapter,
        { panX: 50, panY: 50, zoom: 1 },
      );
      expect(resultPanned).toEqual({ x: 150, y: 150 });

      // And under combined zoom + pan: visible (200, 200) = pan + zoom * local
      // → 200 = 30 + 2 * local → local = 85.
      const resultBoth = clientPointToPlanProjection(
        svgWithLinearTransform(1, 0, 0),
        200,
        200,
        adapter,
        { panX: 30, panY: 30, zoom: 2 },
      );
      expect(resultBoth).toEqual({ x: 85, y: 85 });
    });

    it('defaults to identity transform when none is passed (back-compat)', () => {
      const adapter: PlanCoordinateAdapter = {
        coordinateSpace: 'top_projection_world_m',
        projectionToSvg: (p) => p,
        projectionPolygonToSvg: (p) => p.map((q) => ({ ...q })),
        svgToProjectionPlanPoint: (p) => ({ x: p.x, y: p.y }),
        directionToSvg: (d) => d,
      };
      // Without the transform argument, behavior must match identity (the
      // pre-fix behavior for old callers).
      const result = clientPointToPlanProjection(svgWithLinearTransform(1, 0, 0), 42, 13, adapter);
      expect(result).toEqual({ x: 42, y: 13 });
    });
  });
});
