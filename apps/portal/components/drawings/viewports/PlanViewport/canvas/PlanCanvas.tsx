'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
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
import { PlanEdgeHoverHighlightLayer } from './layers/PlanEdgeHoverHighlightLayer';
import { PlanHitTargetLayer } from './layers/PlanHitTargetLayer';
import { PlanHitTestDebugLayer } from './layers/PlanHitTestDebugLayer';
import { PlanSelectionHaloLayer } from './layers/PlanSelectionHaloLayer';
import { PlanSnapIndicatorLayer } from './layers/PlanSnapIndicatorLayer';
import type { PlanDimension } from './planDimension';
import type { EdgeDragHover, EdgeDragPreview } from '../tools/EdgeDragTool';
import styles from './PlanCanvas.module.css';
import type { PlanLayout } from './planLayout';
import { filterPlanHitTargets } from './planHitTargetFilter';
import type { Point2 } from './polygonEdgeMath';
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
  edgeDragHover?: EdgeDragHover | null;
  /** Active outline polygon used for hit-testing — passed in for the debug overlay. */
  activeOutlinePolygon?: ReadonlyArray<Point2> | null;
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
  edgeDragHover = null,
  activeOutlinePolygon = null,
  transform,
  onTransformChange,
  screenAxisLabel,
}: PlanCanvasProps) {
  const dispatcher = useToolDispatcher();
  const { hoveredShape, onShapeEnter, onShapeLeave } = useHoveredShape();
  const panZoom = usePanZoom({ transform, onTransformChange });
  const hitTargetItems = useMemo(() => filterPlanHitTargets(committedBodies), [committedBodies]);

  // Diagnostic overlay — only rendered when `?debug=hit-test` is in the URL.
  // Tracks cursor world coords via state so the overlay re-renders on each
  // pointer move; production has zero cost (the early return below skips both
  // the state update and the layer render).
  const [debugEnabled, setDebugEnabled] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setDebugEnabled(new URLSearchParams(window.location.search).get('debug') === 'hit-test');
  }, []);
  const [cursorWorldMm, setCursorWorldMm] = useState<Point2 | null>(null);

  const dispatchPlanPointer = useCallback(
    (kind: 'down' | 'move' | 'up', event: ReactPointerEvent<Element>, shape: Parameters<typeof dispatcher.dispatchPointerDown>[0]['shape']) => {
      const target = event.currentTarget as SVGElement;
      const point = clientPointToPlanProjection(
        target.ownerSVGElement ?? (target as unknown as SVGSVGElement),
        event.clientX,
        event.clientY,
        coordinateAdapter,
        // Pass the live pan/zoom transform so the cursor coord lands in the
        // same coord system as the rendered polygon `points`. Without this,
        // any non-identity pan or zoom causes the cursor's world coord to
        // drift away from the visible polygon edges (intermittent hover bug).
        transform,
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
    [coordinateAdapter, dispatcher, transform],
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
      if (debugEnabled) {
        const target = event.currentTarget as SVGElement;
        const point = clientPointToPlanProjection(
          target.ownerSVGElement ?? (target as unknown as SVGSVGElement),
          event.clientX,
          event.clientY,
          coordinateAdapter,
          transform,
        );
        setCursorWorldMm(point ? { x: point.x * 1000, y: point.y * 1000 } : null);
      }
    },
    [coordinateAdapter, debugEnabled, dispatchPlanPointer, panZoom, transform],
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
        style={{ display: 'block', cursor: dispatcher.activeTool.cursor ?? 'default' }}
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
            items={hitTargetItems}
            onShapePointerDown={(shape, event) => dispatchPlanPointer('down', event, shape)}
            onShapeEnter={onShapeEnter}
            onShapeLeave={onShapeLeave}
          />
          <PlanDimensionLayer dimensions={dimensions} coordinateAdapter={coordinateAdapter} />
          <PlanEdgeHoverHighlightLayer hover={edgeDragHover} coordinateAdapter={coordinateAdapter} />
          <PlanEdgeDragPreviewLayer preview={edgeDragPreview} coordinateAdapter={coordinateAdapter} />
          <PlanSnapIndicatorLayer preview={edgeDragPreview} coordinateAdapter={coordinateAdapter} />
          <PlanHitTestDebugLayer
            enabled={debugEnabled}
            activeOutlinePolygon={activeOutlinePolygon}
            cursorWorldMm={cursorWorldMm}
            hover={edgeDragHover}
            coordinateAdapter={coordinateAdapter}
          />
        </g>
      </svg>
    </div>
  );
}
