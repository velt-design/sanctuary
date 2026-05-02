import { describe, expect, it, vi } from 'vitest';
import type { GeometryTopProjectionViewModel } from '@sp/geometry';
import {
  createPlanSvgPointResolvers,
  resolvePlanSvgPointerFootprintPoint,
  syncPlanSvgInteractionBridge,
  type PlanSvgPointResolverSet,
} from './ModulePlanSvgBridge';
import type { ModulePlanModel } from './moduleViews';

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

const footprintParams: ModulePlanModel['houseFootprintParams'] = {
  widthM: '6',
  offsetXM: '0',
  setbackM: '0',
  bandDepthM: '1.8',
  returnRunM: '2.4',
  recessWidthM: '2.4',
  recessDepthM: '1.2',
  leftLegRunM: '2.4',
  rightLegRunM: '2.4',
  sideRunM: '2.4',
};

function svgWithIdentityClientTransform(): SVGSVGElement {
  return {
    getScreenCTM: () => ({
      inverse: () => ({}),
    }),
    createSVGPoint: () => ({
      x: 0,
      y: 0,
      matrixTransform() {
        return {
          x: this.x,
          y: this.y,
        };
      },
    }),
  } as unknown as SVGSVGElement;
}

function resolvers(input?: Partial<Parameters<typeof createPlanSvgPointResolvers>[0]>): PlanSvgPointResolverSet {
  return createPlanSvgPointResolvers({
    origin: { x: 10, y: 20 },
    scale: 5,
    rotationFrame: {
      center: { x: 30, y: 15 },
      turns: 0,
    },
    footprintRect: { x: 0, y: 0, width: 60, height: 30 },
    attachmentSide: 'rear',
    lengthA: 6,
    spanA: 3,
    houseFootprintPreset: 'straight',
    houseFootprintParams: footprintParams,
    isHipCorner: false,
    useTopProjectionBackedPlan: false,
    topProjection: null,
    ...input,
  });
}

describe('ModulePlanSvgBridge', () => {
  it('resolves footprint canvas points through the existing footprint metre contract', () => {
    expect(
      resolvePlanSvgPointerFootprintPoint({
        rootPoint: { x: 20, y: -10 },
        rotationCenter: { x: 30, y: 15 },
        rotationTurns: 0,
        footprintRect: { x: 0, y: 0, width: 60, height: 30 },
        scale: 10,
        attachmentSide: 'rear',
        lengthA: 6,
        spanA: 3,
        houseFootprintPreset: 'straight',
        houseFootprintParams: footprintParams,
      }),
    ).toMatchObject({
      formatted: { alongM: '2', depthM: '1' },
      numeric: { alongM: 2, depthM: 1 },
    });

    expect(resolvers({ scale: 10 }).resolveFootprintCanvasPoint(svgWithIdentityClientTransform(), 20, -10)).toEqual({
      alongM: '2',
      depthM: '1',
      numericAlongM: 2,
      numericDepthM: 1,
    });
  });

  it('resolves raw plan points from client SVG coordinates through origin, scale, and rotation', () => {
    expect(resolvers().resolveRawPlanPoint(svgWithIdentityClientTransform(), 30, 35)).toEqual({ x: 4, y: 3 });

    expect(
      resolvers({
        origin: { x: 0, y: 0 },
        scale: 1,
        rotationFrame: {
          center: { x: 10, y: 10 },
          turns: 1,
        },
      }).resolveRawPlanPoint(svgWithIdentityClientTransform(), 15, 5),
    ).toEqual({ x: 15, y: 15 });
  });

  it('uses top-projection coordinates for projection-backed deck drag points', () => {
    expect(
      resolvers({
        useTopProjectionBackedPlan: true,
        topProjection: projection,
      }).resolveDeckDragPlanPoint(svgWithIdentityClientTransform(), 47.5, 26),
    ).toEqual({
      x: 2.5,
      y: 1.2,
    });
  });

  it('falls back to raw plan coordinates for deck drag when top projection is unavailable', () => {
    expect(resolvers().resolveDeckDragPlanPoint(svgWithIdentityClientTransform(), 47.5, 26)).toEqual({
      x: 7.5,
      y: 1.2,
    });
  });

  it('syncs and clears SVG bridge callbacks for footprint and plan interactions', () => {
    const node = svgWithIdentityClientTransform();
    const footprintSvgMount = vi.fn();
    const planSvgMount = vi.fn();
    const onCanvasPointResolverChange = vi.fn();
    const onPlanPointResolverChange = vi.fn();
    const onDeckDragPointResolverChange = vi.fn();
    const resolverSet = resolvers();

    syncPlanSvgInteractionBridge({
      node,
      footprintEditor: {
        onSvgMount: footprintSvgMount,
        onCanvasPointResolverChange,
      },
      planInteraction: {
        onSvgMount: planSvgMount,
        onPlanPointResolverChange,
        onDeckDragPointResolverChange,
      },
      resolvers: resolverSet,
    });

    expect(footprintSvgMount).toHaveBeenCalledWith(node);
    expect(planSvgMount).toHaveBeenCalledWith(node);
    expect(onCanvasPointResolverChange.mock.calls[0]?.[0](25, 2.5)).toMatchObject({ alongM: '2', depthM: '1' });
    expect(onPlanPointResolverChange.mock.calls[0]?.[0](30, 35)).toEqual({ x: 4, y: 3 });
    expect(onDeckDragPointResolverChange.mock.calls[0]?.[0](30, 35)).toEqual({ x: 4, y: 3 });

    syncPlanSvgInteractionBridge({
      node: null,
      footprintEditor: {
        onSvgMount: footprintSvgMount,
        onCanvasPointResolverChange,
      },
      planInteraction: {
        onSvgMount: planSvgMount,
        onPlanPointResolverChange,
        onDeckDragPointResolverChange,
      },
      resolvers: resolverSet,
    });

    expect(footprintSvgMount).toHaveBeenLastCalledWith(null);
    expect(planSvgMount).toHaveBeenLastCalledWith(null);
    expect(onCanvasPointResolverChange).toHaveBeenLastCalledWith(null);
    expect(onPlanPointResolverChange).toHaveBeenLastCalledWith(null);
    expect(onDeckDragPointResolverChange).toHaveBeenLastCalledWith(null);
  });
});
