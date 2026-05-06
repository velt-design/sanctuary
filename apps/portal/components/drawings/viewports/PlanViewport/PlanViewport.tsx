'use client';

import { useCallback, useMemo, useState } from 'react';
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
import { PlanCanvas } from './canvas/PlanCanvas';
import { usePlanRenderModel } from './canvas/usePlanRenderModel';
import { usePlanSelectionDimensions } from './canvas/usePlanSelectionDimensions';
import { pickPrimaryEditCandidate, type ActiveObjectFamily, type PlanDimension } from './canvas/planDimension';
import { ToolDispatcherProvider } from './tools/ToolDispatcher';
import { createSelectTool } from './tools/SelectTool';
import { createEdgeDragTool, type EdgeDragPreview } from './tools/EdgeDragTool';
import { PlanViewportPlaceholder } from './PlanViewportPlaceholder';
import lineweightStyles from './canvas/planLineweights.module.css';

export type { PlanDimension } from './canvas/planDimension';

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

export default function PlanViewport({
  artifact,
  visibility = DEFAULT_VISIBILITY,
  activeObjectRef,
  dimensions: providedDimensions,
  viewportTransform,
  onViewportTransformChange,
  onSelectObjectWorkbenchTarget,
  onSelectPergolaTarget,
  onClearWorkbenchSelection,
}: PlanViewportProps) {
  const projection = artifact?.topProjection ?? null;
  const renderModel = usePlanRenderModel({ projection, visibility, activeObjectRef });
  const [edgeDragPreview, setEdgeDragPreview] = useState<EdgeDragPreview | null>(null);

  const selectTool = useMemo(
    () =>
      createSelectTool({
        onSelectObjectWorkbenchTarget,
        onSelectPergolaTarget,
        onClearWorkbenchSelection,
      }),
    [onClearWorkbenchSelection, onSelectObjectWorkbenchTarget, onSelectPergolaTarget],
  );

  const activeFamily = (activeObjectRef?.family ?? null) as ActiveObjectFamily | null;

  const getActiveOutline = useCallback(() => {
    if (!renderModel || !activeFamily) return null;
    const candidate = pickPrimaryEditCandidate(
      renderModel.selectionHaloItems.map((item) => ({
        id: item.shape.id,
        polygon: item.shape.polygon,
        kind: item.shape.kind,
        isCanonicalOutline: item.shape.metadata?.isCanonicalOutline === true,
      })),
      activeFamily,
    );
    if (!candidate) return null;
    return { id: candidate.id, family: activeFamily, polygon: candidate.polygon };
  }, [activeFamily, renderModel]);

  const edgeDragTool = useMemo(
    () =>
      createEdgeDragTool({
        getActiveOutline,
        onPreviewChange: setEdgeDragPreview,
      }),
    [getActiveOutline],
  );

  const hasEditableOutline = Boolean(getActiveOutline());
  const activeTool = hasEditableOutline ? edgeDragTool : selectTool;

  const mergedDimensions = usePlanSelectionDimensions({
    selectionHaloItems: renderModel?.selectionHaloItems,
    activeFamily,
    providedDimensions,
  });

  if (!projection || !renderModel) return <PlanViewportPlaceholder />;

  const screenAxisLabel = `${projection.screenAxis.x}_${projection.screenAxis.y}`;

  return (
    <div
      data-plan-viewport-host="true"
      data-plan-active-object-family={activeObjectRef?.family ?? ''}
      data-plan-active-object-id={activeObjectRef?.objectId ?? ''}
      className={lineweightStyles.tokens}
      style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'block' }}
    >
      <ToolDispatcherProvider initialTool={activeTool}>
        <PlanCanvas
          layout={renderModel.layout}
          coordinateAdapter={renderModel.adapter}
          committedBodies={renderModel.committedBodies}
          contextLines={renderModel.contextLines}
          detailLines={renderModel.detailLines}
          selectionHaloItems={renderModel.selectionHaloItems}
          dimensions={mergedDimensions}
          edgeDragPreview={edgeDragPreview}
          transform={viewportTransform}
          onTransformChange={onViewportTransformChange}
          screenAxisLabel={screenAxisLabel}
        />
      </ToolDispatcherProvider>
    </div>
  );
}
