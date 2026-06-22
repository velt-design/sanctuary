'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { GeometryTopProjectionShape } from '@sp/geometry';
import styles from './PlanCanvas.module.css';
import type { DrawingWorkbenchViewportTransform } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { PlanCoordinateAdapter } from '@/lib/drawings/views/plan/planCoordinateAdapter';
import type { PlanRenderItem } from './planRenderItem';
import type { PlanLayout } from './planLayout';
import type { Point2 } from './polygonEdgeMath';
import { planShapeIsPergolaDiagnosticFallback } from '@/lib/drawings/views/plan/planShapeOwnership';
import {
  canvasCommittedBodyStyle,
  CANVAS_CONTEXT_LINE_STYLE,
  CANVAS_DETAIL_LINE_STYLE,
  CANVAS_DIAGNOSTIC_FALLBACK_HOUSE,
  CANVAS_DIAGNOSTIC_FALLBACK_PERGOLA,
  CANVAS_SELECTION_HALO,
  CANVAS_HOVER_HALO,
  type CanvasShapeStyle,
} from './canvasShapeStyle';
import { resolveWheelZoomedTransform } from '../interactions/usePanZoom';
import { useToolDispatcher } from '../tools/ToolDispatcher';
import { useHoveredShape } from '../interactions/useHoveredShape';
import { buildPointerDispatchAction } from './pointerDispatch';

const IDENTITY_TRANSFORM: DrawingWorkbenchViewportTransform = { zoom: 1, panX: 0, panY: 0 };
const WHEEL_COMMIT_DEBOUNCE_MS = 120;
const LOCAL_HOVER_STYLE: CanvasShapeStyle = { stroke: '#7b8288', widthPx: 1, fill: null, dash: [5, 3] };

/**
 * PR-WB-CANVAS step ② (2026-06-22): Canvas 2D Plan renderer with interaction.
 * Step ① proved render + camera; this adds GEOMETRIC hit-testing so click-
 * select / drag / hover work without per-shape DOM. Pointer events map to
 * world coords via the inverse camera, hit-test by point-in-polygon over the
 * (renderer-agnostic) hit-target items, and dispatch through the SAME tool
 * dispatcher + `buildPointerDispatchAction` the SVG path uses. Flag-gated.
 * Still NOT on canvas: dimensions/text, drag/snap previews (steps ③–④).
 */
export type PlanCanvas2DProps = {
  layout: PlanLayout;
  coordinateAdapter: PlanCoordinateAdapter;
  committedBodies: PlanRenderItem[];
  diagnosticFallbackItems: PlanRenderItem[];
  contextLines: PlanRenderItem[];
  detailLines: PlanRenderItem[];
  hitTargetItems: PlanRenderItem[];
  selectionHaloItems: PlanRenderItem[];
  hoverHaloItems?: PlanRenderItem[];
  onHoverShape?: (shape: GeometryTopProjectionShape | null) => void;
  transform: DrawingWorkbenchViewportTransform;
  onTransformChange: (next: DrawingWorkbenchViewportTransform) => void;
  screenAxisLabel: string;
};

function parseViewBox(viewBox: string): [number, number, number, number] {
  const [minX, minY, w, h] = viewBox.split(/\s+/).map(Number);
  return [minX ?? 0, minY ?? 0, w || 1, h || 1];
}

function fit(layout: PlanLayout, cssW: number, cssH: number) {
  const [minX, minY, vbW, vbH] = parseViewBox(layout.viewBox);
  const scaleFit = Math.min(cssW / vbW, cssH / vbH) || 1;
  return { minX, minY, scaleFit, offsetX: (cssW - vbW * scaleFit) / 2, offsetY: (cssH - vbH * scaleFit) / 2 };
}

function pointInPolygon(pt: Point2, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]!.x, yi = poly[i]!.y, xj = poly[j]!.x, yj = poly[j]!.y;
    if (yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi || 1e-9) + xi) inside = !inside;
  }
  return inside;
}

export function PlanCanvas2D({
  layout,
  coordinateAdapter,
  committedBodies,
  diagnosticFallbackItems,
  contextLines,
  detailLines,
  hitTargetItems,
  selectionHaloItems,
  hoverHaloItems = [],
  onHoverShape,
  transform,
  onTransformChange,
  screenAxisLabel,
}: PlanCanvas2DProps) {
  const dispatcher = useToolDispatcher();
  const { hoveredShape, onShapeEnter, onShapeLeave } = useHoveredShape();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveTransformRef = useRef(transform);
  const panRef = useRef<{ pointerId: number; startClientX: number; startClientY: number; startPanX: number; startPanY: number } | null>(null);
  const wheelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dataRef = useRef({ layout, committedBodies, diagnosticFallbackItems, contextLines, detailLines, hitTargetItems, selectionHaloItems, hoverHaloItems, hoveredShapeId: hoveredShape?.shapeId ?? null });
  dataRef.current = { layout, committedBodies, diagnosticFallbackItems, contextLines, detailLines, hitTargetItems, selectionHaloItems, hoverHaloItems, hoveredShapeId: hoveredShape?.shapeId ?? null };

  const strokePoly = useCallback(
    (ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], style: CanvasShapeStyle, scale: number, close: boolean) => {
      if (pts.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(pts[0]!.x, pts[0]!.y);
      for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i]!.x, pts[i]!.y);
      if (close) ctx.closePath();
      if (style.fill) {
        ctx.fillStyle = style.fill;
        ctx.fill();
      }
      if (style.stroke && style.widthPx > 0) {
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = style.widthPx / scale;
        ctx.setLineDash(style.dash ? style.dash.map((v) => v / scale) : []);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    },
    [],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = parent.clientWidth;
    const cssH = parent.clientHeight;
    if (cssW === 0 || cssH === 0) return;
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const t = liveTransformRef.current;
    const data = dataRef.current;
    const { minX, minY, scaleFit, offsetX, offsetY } = fit(data.layout, cssW, cssH);
    const scale = scaleFit * t.zoom;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (offsetX + scaleFit * (t.panX - minX)), dpr * (offsetY + scaleFit * (t.panY - minY)));
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (const item of data.committedBodies) strokePoly(ctx, item.points, canvasCommittedBodyStyle(item.shape), scale, true);
    for (const item of data.contextLines) strokePoly(ctx, item.points, CANVAS_CONTEXT_LINE_STYLE, scale, false);
    for (const item of data.diagnosticFallbackItems) strokePoly(ctx, item.points, planShapeIsPergolaDiagnosticFallback(item.shape) ? CANVAS_DIAGNOSTIC_FALLBACK_PERGOLA : CANVAS_DIAGNOSTIC_FALLBACK_HOUSE, scale, true);
    for (const item of data.detailLines) strokePoly(ctx, item.points, CANVAS_DETAIL_LINE_STYLE, scale, false);
    if (data.hoveredShapeId) {
      const hovered = data.hitTargetItems.find((i) => i.shape.id === data.hoveredShapeId);
      if (hovered) strokePoly(ctx, hovered.points, LOCAL_HOVER_STYLE, scale, true);
    }
    for (const item of data.selectionHaloItems) strokePoly(ctx, item.points, CANVAS_SELECTION_HALO, scale, true);
    for (const item of data.hoverHaloItems) strokePoly(ctx, item.points, CANVAS_HOVER_HALO, scale, true);
  }, [strokePoly]);

  useLayoutEffect(() => {
    liveTransformRef.current = transform;
    draw();
  }, [transform, committedBodies, diagnosticFallbackItems, contextLines, detailLines, hitTargetItems, selectionHaloItems, hoverHaloItems, hoveredShape, layout, draw]);

  useEffect(() => {
    const parent = canvasRef.current?.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(parent);
    return () => ro.disconnect();
  }, [draw]);

  useEffect(() => () => { if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current); }, []);

  const commit = useCallback(() => onTransformChange(liveTransformRef.current), [onTransformChange]);

  // client px → local (pre-camera) space, the space hit-target `points` and
  // `adapter.svgToProjectionPlanPoint` operate in.
  const clientToLocal = useCallback((clientX: number, clientY: number): Point2 | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const { minX, minY, scaleFit, offsetX, offsetY } = fit(dataRef.current.layout, rect.width, rect.height);
    const t = liveTransformRef.current;
    const vbx = (clientX - rect.left - offsetX) / scaleFit + minX;
    const vby = (clientY - rect.top - offsetY) / scaleFit + minY;
    return { x: (vbx - t.panX) / t.zoom, y: (vby - t.panY) / t.zoom };
  }, []);

  const hitTest = useCallback((local: Point2): PlanRenderItem | null => {
    const items = dataRef.current.hitTargetItems;
    for (let i = items.length - 1; i >= 0; i -= 1) {
      if (pointInPolygon(local, items[i]!.points)) return items[i]!;
    }
    return null;
  }, []);

  const dispatchPointer = useCallback(
    (kind: 'down' | 'move' | 'up', event: ReactPointerEvent<HTMLCanvasElement>, shape: GeometryTopProjectionShape | null) => {
      const local = clientToLocal(event.clientX, event.clientY);
      const point = local ? coordinateAdapter.svgToProjectionPlanPoint(local) : null;
      const action = buildPointerDispatchAction({ kind, point, shape, button: event.button, pointerId: event.pointerId });
      if (action.type === 'skip') return;
      if (action.capture) {
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* best-effort */ }
      }
      if (action.kind === 'down') dispatcher.dispatchPointerDown(action.payload);
      else if (action.kind === 'move') dispatcher.dispatchPointerMove(action.payload);
      else dispatcher.dispatchPointerUp(action.payload);
    },
    [clientToLocal, coordinateAdapter, dispatcher],
  );

  // Wheel zoom anchored at the cursor.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (event: WheelEvent) => {
      const local = clientToLocal(event.clientX, event.clientY);
      // anchor must be in viewBox space (pre-camera-fit, post-pan/zoom-free):
      const rect = canvas.getBoundingClientRect();
      const { minX, minY, scaleFit, offsetX, offsetY } = fit(dataRef.current.layout, rect.width, rect.height);
      const anchor = { x: (event.clientX - rect.left - offsetX) / scaleFit + minX, y: (event.clientY - rect.top - offsetY) / scaleFit + minY };
      void local;
      const next = resolveWheelZoomedTransform({ transform: liveTransformRef.current, deltaMode: event.deltaMode, deltaX: event.deltaX, deltaY: event.deltaY, anchor });
      if (!next) return;
      event.preventDefault();
      liveTransformRef.current = next;
      draw();
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = setTimeout(commit, WHEEL_COMMIT_DEBOUNCE_MS);
    };
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, [draw, commit, clientToLocal]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.button === 2) {
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      const t = liveTransformRef.current;
      panRef.current = { pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, startPanX: t.panX, startPanY: t.panY };
      return;
    }
    if (event.button !== 0) return;
    const local = clientToLocal(event.clientX, event.clientY);
    const hit = local ? hitTest(local) : null;
    dispatchPointer('down', event, hit?.shape ?? null);
  }, [clientToLocal, hitTest, dispatchPointer]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const pan = panRef.current;
    if (pan && pan.pointerId === event.pointerId) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const { scaleFit } = fit(dataRef.current.layout, rect.width, rect.height);
      liveTransformRef.current = { ...liveTransformRef.current, panX: pan.startPanX + (event.clientX - pan.startClientX) / scaleFit, panY: pan.startPanY + (event.clientY - pan.startClientY) / scaleFit };
      draw();
      return;
    }
    // Tool drag (active tool tracks its own session).
    dispatchPointer('move', event, null);
    // Hover.
    const local = clientToLocal(event.clientX, event.clientY);
    const hit = local ? hitTest(local) : null;
    const nextId = hit?.shape.id ?? null;
    if (nextId !== (hoveredShape?.shapeId ?? null)) {
      if (hoveredShape) onShapeLeave(hoveredShape.shapeId);
      if (hit) onShapeEnter(hit.shape);
      onHoverShape?.(hit?.shape ?? null);
    }
  }, [clientToLocal, hitTest, dispatchPointer, draw, hoveredShape, onShapeEnter, onShapeLeave, onHoverShape]);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const pan = panRef.current;
    if (pan && pan.pointerId === event.pointerId) {
      panRef.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      commit();
      return;
    }
    if (event.button !== 0) return;
    dispatchPointer('up', event, null);
  }, [commit, dispatchPointer]);

  const handleFitView = useCallback(() => onTransformChange(IDENTITY_TRANSFORM), [onTransformChange]);

  const hitTargetCount = useMemo(() => hitTargetItems.length, [hitTargetItems]);

  return (
    <div className={styles.canvasShell}>
      <div className={styles.toolbar} role="toolbar" aria-label="Plan canvas controls">
        <button type="button" className={styles.toolbarButton} onClick={handleFitView} data-plan-canvas-action="fit-view">
          Fit view
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className={styles.canvasSvg}
        style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', cursor: dispatcher.activeTool.cursor ?? 'default' }}
        role="img"
        aria-label="Plan editor"
        data-plan-viewport="true"
        data-plan-render-source="geometry-canvas"
        data-plan-render-status="ready"
        data-plan-screen-axis={screenAxisLabel}
        data-plan-committed-body-count={committedBodies.length}
        data-plan-hit-target-count={hitTargetCount}
        data-plan-selection-halo-count={selectionHaloItems.length}
        data-plan-hover-shape-id={hoveredShape?.shapeId ?? ''}
        data-plan-active-tool-id={dispatcher.activeTool.id}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
