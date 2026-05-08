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
  /**
   * Cross-viewport hover halo. Populated when an external surface (e.g. 3D
   * viewport) reports a hovered object that maps to a shape in this plan
   * projection. Empty for "no external hover" or when the hovered object is
   * the active selection (the selection halo already highlights it; rendering
   * both would double-paint). See `docs/design-workbench-architecture.md`
   * milestone 16 for the hover-sync contract.
   */
  hoverHaloItems: PlanRenderItem[];
};

export type UsePlanRenderModelInput = {
  projection: GeometryTopProjectionViewModel | null;
  visibility: DrawingWorkbenchVisibilityState;
  activeObjectRef: WorkbenchObjectRef | null | undefined;
  /** External hover state (e.g. driven by 3D viewport pointer-over). */
  hoveredObjectRef?: WorkbenchObjectRef | null;
};

export function usePlanRenderModel({
  projection,
  visibility,
  activeObjectRef,
  hoveredObjectRef,
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
          matchedItems.map((item) => ({
            ...item,
            polygon: item.shape.polygon,
            kind: item.shape.kind,
            isCanonicalOutline: item.shape.metadata?.isCanonicalOutline === true,
          })),
          activeFamily,
        )
      : null;
    const selectionHaloItems: PlanRenderItem[] = primary
      ? [{ shape: primary.shape, points: primary.points, layer: primary.layer }]
      : matchedItems;
    // Hover halo: same matching rule as selection, but driven by the
    // external hover ref. Skip when the hovered object IS the active
    // object (the selection halo already covers it; double-painting just
    // muddies the visual). Skip when hover ref is the same family/objectId
    // as the active object so we don't compete with selection styling.
    const hoverIsActive =
      hoveredObjectRef &&
      activeObjectRef &&
      hoveredObjectRef.family === activeObjectRef.family &&
      hoveredObjectRef.objectId === activeObjectRef.objectId;
    const hoverHaloItems: PlanRenderItem[] =
      hoveredObjectRef && !hoverIsActive
        ? committedBodies.filter(({ shape }) =>
            activeObjectMatchesPlanShape(hoveredObjectRef, shape),
          )
        : [];
    return {
      layout,
      adapter,
      committedBodies,
      contextLines,
      detailLines,
      selectionHaloItems,
      hoverHaloItems,
    };
  }, [activeObjectRef, hoveredObjectRef, projection, visibility]);
}
