'use client';

import { useMemo } from 'react';
import type { GeometryTopProjectionShape, GeometryTopProjectionViewModel } from '@sp/geometry';
import type { DrawingWorkbenchVisibilityState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import {
  buildTopProjectionPlanCoordinateAdapter,
  type PlanCoordinateAdapter,
  type PlanSvgPoint,
} from '@/lib/drawings/views/plan/planCoordinateAdapter';
import {
  buildProjectionPlanRenderGraph,
  topProjectionShapeVisible,
} from '@/lib/drawings/views/plan/planRenderGraph';
import { resolvePlanLayout, type PlanLayout } from './planLayout';
import { pickPrimaryEditCandidate, type ActiveObjectFamily } from './planDimension';
import type { PlanRenderItem } from './planRenderItem';
import { activeObjectMatchesPlanShape } from './selectionMatch';

type RawPlanItem = {
  shape: GeometryTopProjectionShape;
  points: PlanSvgPoint[];
};

export type PlanRenderModel = {
  layout: PlanLayout;
  adapter: PlanCoordinateAdapter;
  committedBodies: PlanRenderItem[];
  contextLines: PlanRenderItem[];
  detailLines: PlanRenderItem[];
  selectionHaloItems: PlanRenderItem[];
};

export type UsePlanRenderModelInput = {
  projection: GeometryTopProjectionViewModel | null;
  visibility: DrawingWorkbenchVisibilityState;
  activeObjectRef: WorkbenchObjectRef | null | undefined;
};

export function usePlanRenderModel({
  projection,
  visibility,
  activeObjectRef,
}: UsePlanRenderModelInput): PlanRenderModel | null {
  return useMemo(() => {
    if (!projection) return null;
    const layout = resolvePlanLayout(projection);
    const adapter = buildTopProjectionPlanCoordinateAdapter({
      projection,
      baseX: layout.baseX,
      baseY: layout.baseY,
      scale: layout.scale,
    });
    const visibleItems: RawPlanItem[] = projection.shapes
      .filter((shape) => topProjectionShapeVisible(shape, visibility))
      .map((shape) => ({
        shape,
        points: adapter.projectionPolygonToSvg(shape.polygon),
      }));
    const renderGraph = buildProjectionPlanRenderGraph(visibleItems);
    const committedBodies = renderGraph.committedBodies as PlanRenderItem[];
    const contextLines = renderGraph.contextLines as PlanRenderItem[];
    const detailLines = renderGraph.detailLines as PlanRenderItem[];
    const matchedItems = committedBodies.filter(({ shape }) =>
      activeObjectMatchesPlanShape(activeObjectRef, shape),
    );
    const activeFamily = (activeObjectRef?.family ?? null) as ActiveObjectFamily | null;
    const primary = activeFamily
      ? pickPrimaryEditCandidate(
          matchedItems.map((item) => ({ ...item, polygon: item.shape.polygon, kind: item.shape.kind })),
          activeFamily,
        )
      : null;
    const selectionHaloItems: PlanRenderItem[] = primary
      ? [{ shape: primary.shape, points: primary.points, layer: primary.layer }]
      : matchedItems;
    return { layout, adapter, committedBodies, contextLines, detailLines, selectionHaloItems };
  }, [activeObjectRef, projection, visibility]);
}
