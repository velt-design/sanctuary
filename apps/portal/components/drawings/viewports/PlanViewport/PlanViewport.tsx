'use client';

import { useMemo } from 'react';
import type { GeometryTopProjectionShape } from '@sp/geometry';
import { buildTopProjectionPlanCoordinateAdapter } from '@/lib/drawings/views/plan/planCoordinateAdapter';
import {
  buildProjectionPlanRenderGraph,
  topProjectionShapeVisible,
} from '@/lib/drawings/views/plan/planRenderGraph';
import type { WorkbenchSolvedGeometryArtifact } from '@/lib/drawings/state/workbenchSolvedModel';
import type {
  DrawingWorkbenchViewportTransform,
  DrawingWorkbenchVisibilityState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type {
  ObjectWorkbenchDisplayFamily,
  ObjectWorkbenchViewportTargetSelection,
} from '@/lib/drawings/state/objectWorkbenchViewportTypes';
import type { PlanSvgPoint } from '@/lib/drawings/views/plan/planCoordinateAdapter';
import { PlanCanvas } from './canvas/PlanCanvas';
import { resolvePlanLayout } from './canvas/planLayout';
import { activeObjectMatchesPlanShape } from './canvas/selectionMatch';
import type { PlanDimension } from './canvas/planDimension';
import type { PlanRenderItem } from './canvas/planRenderItem';

export type { PlanDimension } from './canvas/planDimension';
import { ToolDispatcherProvider } from './tools/ToolDispatcher';
import { createSelectTool } from './tools/SelectTool';

const DEFAULT_VISIBILITY: DrawingWorkbenchVisibilityState = {
  house: true,
  pergolas: true,
  decks: true,
  openings: true,
};

export type PlanViewportProps = {
  artifact: WorkbenchSolvedGeometryArtifact | null;
  objectWorkbenchDisplayFamily?: ObjectWorkbenchDisplayFamily;
  visibility?: DrawingWorkbenchVisibilityState;
  activeObjectRef?: WorkbenchObjectRef | null;
  dimensions?: ReadonlyArray<PlanDimension>;
  viewportTransform: DrawingWorkbenchViewportTransform;
  onViewportTransformChange: (next: DrawingWorkbenchViewportTransform) => void;
  onSelectObjectWorkbenchTarget?: (selection: ObjectWorkbenchViewportTargetSelection) => void;
  onSelectPergolaTarget?: (pergolaId: string) => void;
  onClearWorkbenchSelection?: () => void;
};

type RawPlanItem = {
  shape: GeometryTopProjectionShape;
  points: PlanSvgPoint[];
};

function PlaceholderSurface() {
  return (
    <section
      data-plan-viewport="true"
      data-plan-render-status="no_artifact"
      aria-label="Plan editor viewport"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fafafa',
        color: '#555',
        fontSize: '0.9rem',
      }}
    >
      <p data-plan-viewport-placeholder>Plan view unavailable: no solved geometry artifact.</p>
    </section>
  );
}

export default function PlanViewport({
  artifact,
  visibility = DEFAULT_VISIBILITY,
  activeObjectRef,
  dimensions,
  viewportTransform,
  onViewportTransformChange,
  onSelectObjectWorkbenchTarget,
  onSelectPergolaTarget,
  onClearWorkbenchSelection,
}: PlanViewportProps) {
  const projection = artifact?.topProjection ?? null;

  const renderModel = useMemo(() => {
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
    const selectionHaloItems = committedBodies.filter(({ shape }) =>
      activeObjectMatchesPlanShape(activeObjectRef, shape),
    );
    return { layout, adapter, committedBodies, contextLines, detailLines, selectionHaloItems };
  }, [activeObjectRef, projection, visibility]);

  const selectTool = useMemo(
    () =>
      createSelectTool({
        onSelectObjectWorkbenchTarget,
        onSelectPergolaTarget,
        onClearWorkbenchSelection,
      }),
    [onClearWorkbenchSelection, onSelectObjectWorkbenchTarget, onSelectPergolaTarget],
  );

  if (!projection || !renderModel) return <PlaceholderSurface />;

  const screenAxisLabel = `${projection.screenAxis.x}_${projection.screenAxis.y}`;

  return (
    <div
      data-plan-viewport-host="true"
      style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'block' }}
    >
      <ToolDispatcherProvider initialTool={selectTool}>
        <PlanCanvas
          layout={renderModel.layout}
          coordinateAdapter={renderModel.adapter}
          committedBodies={renderModel.committedBodies}
          contextLines={renderModel.contextLines}
          detailLines={renderModel.detailLines}
          selectionHaloItems={renderModel.selectionHaloItems}
          dimensions={dimensions}
          transform={viewportTransform}
          onTransformChange={onViewportTransformChange}
          screenAxisLabel={screenAxisLabel}
        />
      </ToolDispatcherProvider>
    </div>
  );
}
