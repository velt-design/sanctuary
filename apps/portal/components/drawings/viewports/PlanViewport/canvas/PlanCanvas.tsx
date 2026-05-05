'use client';

import {
  useCallback,
  useMemo,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { PlanCoordinateAdapter } from '@/lib/drawings/views/plan/planCoordinateAdapter';
import type { DrawingWorkbenchViewportTransform } from '@/lib/drawings/state/drawingWorkbenchUiState';
import { clientPointToPlanProjection } from '../interactions/pointerToPlan';
import { useHoveredShape } from '../interactions/useHoveredShape';
import { usePanZoom } from '../interactions/usePanZoom';
import { useToolDispatcher } from '../tools/ToolDispatcher';
import { TranslationGizmo } from '../gizmos/TranslationGizmo';
import { PlanCommittedBodyLayer } from './layers/PlanCommittedBodyLayer';
import { PlanContextLineLayer } from './layers/PlanContextLineLayer';
import { PlanDetailLayer } from './layers/PlanDetailLayer';
import { PlanHitTargetLayer } from './layers/PlanHitTargetLayer';
import { PlanSelectionHaloLayer } from './layers/PlanSelectionHaloLayer';
import { planBoundsFromPolygon, type PlanBoundsMm } from './planLayout';
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
  transform: DrawingWorkbenchViewportTransform;
  onTransformChange: (next: DrawingWorkbenchViewportTransform) => void;
  screenAxisLabel: string;
};

function transformAttr(transform: DrawingWorkbenchViewportTransform): string {
  return `translate(${transform.panX} ${transform.panY}) scale(${transform.zoom})`;
}

function unionBounds(items: PlanRenderItem[]): PlanBoundsMm | null {
  let merged: PlanBoundsMm | null = null;
  for (const item of items) {
    const polygon = item.shape.polygon;
    const bounds = planBoundsFromPolygon(polygon);
    if (!bounds) continue;
    merged = merged
      ? {
          minX: Math.min(merged.minX, bounds.minX),
          minY: Math.min(merged.minY, bounds.minY),
          maxX: Math.max(merged.maxX, bounds.maxX),
          maxY: Math.max(merged.maxY, bounds.maxY),
        }
      : bounds;
  }
  return merged;
}

export function PlanCanvas({
  layout,
  coordinateAdapter,
  committedBodies,
  contextLines,
  detailLines,
  selectionHaloItems,
  transform,
  onTransformChange,
  screenAxisLabel,
}: PlanCanvasProps) {
  const dispatcher = useToolDispatcher();
  const { hoveredShape, onShapeEnter, onShapeLeave } = useHoveredShape();
  const panZoom = usePanZoom({ transform, onTransformChange });

  const dispatchPlanPointer = useCallback(
    (kind: 'down' | 'move' | 'up', event: ReactPointerEvent<Element>, shape: Parameters<typeof dispatcher.dispatchPointerDown>[0]['shape']) => {
      const point = clientPointToPlanProjection(
        event.currentTarget.ownerSVGElement ?? (event.currentTarget as unknown as SVGSVGElement),
        event.clientX,
        event.clientY,
        coordinateAdapter,
      );
      if (!point) return;
      const payload = {
        shape,
        point: { x: point.x * 1000, y: point.y * 1000 },
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

  const gizmoBounds = useMemo(() => unionBounds(selectionHaloItems), [selectionHaloItems]);

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
        data-plan-hover-shape-id={hoveredShape?.shapeId ?? ''}
        data-plan-hover-shape-kind={hoveredShape?.kind ?? ''}
        data-plan-active-tool-id={dispatcher.activeTool.id}
        onPointerDown={(event) => {
          handleEmptyPointerDown(event);
          panZoom.onPointerDown(event);
        }}
        onPointerMove={panZoom.onPointerMove}
        onPointerUp={panZoom.onPointerUp}
        onPointerCancel={panZoom.onPointerUp}
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
          {gizmoBounds ? <TranslationGizmo bounds={gizmoBounds} /> : null}
        </g>
      </svg>
    </div>
  );
}
