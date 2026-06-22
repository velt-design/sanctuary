'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { GeometryTopProjectionShape, Point2 } from '@sp/geometry';
import styles from './PlanCanvas.module.css';
import type { DrawingWorkbenchViewportTransform } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { PlanCoordinateAdapter } from '@/lib/drawings/views/plan/planCoordinateAdapter';
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
} from './canvasShapeStyle';
import { resolveWheelZoomedTransform } from '../interactions/usePanZoom';
import { useToolDispatcher } from '../tools/ToolDispatcher';
import { useHoveredShape } from '../interactions/useHoveredShape';
import { buildPointerDispatchAction } from './pointerDispatch';
import { resolvePlanDimensionGeometry, type PlanDimension } from './planDimension';
import type { EdgeDragHover, EdgeDragPreview } from '../tools/EdgeDragTool';
import type { MoveToolPreview } from '../tools/MoveTool';
import type { PlanSeamIconTarget } from '../interactions/seams/seamIconTargets';

const IDENTITY_TRANSFORM: DrawingWorkbenchViewportTransform = { zoom: 1, panX: 0, panY: 0 };
const WHEEL_COMMIT_DEBOUNCE_MS = 120;
type CanvasShapeStyle = typeof CANVAS_CONTEXT_LINE_STYLE;
const LOCAL_HOVER_STYLE: CanvasShapeStyle = { stroke: '#7b8288', widthPx: 1, fill: null, dash: [5, 3] };

// Preview / snap / seam overlays use concrete Canvas 2D styles. Outline
// polygons + lines draw in CAMERA space (constant-px stroke); markers, labels
// and seam chips draw in DEVICE space (constant on-screen size).
const SNAP_COLOR = '#ff6b00';
const SELECTION_COLOR = '#2f6f96';
const EDGE_DRAG_PREVIEW_STYLE: CanvasShapeStyle = { stroke: SNAP_COLOR, widthPx: 1.5, fill: 'rgba(255, 107, 0, 0.06)', dash: [4, 2] };
const EDGE_HOVER_LINE_STYLE: CanvasShapeStyle = { stroke: SNAP_COLOR, widthPx: 4, fill: null };
const MOVE_PREVIEW_STYLE: CanvasShapeStyle = { stroke: SELECTION_COLOR, widthPx: 1.5, fill: 'rgba(47, 111, 150, 0.10)', dash: [6, 3] };
const SNAP_LINE_STYLE: CanvasShapeStyle = { stroke: SNAP_COLOR, widthPx: 3, fill: null };
const SEAM_ICON_RADIUS_PX = 9;
const SEAM_ICON_HIT_RADIUS_PX = 11;

const SNAP_KIND_LABEL: Record<string, string> = { roof_eave: 'Roof eave', wall: 'Wall', pergola_outline: 'Pergola' };

function midpoint(a: Point2, b: Point2): Point2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function translatedMidpoint(poly: ReadonlyArray<Point2>, edgeIndex: number, delta: Point2): Point2 | null {
  const s = poly[edgeIndex];
  const en = poly[(edgeIndex + 1) % poly.length];
  if (!s || !en) return null;
  return { x: (s.x + en.x) / 2 + delta.x, y: (s.y + en.y) / 2 + delta.y };
}

function drawMarkerDot(ctx: CanvasRenderingContext2D, x: number, y: number, radiusPx: number, dpr: number): void {
  ctx.beginPath();
  ctx.arc(x, y, radiusPx * dpr, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = SNAP_COLOR;
  ctx.lineWidth = 1 * dpr;
  ctx.stroke();
}

function drawSnapLabel(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, dpr: number): void {
  ctx.font = `600 ${10 * dpr}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3 * dpr;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.strokeText(text, x, y - 12 * dpr);
  ctx.fillStyle = SNAP_COLOR;
  ctx.fillText(text, x, y - 12 * dpr);
}

function drawSeamIcon(ctx: CanvasRenderingContext2D, x: number, y: number, kind: 'detach' | 'join', dpr: number): void {
  ctx.beginPath();
  ctx.arc(x, y, SEAM_ICON_RADIUS_PX * dpr, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = SNAP_COLOR;
  ctx.lineWidth = 1.5 * dpr;
  ctx.stroke();
  ctx.font = `600 ${13 * dpr}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = SNAP_COLOR;
  ctx.fillText(kind === 'detach' ? '–' : '+', x, y + dpr);
}

// Dimension styling is drawn in DEVICE space (constant on-screen
// size at any zoom — the CAD convention), not the camera-scaled body space.
const DIM_STROKE = '#2a3a55';
const DIM_LABEL_FILL = '#14172e';
const DIM_LABEL_HALO = 'rgba(255, 255, 255, 0.95)';
const DIM_LINE_WIDTH_PX = 0.5;
const DIM_ARROW_LENGTH_PX = 6;
const DIM_ARROW_HALF_WIDTH_PX = 2.5;
const DIM_LABEL_OFFSET_PX = 4;
const DIM_LABEL_FONT_PX = 11;
const DIM_LABEL_HALO_WIDTH_PX = 3;

type DevicePoint = { x: number; y: number };

function drawDimensionArrow(ctx: CanvasRenderingContext2D, tip: DevicePoint, towards: DevicePoint, dpr: number): void {
  const dx = towards.x - tip.x;
  const dy = towards.y - tip.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return;
  const ux = dx / len;
  const uy = dy / len;
  const baseX = tip.x + ux * DIM_ARROW_LENGTH_PX * dpr;
  const baseY = tip.y + uy * DIM_ARROW_LENGTH_PX * dpr;
  const perpX = -uy * DIM_ARROW_HALF_WIDTH_PX * dpr;
  const perpY = ux * DIM_ARROW_HALF_WIDTH_PX * dpr;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(baseX + perpX, baseY + perpY);
  ctx.lineTo(baseX - perpX, baseY - perpY);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw dimension lines, arrows and labels in DEVICE space so they stay a
 * constant on-screen size. `(a, d, e, f)` are the active camera's affine terms
 * (device = a·local + e, d·local + f); each dimension's local geometry is
 * projected through them. Geometry comes from `resolvePlanDimensionGeometry`.
 */
function drawDimensions(
  ctx: CanvasRenderingContext2D,
  dimensions: ReadonlyArray<PlanDimension>,
  adapter: PlanCoordinateAdapter,
  a: number,
  d: number,
  e: number,
  f: number,
  dpr: number,
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.setLineDash([]);
  const project = (p: { x: number; y: number }): DevicePoint => ({ x: a * p.x + e, y: d * p.y + f });
  for (const dimension of dimensions) {
    const g = resolvePlanDimensionGeometry(dimension, adapter);
    if (!g) continue;
    ctx.strokeStyle = DIM_STROKE;
    ctx.lineWidth = DIM_LINE_WIDTH_PX * dpr;
    ctx.beginPath();
    for (const seg of [g.extensionStart, g.extensionEnd, g.dimLine]) {
      const from = project(seg.from);
      const to = project(seg.to);
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
    }
    ctx.stroke();
    const dimFrom = project(g.dimLine.from);
    const dimTo = project(g.dimLine.to);
    ctx.fillStyle = DIM_STROKE;
    drawDimensionArrow(ctx, dimFrom, dimTo, dpr);
    drawDimensionArrow(ctx, dimTo, dimFrom, dpr);
    const anchor = project(g.labelAnchor);
    ctx.save();
    ctx.translate(anchor.x, anchor.y);
    ctx.rotate((g.labelRotationDeg * Math.PI) / 180);
    ctx.font = `500 ${DIM_LABEL_FONT_PX * dpr}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineWidth = DIM_LABEL_HALO_WIDTH_PX * dpr;
    ctx.strokeStyle = DIM_LABEL_HALO;
    ctx.strokeText(g.label, 0, -DIM_LABEL_OFFSET_PX * dpr);
    ctx.fillStyle = DIM_LABEL_FILL;
    ctx.fillText(g.label, 0, -DIM_LABEL_OFFSET_PX * dpr);
    ctx.restore();
  }
}

/**
 * PR-WB-CANVAS (2026-06-22): the Canvas 2D Plan renderer — now the only Plan
 * renderer (the SVG-DOM path was retired in Tier 3 step 6). Bodies + halos draw
 * in camera-scaled space (constant-px strokes); dimensions, snap markers and
 * seam icons draw in device space (constant on-screen size). Interaction is
 * geometric: pointer events map to world coords via the inverse camera,
 * hit-test by point-in-polygon over the (renderer-agnostic) hit-target items,
 * and dispatch through the shared tool dispatcher + `buildPointerDispatchAction`.
 * Pan/zoom apply imperatively and commit to React state only on gesture end.
 */
type PlanCanvas2DProps = {
  layout: PlanLayout;
  coordinateAdapter: PlanCoordinateAdapter;
  committedBodies: PlanRenderItem[];
  diagnosticFallbackItems: PlanRenderItem[];
  contextLines: PlanRenderItem[];
  detailLines: PlanRenderItem[];
  hitTargetItems: PlanRenderItem[];
  selectionHaloItems: PlanRenderItem[];
  hoverHaloItems?: PlanRenderItem[];
  dimensions?: ReadonlyArray<PlanDimension>;
  edgeDragPreview?: EdgeDragPreview | null;
  edgeDragHover?: EdgeDragHover | null;
  movePreview?: MoveToolPreview | null;
  movePreviewSourcePolygon?: ReadonlyArray<Point2> | null;
  seamIconTargets?: ReadonlyArray<PlanSeamIconTarget>;
  onJoinHouseForms?: (input: { formAId: string; formBId: string }) => void;
  onDetachHouseFormAtSeam?: (input: { houseFormId: string; joinIndex: number }) => void;
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
  dimensions = [],
  edgeDragPreview = null,
  edgeDragHover = null,
  movePreview = null,
  movePreviewSourcePolygon = null,
  seamIconTargets = [],
  onJoinHouseForms,
  onDetachHouseFormAtSeam,
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

  const dataRef = useRef({ layout, coordinateAdapter, committedBodies, diagnosticFallbackItems, contextLines, detailLines, hitTargetItems, selectionHaloItems, hoverHaloItems, dimensions, edgeDragPreview, edgeDragHover, movePreview, movePreviewSourcePolygon, seamIconTargets, hoveredShapeId: hoveredShape?.shapeId ?? null });
  dataRef.current = { layout, coordinateAdapter, committedBodies, diagnosticFallbackItems, contextLines, detailLines, hitTargetItems, selectionHaloItems, hoverHaloItems, dimensions, edgeDragPreview, edgeDragHover, movePreview, movePreviewSourcePolygon, seamIconTargets, hoveredShapeId: hoveredShape?.shapeId ?? null };

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
    // Camera affine: device = a·local + e (x), d·local + f (y).
    const a = dpr * scale;
    const d = dpr * scale;
    const e = dpr * (offsetX + scaleFit * (t.panX - minX));
    const f = dpr * (offsetY + scaleFit * (t.panY - minY));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(a, 0, 0, d, e, f);
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

    // Camera-space preview outlines (world-positioned, constant-px stroke).
    const adapter = data.coordinateAdapter;
    const toLocal = (w: Point2) => adapter.projectionToSvg(w);
    const hover = data.edgeDragHover;
    if (hover) strokePoly(ctx, [toLocal(hover.edgeStart), toLocal(hover.edgeEnd)], EDGE_HOVER_LINE_STYLE, scale, false);
    const edp = data.edgeDragPreview;
    if (edp) {
      strokePoly(ctx, edp.previewPolygon.map(toLocal), EDGE_DRAG_PREVIEW_STYLE, scale, true);
      if (edp.snap) strokePoly(ctx, [toLocal(edp.snap.target.start), toLocal(edp.snap.target.end)], SNAP_LINE_STYLE, scale, false);
    }
    const mp = data.movePreview;
    const msrc = data.movePreviewSourcePolygon;
    if (mp && msrc && msrc.length >= 3) {
      strokePoly(ctx, msrc.map((p) => toLocal({ x: p.x + mp.delta.x, y: p.y + mp.delta.y })), MOVE_PREVIEW_STYLE, scale, true);
      if (mp.snap) {
        strokePoly(ctx, [toLocal(mp.snap.edgeSnap.target.start), toLocal(mp.snap.edgeSnap.target.end)], SNAP_LINE_STYLE, scale, false);
        if (mp.snap.secondary) strokePoly(ctx, [toLocal(mp.snap.secondary.edgeSnap.target.start), toLocal(mp.snap.secondary.edgeSnap.target.end)], SNAP_LINE_STYLE, scale, false);
      }
    }

    // Device-space overlays: dimensions, snap markers/labels, seam icons (all
    // constant on-screen size). Project world → local → device via the camera.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (data.dimensions.length) drawDimensions(ctx, data.dimensions, adapter, a, d, e, f, dpr);
    const projWorld = (w: Point2) => { const l = toLocal(w); return { x: a * l.x + e, y: d * l.y + f }; };
    if (hover) { const g = projWorld(hover.closestPoint); drawMarkerDot(ctx, g.x, g.y, 4, dpr); }
    if (edp?.snap) {
      const s = edp.previewPolygon[edp.edgeIndex];
      const en = edp.previewPolygon[(edp.edgeIndex + 1) % edp.previewPolygon.length];
      if (s && en) {
        const m = projWorld(midpoint(s, en));
        drawMarkerDot(ctx, m.x, m.y, 4, dpr);
        drawSnapLabel(ctx, m.x, m.y, SNAP_KIND_LABEL[edp.snap.target.edgeKind] ?? edp.snap.target.edgeKind, dpr);
      }
    }
    if (mp?.snap && msrc) {
      const snap = mp.snap;
      const pm = translatedMidpoint(msrc, snap.edgeIndex, mp.delta);
      if (pm) {
        const m = projWorld(pm);
        drawMarkerDot(ctx, m.x, m.y, 4, dpr);
        drawSnapLabel(ctx, m.x, m.y, SNAP_KIND_LABEL[snap.edgeSnap.target.edgeKind] ?? snap.edgeSnap.target.edgeKind, dpr);
      }
      if (snap.secondary) {
        const sm = translatedMidpoint(msrc, snap.secondary.edgeIndex, mp.delta);
        if (sm) {
          const m = projWorld(sm);
          drawMarkerDot(ctx, m.x, m.y, 4, dpr);
          drawSnapLabel(ctx, m.x, m.y, SNAP_KIND_LABEL[snap.secondary.edgeSnap.target.edgeKind] ?? snap.secondary.edgeSnap.target.edgeKind, dpr);
        }
      }
      if (snap.cornerVertex) { const cv = projWorld(snap.cornerVertex); drawMarkerDot(ctx, cv.x, cv.y, 6, dpr); }
    }
    for (const target of data.seamIconTargets) {
      const p = projWorld({ x: target.worldXMm, y: target.worldYMm });
      drawSeamIcon(ctx, p.x, p.y, target.kind, dpr);
    }
  }, [strokePoly]);

  useLayoutEffect(() => {
    liveTransformRef.current = transform;
    draw();
  }, [transform, committedBodies, diagnosticFallbackItems, contextLines, detailLines, hitTargetItems, selectionHaloItems, hoverHaloItems, dimensions, edgeDragPreview, edgeDragHover, movePreview, movePreviewSourcePolygon, seamIconTargets, hoveredShape, layout, draw]);

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

  // Seam icons are drawn at a constant device size; their hit radius in local
  // space therefore shrinks as the user zooms in. Topmost-first.
  const hitTestSeamIcon = useCallback((local: Point2): PlanSeamIconTarget | null => {
    const data = dataRef.current;
    if (!data.seamIconTargets.length) return null;
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const { scaleFit } = fit(data.layout, rect.width, rect.height);
    const hitRadiusLocal = SEAM_ICON_HIT_RADIUS_PX / (scaleFit * (liveTransformRef.current.zoom || 1));
    for (let i = data.seamIconTargets.length - 1; i >= 0; i -= 1) {
      const t = data.seamIconTargets[i]!;
      const iconLocal = data.coordinateAdapter.projectionToSvg({ x: t.worldXMm, y: t.worldYMm });
      if (Math.hypot(local.x - iconLocal.x, local.y - iconLocal.y) <= hitRadiusLocal) return t;
    }
    return null;
  }, []);

  const pendingSeamRef = useRef<PlanSeamIconTarget | null>(null);
  const fireSeamAction = useCallback((target: PlanSeamIconTarget) => {
    if (target.kind === 'detach') onDetachHouseFormAtSeam?.({ houseFormId: target.houseFormId, joinIndex: target.joinIndex });
    else onJoinHouseForms?.({ formAId: target.formAId, formBId: target.formBId });
  }, [onDetachHouseFormAtSeam, onJoinHouseForms]);

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
      // anchor must be in viewBox space (pre-camera-fit, post-pan/zoom-free):
      const rect = canvas.getBoundingClientRect();
      const { minX, minY, scaleFit, offsetX, offsetY } = fit(dataRef.current.layout, rect.width, rect.height);
      const anchor = { x: (event.clientX - rect.left - offsetX) / scaleFit + minX, y: (event.clientY - rect.top - offsetY) / scaleFit + minY };
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
  }, [draw, commit]);

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
    // Seam icons take priority over the body under them (mirrors the SVG
    // layer's stopPropagation). The action fires on pointer-up if still over.
    const seam = local ? hitTestSeamIcon(local) : null;
    if (seam) {
      pendingSeamRef.current = seam;
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* best-effort */ }
      return;
    }
    const hit = local ? hitTest(local) : null;
    dispatchPointer('down', event, hit?.shape ?? null);
  }, [clientToLocal, hitTest, hitTestSeamIcon, dispatchPointer]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (pendingSeamRef.current) return;
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
    const pendingSeam = pendingSeamRef.current;
    if (pendingSeam) {
      pendingSeamRef.current = null;
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* best-effort */ }
      const local = clientToLocal(event.clientX, event.clientY);
      const stillOver = local ? hitTestSeamIcon(local) : null;
      if (stillOver && stillOver.key === pendingSeam.key) fireSeamAction(pendingSeam);
      return;
    }
    const pan = panRef.current;
    if (pan && pan.pointerId === event.pointerId) {
      panRef.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      commit();
      return;
    }
    if (event.button !== 0) return;
    dispatchPointer('up', event, null);
  }, [commit, dispatchPointer, clientToLocal, hitTestSeamIcon, fireSeamAction]);

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
        data-plan-dimension-count={dimensions.length}
        data-plan-seam-icon-count={seamIconTargets.length}
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
