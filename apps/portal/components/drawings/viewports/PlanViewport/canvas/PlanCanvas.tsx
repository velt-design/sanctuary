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
import { PlanCanvas2D } from './PlanCanvas2D';
import { PlanCommittedBodyLayer } from './layers/PlanCommittedBodyLayer';
import { PlanContextLineLayer } from './layers/PlanContextLineLayer';
import { PlanDiagnosticFallbackLayer } from './layers/PlanDiagnosticFallbackLayer';
import { PlanDetailLayer } from './layers/PlanDetailLayer';
import { PlanDimensionLayer } from './layers/PlanDimensionLayer';
import { PlanEdgeDragPreviewLayer } from './layers/PlanEdgeDragPreviewLayer';
import { PlanEdgeHoverHighlightLayer } from './layers/PlanEdgeHoverHighlightLayer';
import { PlanHitTargetLayer } from './layers/PlanHitTargetLayer';
import { PlanSeamIconLayer } from './layers/PlanSeamIconLayer';
import type { PlanSeamIconTarget } from '../interactions/seams/seamIconTargets';
import { PlanHitTestDebugLayer } from './layers/PlanHitTestDebugLayer';
import { PlanHoverHaloLayer } from './layers/PlanHoverHaloLayer';
import { PlanLocalHoverLayer } from './layers/PlanLocalHoverLayer';
import { PlanMovePreviewLayer } from './layers/PlanMovePreviewLayer';
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
import type { ProjectPergolaRenderHealth } from '@/lib/drawings/state/projectObjectRenderPipeline';
import { planShapeIsPergolaDiagnosticFallback } from '@/lib/drawings/views/plan/planShapeOwnership';

const IDENTITY_TRANSFORM: DrawingWorkbenchViewportTransform = { zoom: 1, panX: 0, panY: 0 };

type PlanCanvasProps = {
  layout: PlanLayout;
  coordinateAdapter: PlanCoordinateAdapter;
  committedBodies: PlanRenderItem[];
  diagnosticFallbackItems: PlanRenderItem[];
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
  projectPergolaRenderHealth?: ReadonlyArray<ProjectPergolaRenderHealth>;
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
  /** Active outline polygon used for hit-testing — passed in for the debug overlay. */
  activeOutlinePolygon?: ReadonlyArray<Point2> | null;
  transform: DrawingWorkbenchViewportTransform;
  onTransformChange: (next: DrawingWorkbenchViewportTransform) => void;
  screenAxisLabel: string;
  /** PR-COMP-PHASE4b.3: seam icons (Join + Detach) rendered above geometry. */
  seamIconTargets?: ReadonlyArray<PlanSeamIconTarget>;
  onJoinHouseForms?: (input: { formAId: string; formBId: string }) => void;
  onDetachHouseFormAtSeam?: (input: { houseFormId: string; joinIndex: number }) => void;
};

const EMPTY_DIMENSIONS: ReadonlyArray<PlanDimension> = [];
const EMPTY_HOVER_HALO_ITEMS: PlanRenderItem[] = [];

export function PlanCanvas({
  layout,
  coordinateAdapter,
  committedBodies,
  diagnosticFallbackItems,
  contextLines,
  detailLines,
  hitTargetItems,
  selectionHaloItems,
  hoverHaloItems = EMPTY_HOVER_HALO_ITEMS,
  diagnostics,
  projectHouseProjectionHealth = [],
  projectPergolaRenderHealth = [],
  onHoverShape,
  dimensions = EMPTY_DIMENSIONS,
  edgeDragPreview = null,
  edgeDragHover = null,
  movePreview = null,
  movePreviewSourcePolygon = null,
  activeOutlinePolygon = null,
  transform,
  onTransformChange,
  screenAxisLabel,
  seamIconTargets,
  onJoinHouseForms,
  onDetachHouseFormAtSeam,
}: PlanCanvasProps) {
  const dispatcher = useToolDispatcher();
  const { hoveredShape, onShapeEnter, onShapeLeave } = useHoveredShape();
  const panZoom = usePanZoom({ transform, onTransformChange });
  const { getLiveTransform } = panZoom;
  const projectPergolaFallbackIds = useMemo(
    () =>
      Array.from(
        new Set(
          diagnosticFallbackItems
            .map((item) => item.shape)
            .filter(planShapeIsPergolaDiagnosticFallback)
            .map((shape) =>
              typeof shape.metadata?.pergolaId === 'string'
                ? shape.metadata.pergolaId
                : shape.sourceObjectId ?? shape.sourceId ?? null,
            )
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    [diagnosticFallbackItems],
  );
  const diagnosticFallbackIds = useMemo(
    () => diagnosticFallbackItems.map((item) => item.shape.id).sort(),
    [diagnosticFallbackItems],
  );
  const allHitTargetItems = hitTargetItems;
  const localHoverItems = useMemo(
    () =>
      buildPlanLocalHoverItems({
        hoveredShape,
        hitTargetItems: allHitTargetItems,
        diagnosticFallbackItems,
        selectionHaloItems,
      }),
    [allHitTargetItems, diagnosticFallbackItems, hoveredShape, selectionHaloItems],
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
  // PR-WB-CANVAS (Tier 3): opt into the canvas renderer with `?planRenderer=
  // canvas`. SVG stays the default until canvas parity is proven.
  const [useCanvasRenderer, setUseCanvasRenderer] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setDebugEnabled(params.get('debug') === 'hit-test');
    setUseCanvasRenderer(params.get('planRenderer') === 'canvas');
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
        // Pass the LIVE pan/zoom transform (not the committed React prop) so
        // the cursor coord lands in the same coord system as the rendered
        // polygon `points`. Pan/zoom now apply imperatively and commit to
        // React only on gesture end, so the prop lags during/just after a
        // gesture — reading the live ref keeps hit-testing exact. Without
        // this, any non-identity pan or zoom drifts the cursor's world coord
        // away from the visible polygon edges (intermittent hover bug).
        getLiveTransform(),
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
    [coordinateAdapter, dispatcher, getLiveTransform],
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

  // PR-WB-PERF-1 (2026-06-22): these diagnostic / health blobs are read by
  // tests and external tooling via `data-*` attrs, but serialising them on
  // every render put `JSON.stringify` on the interaction hot path. Memoise so
  // they only recompute when the underlying data changes — not on pan/zoom/
  // hover re-renders.
  const houseRenderDiagnosticsJson = useMemo(
    () => JSON.stringify(diagnostics.houses),
    [diagnostics.houses],
  );
  const houseProjectionHealthJson = useMemo(
    () => JSON.stringify(projectHouseProjectionHealth),
    [projectHouseProjectionHealth],
  );
  const pergolaRenderHealthJson = useMemo(
    () => JSON.stringify(projectPergolaRenderHealth),
    [projectPergolaRenderHealth],
  );

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
          getLiveTransform(),
        );
        setCursorWorldMm(point ? { x: point.x * 1000, y: point.y * 1000 } : null);
      }
    },
    [coordinateAdapter, debugEnabled, dispatchPlanPointer, panZoom, getLiveTransform],
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

  if (useCanvasRenderer) {
    return (
      <PlanCanvas2D
        layout={layout}
        coordinateAdapter={coordinateAdapter}
        committedBodies={committedBodies}
        diagnosticFallbackItems={diagnosticFallbackItems}
        contextLines={contextLines}
        detailLines={detailLines}
        hitTargetItems={allHitTargetItems}
        selectionHaloItems={selectionHaloItems}
        hoverHaloItems={hoverHaloItems}
        dimensions={dimensions}
        onHoverShape={onHoverShape}
        transform={transform}
        onTransformChange={onTransformChange}
        screenAxisLabel={screenAxisLabel}
      />
    );
  }

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
        data-plan-diagnostic-fallback-count={diagnosticFallbackItems.length}
        data-plan-diagnostic-fallback-ids={diagnosticFallbackIds.join(',')}
        data-plan-context-line-count={contextLines.length}
        data-plan-detail-line-count={detailLines.length}
        data-plan-hit-target-count={allHitTargetItems.length}
        data-plan-visible-reference-fallback-count={diagnostics.visibleReferenceFallbackIds.length}
        data-plan-visible-reference-fallback-ids={diagnostics.visibleReferenceFallbackIds.join(',')}
        data-plan-house-render-diagnostics={houseRenderDiagnosticsJson}
        data-plan-house-projection-health={houseProjectionHealthJson}
        data-plan-house-projection-health-count={projectHouseProjectionHealth.length}
        data-plan-pergola-render-health={pergolaRenderHealthJson}
        data-plan-pergola-render-health-count={projectPergolaRenderHealth.length}
        data-plan-pergola-fallback-count={projectPergolaFallbackIds.length}
        data-plan-pergola-fallback-ids={projectPergolaFallbackIds.join(',')}
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
        <g ref={panZoom.groupRef} data-plan-transform="true">
          <PlanCommittedBodyLayer items={committedBodies} />
          <PlanContextLineLayer items={contextLines} />
          <PlanDiagnosticFallbackLayer items={diagnosticFallbackItems} />
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
          {seamIconTargets ? (
            <PlanSeamIconLayer
              targets={seamIconTargets}
              coordinateAdapter={coordinateAdapter}
              onJoin={onJoinHouseForms}
              onDetach={onDetachHouseFormAtSeam}
            />
          ) : null}
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
