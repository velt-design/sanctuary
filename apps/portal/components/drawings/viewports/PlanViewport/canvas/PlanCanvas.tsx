'use client';

import {
  useCallback,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { PlanCoordinateAdapter } from '@/lib/drawings/views/plan/planCoordinateAdapter';
import type { DrawingWorkbenchViewportTransform } from '@/lib/drawings/state/drawingWorkbenchUiState';
import { clientPointToPlanProjection } from '../interactions/pointerToPlan';
import { useHoveredShape } from '../interactions/useHoveredShape';
import { usePanZoom } from '../interactions/usePanZoom';
import { useToolDispatcher } from '../tools/ToolDispatcher';
import { PlanCommittedBodyLayer } from './layers/PlanCommittedBodyLayer';
import { PlanContextLineLayer } from './layers/PlanContextLineLayer';
import { PlanDetailLayer } from './layers/PlanDetailLayer';
import { PlanDimensionLayer } from './layers/PlanDimensionLayer';
import { PlanEdgeDragPreviewLayer } from './layers/PlanEdgeDragPreviewLayer';
import { PlanHitTargetLayer } from './layers/PlanHitTargetLayer';
import { PlanSelectionHaloLayer } from './layers/PlanSelectionHaloLayer';
import type { PlanDimension } from './planDimension';
import type { EdgeDragPreview } from '../tools/EdgeDragTool';
import styles from './PlanCanvas.module.css';
import type { PlanLayout } from './planLayout';
import type { PlanRenderItem } from './planRenderItem';

const IDENTITY_TRANSFORM: DrawingWorkbenchViewportTransform = { zoom: 1, panX: 0, panY: 0 };

export type PlanCanvasProps = {
  layout: PlanLayout;
  coordinateAdapter: PlanCoordinateAdapter;
  committedBodies: PlanRenderItem[];
  contextLines: PlanRenderItem[];
  detailLines: PlanRenderItem[];
  selectionHaloItems: PlanRenderItem[];
  dimensions?: ReadonlyArray<PlanDimension>;
  edgeDragPreview?: EdgeDragPreview | null;
  transform: DrawingWorkbenchViewportTransform;
  onTransformChange: (next: DrawingWorkbenchViewportTransform) => void;
  screenAxisLabel: string;
};

const EMPTY_DIMENSIONS: ReadonlyArray<PlanDimension> = [];

function transformAttr(transform: DrawingWorkbenchViewportTransform): string {
  return `translate(${transform.panX} ${transform.panY}) scale(${transform.zoom})`;
}

export function PlanCanvas({
  layout,
  coordinateAdapter,
  committedBodies,
  contextLines,
  detailLines,
  selectionHaloItems,
  dimensions = EMPTY_DIMENSIONS,
  edgeDragPreview = null,
  transform,
  onTransformChange,
  screenAxisLabel,
}: PlanCanvasProps) {
  const dispatcher = useToolDispatcher();
  const { hoveredShape, onShapeEnter, onShapeLeave } = useHoveredShape();
  const panZoom = usePanZoom({ transform, onTransformChange });

  const dispatchPlanPointer = useCallback(
    (kind: 'down' | 'move' | 'up', event: ReactPointerEvent<Element>, shape: Parameters<typeof dispatcher.dispatchPointerDown>[0]['shape']) => {
      const target = event.currentTarget as SVGElement;
      const point = clientPointToPlanProjection(
        target.ownerSVGElement ?? (target as unknown as SVGSVGElement),
        event.clientX,
        event.clientY,
        coordinateAdapter,
      );
      if (!point && shape) return;
      const payload = {
        shape,
        point: point ? { x: point.x * 1000, y: point.y * 1000 } : { x: 0, y: 0 },
        button: event.button,
        pointerId: event.pointerId,
      };
      if (kind === 'down') dispatcher.dispatchPointerDown(payload);
      if (kind === 'move') dispatcher.dispatchPointerMove(payload);
      if (kind === 'up') dispatcher.dispatchPointerUp(payload);
    },
    [coordinateAdapter, dispatcher],
  );

  const handleEmptyPointerDown = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (event.button !== 0) return;
      if (event.target !== event.currentTarget) return;
      dispatchPlanPointer('down', event, null);
    },
    [dispatchPlanPointer],
  );

  const handleFitView = useCallback(() => {
    onTransformChange(IDENTITY_TRANSFORM);
  }, [onTransformChange]);

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      dispatchPlanPointer('move', event, null);
      panZoom.onPointerMove(event);
    },
    [dispatchPlanPointer, panZoom],
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      dispatchPlanPointer('up', event, null);
      panZoom.onPointerUp(event);
    },
    [dispatchPlanPointer, panZoom],
  );

  return (
    <div className={styles.canvasShell}>
      <div className={styles.toolbar} role="toolbar" aria-label="Plan canvas controls">
        <button
          type="button"
          className={styles.toolbarButton}
          onClick={handleFitView}
          data-plan-canvas-action="fit-view"
        >
          Fit view
        </button>
      </div>
      <svg
        ref={panZoom.wheelRef}
        className={styles.canvasSvg}
        viewBox={layout.viewBox}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block' }}
        role="img"
        aria-label="Plan editor"
        data-plan-viewport="true"
        data-plan-render-source="geometry"
        data-plan-render-status="ready"
        data-plan-screen-axis={screenAxisLabel}
        data-plan-committed-body-count={committedBodies.length}
        data-plan-context-line-count={contextLines.length}
        data-plan-detail-line-count={detailLines.length}
        data-plan-selection-halo-count={selectionHaloItems.length}
        data-plan-dimension-count={dimensions.length}
        data-plan-hover-shape-id={hoveredShape?.shapeId ?? ''}
        data-plan-hover-shape-kind={hoveredShape?.kind ?? ''}
        data-plan-active-tool-id={dispatcher.activeTool.id}
        onPointerDown={(event) => {
          handleEmptyPointerDown(event);
          panZoom.onPointerDown(event);
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={panZoom.onContextMenu}
      >
        <g transform={transformAttr(transform)} data-plan-transform="true">
          <PlanCommittedBodyLayer items={committedBodies} />
          <PlanContextLineLayer items={contextLines} />
          <PlanDetailLayer items={detailLines} />
          <PlanSelectionHaloLayer items={selectionHaloItems} />
          <PlanHitTargetLayer
            items={committedBodies}
            onShapePointerDown={(shape, event) => dispatchPlanPointer('down', event, shape)}
            onShapeEnter={onShapeEnter}
            onShapeLeave={onShapeLeave}
          />
          <PlanDimensionLayer dimensions={dimensions} coordinateAdapter={coordinateAdapter} />
          <PlanEdgeDragPreviewLayer preview={edgeDragPreview} coordinateAdapter={coordinateAdapter} />
        </g>
      </svg>
    </div>
  );
}
