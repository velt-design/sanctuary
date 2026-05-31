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
import { buildPointerDispatchAction } from './pointerDispatch';
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
import { PlanHoverHaloLayer } from './layers/PlanHoverHaloLayer';
import { PlanLocalHoverLayer } from './layers/PlanLocalHoverLayer';
import { PlanMovePreviewLayer } from './layers/PlanMovePreviewLayer';
import { PlanProjectContextLayer } from './layers/PlanProjectContextLayer';
import { PlanSelectionHaloLayer } from './layers/PlanSelectionHaloLayer';
import {
  PlanMoveSnapIndicatorLayer,
  PlanSnapIndicatorLayer,
} from './layers/PlanSnapIndicatorLayer';
import type { GeometryTopProjectionShape } from '@sp/geometry';
import type { PlanDimension } from './planDimension';
import type { EdgeDragHover, EdgeDragPreview } from '../tools/EdgeDragTool';
import type { MoveToolPreview } from '../tools/MoveTool';
import styles from './PlanCanvas.module.css';
import type { PlanLayout } from './planLayout';
import type { Point2 } from './polygonEdgeMath';
import type { PlanRenderItem } from './planRenderItem';
import { buildPlanLocalHoverItems } from './usePlanLocalHoverItems';
import type { PlanRenderDiagnostics } from '@/lib/drawings/views/plan/planRenderDiagnostics';
import type { ProjectHouseProjectionHealth } from '@/lib/drawings/state/projectHouseProjectionHealth';

const IDENTITY_TRANSFORM: DrawingWorkbenchViewportTransform = { zoom: 1, panX: 0, panY: 0 };

type PlanCanvasProps = {
  layout: PlanLayout;
  coordinateAdapter: PlanCoordinateAdapter;
  committedBodies: PlanRenderItem[];
  contextLines: PlanRenderItem[];
  detailLines: PlanRenderItem[];
  hitTargetItems: PlanRenderItem[];
  selectionHaloItems: PlanRenderItem[];
  /**
   * Cross-viewport hover halo items. Empty when no external hover (e.g. 3D
   * pointer-over) is active. Rendered as a lighter-weight outline than the
   * selection halo so the active selection still reads as primary.
   */
  hoverHaloItems?: PlanRenderItem[];
  diagnostics: PlanRenderDiagnostics;
  projectHouseProjectionHealth?: ReadonlyArray<ProjectHouseProjectionHealth>;
  /**
   * Fires when the local pointer enters or leaves a top-projection shape.
   * Receives the full shape on enter, `null` on leave. Used by PlanViewport
   * to classify the shape into a `WorkbenchObjectRef` and emit cross-
   * viewport hover state. Local hover styling (data attrs, hit-target hover)
   * remains driven by `useHoveredShape` independently.
   */
  onHoverShape?: (shape: GeometryTopProjectionShape | null) => void;
  dimensions?: ReadonlyArray<PlanDimension>;
  edgeDragPreview?: EdgeDragPreview | null;
  edgeDragHover?: EdgeDragHover | null;
  movePreview?: MoveToolPreview | null;
  /** World-coord polygon (mm) of the object being moved; used by PlanMovePreviewLayer. */
  movePreviewSourcePolygon?: ReadonlyArray<Point2> | null;
  /**
   * Faded fallback outlines for pergolas without full project-wide plan
   * detail. Full valid pergolas render through committed bodies.
   */
  projectContextShapes?: ReadonlyArray<GeometryTopProjectionShape>;
  /** Active outline polygon used for hit-testing — passed in for the debug overlay. */
  activeOutlinePolygon?: ReadonlyArray<Point2> | null;
  transform: DrawingWorkbenchViewportTransform;
  onTransformChange: (next: DrawingWorkbenchViewportTransform) => void;
  screenAxisLabel: string;
};

const EMPTY_DIMENSIONS: ReadonlyArray<PlanDimension> = [];
const EMPTY_PROJECT_CONTEXT_SHAPES: ReadonlyArray<GeometryTopProjectionShape> = [];
const EMPTY_HOVER_HALO_ITEMS: PlanRenderItem[] = [];

function transformAttr(transform: DrawingWorkbenchViewportTransform): string {
  return `translate(${transform.panX} ${transform.panY}) scale(${transform.zoom})`;
}

export function PlanCanvas({
  layout,
  coordinateAdapter,
  committedBodies,
  contextLines,
  detailLines,
  hitTargetItems,
  selectionHaloItems,
  hoverHaloItems = EMPTY_HOVER_HALO_ITEMS,
  diagnostics,
  projectHouseProjectionHealth = [],
  onHoverShape,
  dimensions = EMPTY_DIMENSIONS,
  edgeDragPreview = null,
  edgeDragHover = null,
  movePreview = null,
  movePreviewSourcePolygon = null,
  projectContextShapes = EMPTY_PROJECT_CONTEXT_SHAPES,
  activeOutlinePolygon = null,
  transform,
  onTransformChange,
  screenAxisLabel,
}: PlanCanvasProps) {
  const dispatcher = useToolDispatcher();
  const { hoveredShape, onShapeEnter, onShapeLeave } = useHoveredShape();
  const panZoom = usePanZoom({ transform, onTransformChange });
  const projectContextHitTargetItems = useMemo<PlanRenderItem[]>(
    () =>
      projectContextShapes
        .filter((shape) => shape.sourceType === 'pergola_reference')
        .map((shape) => ({
          shape,
          points: coordinateAdapter.projectionPolygonToSvg(shape.polygon),
          layer: 'committedBodies' as const,
        }))
        .filter((item) => item.points.length >= 3),
    [coordinateAdapter, projectContextShapes],
  );
  const allHitTargetItems = useMemo(
    () => [...projectContextHitTargetItems, ...hitTargetItems],
    [hitTargetItems, projectContextHitTargetItems],
  );
  const localHoverItems = useMemo(
    () =>
      buildPlanLocalHoverItems({
        hoveredShape,
        hitTargetItems: allHitTargetItems,
        selectionHaloItems,
      }),
    [allHitTargetItems, hoveredShape, selectionHaloItems],
  );

  // Wrap the local hover handlers so we ALSO emit the full shape upward via
  // `onHoverShape`. PlanViewport classifies it into a `WorkbenchObjectRef`
  // and publishes cross-viewport hover state. Local hover styling
  // (data-plan-hover-shape-id, hit-target hover) stays driven by the local
  // `useHoveredShape` so we don't depend on the parent for visual feedback.
  const handleShapeEnterWithEmit = useCallback(
    (shape: GeometryTopProjectionShape) => {
      onShapeEnter(shape);
      onHoverShape?.(shape);
    },
    [onHoverShape, onShapeEnter],
  );
  const handleShapeLeaveWithEmit = useCallback(
    (shapeId: string) => {
      onShapeLeave(shapeId);
      onHoverShape?.(null);
    },
    [onHoverShape, onShapeLeave],
  );

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
      // The decision tree (skip-on-null, scale to mm, capture-on-down) lives
      // in the pure `buildPointerDispatchAction` helper so it can be tested
      // without a DOM. See `docs/maintainability-principles.md` footgun #5
      // for the contract.
      const action = buildPointerDispatchAction({
        kind,
        point,
        shape,
        button: event.button,
        pointerId: event.pointerId,
      });
      if (action.type === 'skip') return;
      if (action.capture && typeof event.currentTarget.setPointerCapture === 'function') {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Capture is best-effort; older browsers / synthetic events may
          // throw. Fall through and dispatch normally.
        }
      }
      if (action.kind === 'down') dispatcher.dispatchPointerDown(action.payload);
      if (action.kind === 'move') dispatcher.dispatchPointerMove(action.payload);
      if (action.kind === 'up') dispatcher.dispatchPointerUp(action.payload);
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

  const handlePointerCancel = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      // PointerCancel fires when the OS interrupts a gesture (palm rejection,
      // focus loss, scroll/touch-action capture). The React event's clientX/Y
      // is typically zeroed -- treating it as a pointerUp would dispatch a
      // synthetic "release" at world coords derived from screen (0, 0), which
      // for any non-trivial pan/zoom maps to a wildly off-canvas world point.
      // The MoveTool would then commit `delta = bogusEnd - realStart`, jumping
      // the deck by an amount roughly proportional to its on-screen distance
      // from the page corner -- the runaway drift the user reported.
      //
      // Correct response: cancel any active tool session. The user's
      // mid-cancellation drag is discarded; the deck stays where it was.
      dispatcher.cancelActiveTool();
      panZoom.onPointerUp(event);
    },
    [dispatcher, panZoom],
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
        data-plan-hit-target-count={allHitTargetItems.length}
        data-plan-visible-reference-fallback-count={diagnostics.visibleReferenceFallbackIds.length}
        data-plan-visible-reference-fallback-ids={diagnostics.visibleReferenceFallbackIds.join(',')}
        data-plan-house-render-diagnostics={JSON.stringify(diagnostics.houses)}
        data-plan-house-projection-health={JSON.stringify(projectHouseProjectionHealth)}
        data-plan-house-projection-health-count={projectHouseProjectionHealth.length}
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
        onPointerCancel={handlePointerCancel}
        onContextMenu={panZoom.onContextMenu}
      >
        <g transform={transformAttr(transform)} data-plan-transform="true">
          <PlanProjectContextLayer
            shapes={projectContextShapes}
            coordinateAdapter={coordinateAdapter}
          />
          <PlanCommittedBodyLayer items={committedBodies} />
          <PlanContextLineLayer items={contextLines} />
          <PlanDetailLayer items={detailLines} />
          <PlanSelectionHaloLayer items={selectionHaloItems} />
          <PlanHoverHaloLayer items={hoverHaloItems} />
          <PlanLocalHoverLayer items={localHoverItems} />
          <PlanHitTargetLayer
            items={allHitTargetItems}
            onShapePointerDown={(shape, event) => dispatchPlanPointer('down', event, shape)}
            onShapeEnter={handleShapeEnterWithEmit}
            onShapeLeave={handleShapeLeaveWithEmit}
          />
          <PlanDimensionLayer dimensions={dimensions} coordinateAdapter={coordinateAdapter} />
          <PlanEdgeHoverHighlightLayer hover={edgeDragHover} coordinateAdapter={coordinateAdapter} />
          <PlanEdgeDragPreviewLayer preview={edgeDragPreview} coordinateAdapter={coordinateAdapter} />
          <PlanMovePreviewLayer
            preview={movePreview}
            sourcePolygonMm={movePreviewSourcePolygon}
            coordinateAdapter={coordinateAdapter}
          />
          <PlanSnapIndicatorLayer preview={edgeDragPreview} coordinateAdapter={coordinateAdapter} />
          <PlanMoveSnapIndicatorLayer
            preview={movePreview}
            sourcePolygonMm={movePreviewSourcePolygon}
            coordinateAdapter={coordinateAdapter}
          />
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
