'use client';

import type { PointerEvent as ReactPointerEvent } from 'react';
import type { DrawingWorkbenchViewportTransform } from '@/lib/drawings/state/drawingWorkbenchUiState';
import { useHoveredShape } from '../interactions/useHoveredShape';
import { usePanZoom } from '../interactions/usePanZoom';
import {
  useShapeSelection,
  type ShapeSelectionCallbacks,
} from '../interactions/useShapeSelection';
import { PlanCommittedBodyLayer } from './layers/PlanCommittedBodyLayer';
import { PlanContextLineLayer } from './layers/PlanContextLineLayer';
import { PlanHitTargetLayer } from './layers/PlanHitTargetLayer';
import { PlanSelectionHaloLayer } from './layers/PlanSelectionHaloLayer';
import type { PlanLayout } from './planLayout';
import type { PlanRenderItem } from './planRenderItem';

export type PlanCanvasProps = {
  layout: PlanLayout;
  committedBodies: PlanRenderItem[];
  contextLines: PlanRenderItem[];
  selectionHaloItems: PlanRenderItem[];
  transform: DrawingWorkbenchViewportTransform;
  onTransformChange: (next: DrawingWorkbenchViewportTransform) => void;
  selectionCallbacks: ShapeSelectionCallbacks;
  screenAxisLabel: string;
};

function transformAttr(transform: DrawingWorkbenchViewportTransform): string {
  return `translate(${transform.panX} ${transform.panY}) scale(${transform.zoom})`;
}

export function PlanCanvas({
  layout,
  committedBodies,
  contextLines,
  selectionHaloItems,
  transform,
  onTransformChange,
  selectionCallbacks,
  screenAxisLabel,
}: PlanCanvasProps) {
  const { select, clear } = useShapeSelection(selectionCallbacks);
  const { hoveredShape, onShapeEnter, onShapeLeave } = useHoveredShape();
  const panZoom = usePanZoom({ transform, onTransformChange });

  const handleEmptyPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    if (event.target !== event.currentTarget) return;
    clear();
  };

  return (
    <svg
      viewBox={layout.viewBox}
      width={layout.width}
      height={layout.height}
      overflow="visible"
      role="img"
      aria-label="Plan editor"
      data-plan-viewport="true"
      data-plan-render-source="geometry"
      data-plan-render-status="ready"
      data-plan-screen-axis={screenAxisLabel}
      data-plan-committed-body-count={committedBodies.length}
      data-plan-context-line-count={contextLines.length}
      data-plan-hover-shape-id={hoveredShape?.shapeId ?? ''}
      data-plan-hover-shape-kind={hoveredShape?.kind ?? ''}
      onPointerDown={(event) => {
        handleEmptyPointerDown(event);
        panZoom.onPointerDown(event);
      }}
      onPointerMove={panZoom.onPointerMove}
      onPointerUp={panZoom.onPointerUp}
      onPointerCancel={panZoom.onPointerUp}
      onWheel={panZoom.onWheel}
      onContextMenu={panZoom.onContextMenu}
    >
      <g transform={transformAttr(transform)} data-plan-transform="true">
        <PlanCommittedBodyLayer items={committedBodies} />
        <PlanContextLineLayer items={contextLines} />
        <PlanSelectionHaloLayer items={selectionHaloItems} />
        <PlanHitTargetLayer
          items={committedBodies}
          onSelectShape={select}
          onShapeEnter={onShapeEnter}
          onShapeLeave={onShapeLeave}
        />
      </g>
    </svg>
  );
}
