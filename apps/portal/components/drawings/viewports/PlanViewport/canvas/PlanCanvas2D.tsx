'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import styles from './PlanCanvas.module.css';
import type { DrawingWorkbenchViewportTransform } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { PlanRenderItem } from './planRenderItem';
import type { PlanLayout } from './planLayout';
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

const IDENTITY_TRANSFORM: DrawingWorkbenchViewportTransform = { zoom: 1, panX: 0, panY: 0 };
const WHEEL_COMMIT_DEBOUNCE_MS = 120;

/**
 * PR-WB-CANVAS step ① (2026-06-22): Canvas 2D Plan renderer (Tier 3). Draws
 * the same render-model items the SVG path draws, but onto a single
 * `<canvas>` with the pan/zoom transform as a camera — no per-shape DOM, so
 * pan/zoom is a single paint regardless of element count. Flag-gated; the
 * SVG path stays the default until parity (hit-testing, dimensions,
 * previews, tests) lands in steps ②–⑥.
 */
export type PlanCanvas2DProps = {
  layout: PlanLayout;
  committedBodies: PlanRenderItem[];
  diagnosticFallbackItems: PlanRenderItem[];
  contextLines: PlanRenderItem[];
  detailLines: PlanRenderItem[];
  selectionHaloItems: PlanRenderItem[];
  hoverHaloItems?: PlanRenderItem[];
  transform: DrawingWorkbenchViewportTransform;
  onTransformChange: (next: DrawingWorkbenchViewportTransform) => void;
  screenAxisLabel: string;
};

type Camera = { a: number; d: number; e: number; f: number; scale: number; scaleFit: number };

function parseViewBox(viewBox: string): [number, number, number, number] {
  const [minX, minY, w, h] = viewBox.split(/\s+/).map(Number);
  return [minX ?? 0, minY ?? 0, w || 1, h || 1];
}

function fit(layout: PlanLayout, cssW: number, cssH: number) {
  const [minX, minY, vbW, vbH] = parseViewBox(layout.viewBox);
  const scaleFit = Math.min(cssW / vbW, cssH / vbH) || 1;
  const offsetX = (cssW - vbW * scaleFit) / 2;
  const offsetY = (cssH - vbH * scaleFit) / 2;
  return { minX, minY, scaleFit, offsetX, offsetY };
}

export function PlanCanvas2D({
  layout,
  committedBodies,
  diagnosticFallbackItems,
  contextLines,
  detailLines,
  selectionHaloItems,
  hoverHaloItems = [],
  transform,
  onTransformChange,
  screenAxisLabel,
}: PlanCanvas2DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveTransformRef = useRef(transform);
  const panRef = useRef<{ pointerId: number; startClientX: number; startClientY: number; startPanX: number; startPanY: number } | null>(null);
  const wheelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Latest render data, read by the imperative draw without re-binding it.
  const dataRef = useRef({ layout, committedBodies, diagnosticFallbackItems, contextLines, detailLines, selectionHaloItems, hoverHaloItems });
  dataRef.current = { layout, committedBodies, diagnosticFallbackItems, contextLines, detailLines, selectionHaloItems, hoverHaloItems };

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
        ctx.lineWidth = style.widthPx / scale; // non-scaling-stroke: constant screen px
        ctx.setLineDash(style.dash ? style.dash.map((v) => v / scale) : []);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    },
    [],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
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
    const cam: Camera = {
      a: dpr * scaleFit * t.zoom,
      d: dpr * scaleFit * t.zoom,
      e: dpr * (offsetX + scaleFit * (t.panX - minX)),
      f: dpr * (offsetY + scaleFit * (t.panY - minY)),
      scale: scaleFit * t.zoom,
      scaleFit,
    };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(cam.a, 0, 0, cam.d, cam.e, cam.f);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Painter's order mirrors the SVG layer stack.
    for (const item of data.committedBodies) strokePoly(ctx, item.points, canvasCommittedBodyStyle(item.shape), cam.scale, true);
    for (const item of data.contextLines) strokePoly(ctx, item.points, CANVAS_CONTEXT_LINE_STYLE, cam.scale, false);
    for (const item of data.diagnosticFallbackItems) {
      const style = planShapeIsPergolaDiagnosticFallback(item.shape) ? CANVAS_DIAGNOSTIC_FALLBACK_PERGOLA : CANVAS_DIAGNOSTIC_FALLBACK_HOUSE;
      strokePoly(ctx, item.points, style, cam.scale, true);
    }
    for (const item of data.detailLines) strokePoly(ctx, item.points, CANVAS_DETAIL_LINE_STYLE, cam.scale, false);
    for (const item of data.selectionHaloItems) strokePoly(ctx, item.points, CANVAS_SELECTION_HALO, cam.scale, true);
    for (const item of data.hoverHaloItems) strokePoly(ctx, item.points, CANVAS_HOVER_HALO, cam.scale, true);
  }, [strokePoly]);

  // Sync committed transform → live ref + redraw when props change. Layout
  // effect (not rAF): runs after layout so the canvas has its real size, and
  // works in backgrounded/headless tabs where rAF never ticks.
  useLayoutEffect(() => {
    liveTransformRef.current = transform;
    draw();
  }, [transform, committedBodies, diagnosticFallbackItems, contextLines, detailLines, selectionHaloItems, hoverHaloItems, layout, draw]);

  // Redraw on container resize.
  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(parent);
    return () => ro.disconnect();
  }, [draw]);

  useEffect(() => () => {
    if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
  }, []);

  const commit = useCallback(() => onTransformChange(liveTransformRef.current), [onTransformChange]);

  // Wheel zoom anchored at the cursor (constant-px, like the SVG path).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (event: WheelEvent) => {
      const rect = canvas.getBoundingClientRect();
      const { minX, minY, scaleFit, offsetX, offsetY } = fit(dataRef.current.layout, rect.width, rect.height);
      const anchor = {
        x: (event.clientX - rect.left - offsetX) / scaleFit + minX,
        y: (event.clientY - rect.top - offsetY) / scaleFit + minY,
      };
      const next = resolveWheelZoomedTransform({
        transform: liveTransformRef.current,
        deltaMode: event.deltaMode,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        anchor,
      });
      if (!next) return;
      event.preventDefault();
      liveTransformRef.current = next;
      draw();
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = setTimeout(commit, WHEEL_COMMIT_DEBOUNCE_MS);
    };
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, [draw, commit]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 2) return; // right-drag pan (left = future tools)
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const t = liveTransformRef.current;
    panRef.current = { pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, startPanX: t.panX, startPanY: t.panY };
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { scaleFit } = fit(dataRef.current.layout, canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height);
    liveTransformRef.current = {
      ...liveTransformRef.current,
      panX: pan.startPanX + (event.clientX - pan.startClientX) / scaleFit,
      panY: pan.startPanY + (event.clientY - pan.startClientY) / scaleFit,
    };
    draw();
  }, [draw]);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    panRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    commit();
  }, [commit]);

  const handleFitView = useCallback(() => onTransformChange(IDENTITY_TRANSFORM), [onTransformChange]);

  const committedBodyCount = committedBodies.length;
  const hitTargetCount = useMemo(() => committedBodies.length, [committedBodies]);

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
        style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }}
        role="img"
        aria-label="Plan editor"
        data-plan-viewport="true"
        data-plan-render-source="geometry-canvas"
        data-plan-render-status="ready"
        data-plan-screen-axis={screenAxisLabel}
        data-plan-committed-body-count={committedBodyCount}
        data-plan-hit-target-count={hitTargetCount}
        data-plan-selection-halo-count={selectionHaloItems.length}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
