'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from 'react';
import type { AttachmentSide } from '@sp/costing';
import {
  ModuleDrawingRenderer,
  type ModuleDrawingInteractiveFieldMap,
  type ModulePlanInteractionProps,
  type ModulePlanResizeDragMeta,
  type ModulePlanResizeFieldId,
  canEditHouseFootprintPlan,
  type HouseFootprintEditorDragMeta,
  type HouseFootprintVertexDragMeta,
  type ModuleFootprintEditorProps,
  type ModuleViewsStatus,
  type ModuleViewsTab,
} from '@/app/staff/calculator/ModuleViewsCard';
import type { HouseFootprintHandleId, ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import type { PlanViewModel } from '@/lib/drawings/views/plan/buildPlanViewModel';
import type { DrawingWorkbenchViewportTransform } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { EstimateDrawingField, EstimateDrawingFootprintEdit } from '@/lib/estimates/drawingEdits';
import { normalizeHouseFootprintParams, type CalculatorHouseFootprintParams } from '@/lib/types/calculator';
import { moduleDrawingThemeCssVariables } from '@/lib/theme/moduleDrawing';
import styles from './ModelSpaceViewport.module.css';

type FootprintDragSession = HouseFootprintEditorDragMeta & {
  pointerId: number;
  startSvgX: number;
  startSvgY: number;
  startParams: CalculatorHouseFootprintParams;
};

type FootprintVertexDragSession = HouseFootprintVertexDragMeta & {
  pointerId: number;
  startSvgX: number;
  startSvgY: number;
  startPolygon: NonNullable<Required<ModulePlanModel>['houseFootprintPolygon']>;
};

type PlanFieldDragSession = ModulePlanResizeDragMeta & {
  pointerId: number;
  startSvgX: number;
  startSvgY: number;
  startValueM: number;
  field: EstimateDrawingField;
};

type PanDragSession = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPanX: number;
  startPanY: number;
};

type DrawOutlinePoint = {
  alongM: number;
  depthM: number;
};

type DrawOutlineAngleMode = 'relative' | 'absolute';

type DrawOutlineSession = {
  points: DrawOutlinePoint[];
  pendingPoint: DrawOutlinePoint | null;
  distanceDraft: string;
  angleDraft: string;
  angleMode: DrawOutlineAngleMode;
};

type DrawOutlineHoverPoint = {
  point: DrawOutlinePoint;
  closeHovered: boolean;
};

type DrawPopoverPosition = {
  left: number;
  top: number;
};

type ModelSpaceRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const MIN_MODEL_ZOOM = 0.25;
const MAX_MODEL_ZOOM = 4;
const MIN_OUTLINE_SEGMENT_M = 0.001;
const CLOSE_START_TOLERANCE_M = 0.2;
const FIT_VIEW_MARGIN_PX = 24;
const DRAW_POPOVER_MARGIN_PX = 12;
const DRAW_POPOVER_GAP_PX = 14;

function clampZoom(value: number): number {
  return Math.min(Math.max(value, MIN_MODEL_ZOOM), MAX_MODEL_ZOOM);
}

function parseModelSpaceRect(value: string | null | undefined): ModelSpaceRect | null {
  const parts = value
    ?.trim()
    .split(/[\s,]+/)
    .map((part) => Number.parseFloat(part));
  if (!parts || parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  const [x, y, width, height] = parts as [number, number, number, number];
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

function resolveModelSpaceSvgLayoutKey(scaleFrame: HTMLDivElement | null): string {
  const svg = scaleFrame?.querySelector<SVGSVGElement>('svg[data-model-space-svg]');
  if (!svg) return 'no-model-space-svg';
  return [
    svg.dataset.modelSpaceSvg ?? 'model',
    svg.getAttribute('width') ?? '',
    svg.getAttribute('height') ?? '',
    svg.dataset.modelSpaceViewBox ?? svg.getAttribute('viewBox') ?? '',
    svg.dataset.modelSpaceFocusBox ?? '',
  ].join('|');
}

function resolveModelSpaceSvgFocusRect(input: {
  scaleFrame: HTMLDivElement;
  frameRect: DOMRect;
  frameWidth: number;
  frameHeight: number;
  zoom: number;
}): ModelSpaceRect | null {
  const svg = input.scaleFrame.querySelector<SVGSVGElement>('svg[data-model-space-svg]');
  const viewBox = parseModelSpaceRect(svg?.dataset.modelSpaceViewBox ?? svg?.getAttribute('viewBox'));
  const focusBox = parseModelSpaceRect(svg?.dataset.modelSpaceFocusBox);
  if (!svg || !viewBox || !focusBox) return null;

  const safeZoom = Math.max(input.zoom, 0.001);
  const svgRect = svg.getBoundingClientRect();
  const svgWidth = (svgRect.width > 0 ? svgRect.width / safeZoom : 0) || Number.parseFloat(svg.getAttribute('width') ?? '') || input.frameWidth;
  const svgHeight = (svgRect.height > 0 ? svgRect.height / safeZoom : 0) || Number.parseFloat(svg.getAttribute('height') ?? '') || input.frameHeight;
  if (svgWidth <= 0 || svgHeight <= 0) return null;

  const svgLeft = svgRect.width > 0 ? (svgRect.left - input.frameRect.left) / safeZoom : Math.max(0, (input.frameWidth - svgWidth) / 2);
  const svgTop = svgRect.height > 0 ? (svgRect.top - input.frameRect.top) / safeZoom : Math.max(0, (input.frameHeight - svgHeight) / 2);
  const cssPerUnitX = svgWidth / viewBox.width;
  const cssPerUnitY = svgHeight / viewBox.height;

  return {
    x: svgLeft + (focusBox.x - viewBox.x) * cssPerUnitX,
    y: svgTop + (focusBox.y - viewBox.y) * cssPerUnitY,
    width: focusBox.width * cssPerUnitX,
    height: focusBox.height * cssPerUnitY,
  };
}

function formatHouseFootprintParamValue(value: number): string {
  return value.toFixed(3).replace(/\.?0+$/, '') || '0';
}

function parseHouseFootprintParamValue(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

function snapHouseFootprintValue(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function parsePolygonMetres(value: string | undefined): number {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPolygonMetres(value: number): string {
  return formatHouseFootprintParamValue(snapHouseFootprintValue(value));
}

function moveCustomPolygonVertex(
  polygon: NonNullable<Required<ModulePlanModel>['houseFootprintPolygon']>,
  vertexIndex: number,
  nextAlongM: number,
  nextDepthM: number,
): NonNullable<Required<ModulePlanModel>['houseFootprintPolygon']> {
  const points = polygon.map((point) => ({
    alongM: parsePolygonMetres(point.alongM),
    depthM: parsePolygonMetres(point.depthM),
  }));
  if (points.length < 3 || vertexIndex < 0 || vertexIndex >= points.length) return polygon;
  points[vertexIndex] = { alongM: nextAlongM, depthM: nextDepthM };

  return points.map((point) => ({
    alongM: formatPolygonMetres(point.alongM),
    depthM: formatPolygonMetres(point.depthM),
  }));
}

function outlinePointsToPolygon(points: DrawOutlinePoint[]): NonNullable<Required<ModulePlanModel>['houseFootprintPolygon']> {
  return points.map((point) => ({
    alongM: formatPolygonMetres(point.alongM),
    depthM: formatPolygonMetres(point.depthM),
  }));
}

function distanceBetweenOutlinePoints(a: DrawOutlinePoint, b: DrawOutlinePoint): number {
  return Math.hypot(b.alongM - a.alongM, b.depthM - a.depthM);
}

function absoluteAngleDeg(a: DrawOutlinePoint, b: DrawOutlinePoint): number {
  return (Math.atan2(b.depthM - a.depthM, b.alongM - a.alongM) * 180) / Math.PI;
}

function normalizeAngleDeg(value: number): number {
  if (!Number.isFinite(value)) return 0;
  let next = ((value % 360) + 360) % 360;
  if (next > 180) next -= 360;
  return Math.round(next * 10) / 10;
}

function formatOutlineNumber(value: number): string {
  return (Math.round(value * 1000) / 1000).toFixed(3).replace(/\.?0+$/, '') || '0';
}

function resolvePendingOutlinePoint(session: DrawOutlineSession): DrawOutlinePoint | null {
  const start = session.points[session.points.length - 1];
  if (!start) return null;
  const distance = Number.parseFloat(session.distanceDraft);
  const angle = Number.parseFloat(session.angleDraft);
  if (!Number.isFinite(distance) || distance < MIN_OUTLINE_SEGMENT_M || !Number.isFinite(angle)) return null;
  const previous = session.points[session.points.length - 2];
  const baseAngle = session.angleMode === 'relative' && previous ? absoluteAngleDeg(previous, start) : 0;
  const absoluteAngle = session.angleMode === 'relative' ? baseAngle + angle : angle;
  const radians = (absoluteAngle * Math.PI) / 180;
  return {
    alongM: snapHouseFootprintValue(start.alongM + Math.cos(radians) * distance),
    depthM: snapHouseFootprintValue(start.depthM + Math.sin(radians) * distance),
  };
}

function hasDrawOutlineDraft(session: DrawOutlineSession): boolean {
  return Boolean(session.pendingPoint || session.distanceDraft || session.angleDraft);
}

function orientation(a: DrawOutlinePoint, b: DrawOutlinePoint, c: DrawOutlinePoint): number {
  return (b.depthM - a.depthM) * (c.alongM - b.alongM) - (b.alongM - a.alongM) * (c.depthM - b.depthM);
}

function outlinePointOnSegment(a: DrawOutlinePoint, b: DrawOutlinePoint, c: DrawOutlinePoint): boolean {
  return (
    b.alongM <= Math.max(a.alongM, c.alongM) + 1e-9 &&
    b.alongM + 1e-9 >= Math.min(a.alongM, c.alongM) &&
    b.depthM <= Math.max(a.depthM, c.depthM) + 1e-9 &&
    b.depthM + 1e-9 >= Math.min(a.depthM, c.depthM)
  );
}

function outlineSegmentsIntersect(a1: DrawOutlinePoint, a2: DrawOutlinePoint, b1: DrawOutlinePoint, b2: DrawOutlinePoint): boolean {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);
  if (Math.abs(o1) <= 1e-9 && outlinePointOnSegment(a1, b1, a2)) return true;
  if (Math.abs(o2) <= 1e-9 && outlinePointOnSegment(a1, b2, a2)) return true;
  if (Math.abs(o3) <= 1e-9 && outlinePointOnSegment(b1, a1, b2)) return true;
  if (Math.abs(o4) <= 1e-9 && outlinePointOnSegment(b1, a2, b2)) return true;
  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
}

function validateOutlinePoints(points: DrawOutlinePoint[]): { ok: true } | { ok: false; error: string } {
  if (points.length < 3) return { ok: false, error: 'Add at least 3 points before closing the outline.' };
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    if (!Number.isFinite(current.alongM) || !Number.isFinite(current.depthM)) {
      return { ok: false, error: 'House footprint outline points need finite along/depth values.' };
    }
    if (distanceBetweenOutlinePoints(current, next) < MIN_OUTLINE_SEGMENT_M) {
      return { ok: false, error: 'House footprint outline cannot include duplicate consecutive points.' };
    }
  }
  const area = points.reduce((sum, current, index) => {
    const next = points[(index + 1) % points.length]!;
    return sum + current.alongM * next.depthM - next.alongM * current.depthM;
  }, 0) / 2;
  if (Math.abs(area) <= 1e-9) return { ok: false, error: 'House footprint outline needs a non-zero area.' };
  for (let index = 0; index < points.length; index += 1) {
    const a1 = points[index]!;
    const a2 = points[(index + 1) % points.length]!;
    for (let jndex = index + 1; jndex < points.length; jndex += 1) {
      if (Math.abs(index - jndex) <= 1 || (index === 0 && jndex === points.length - 1)) continue;
      const b1 = points[jndex]!;
      const b2 = points[(jndex + 1) % points.length]!;
      if (outlineSegmentsIntersect(a1, a2, b1, b2)) {
        return { ok: false, error: 'House footprint outline cannot self-intersect.' };
      }
    }
  }
  return { ok: true };
}

function formatDrawingFieldValue(value: number): string {
  return value.toFixed(3).replace(/\.?0+$/, '') || '0';
}

function clientPointToSvg(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } | null {
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const transformed = point.matrixTransform(ctm.inverse());
  return { x: transformed.x, y: transformed.y };
}

async function resolveCommitResult(
  action: Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string },
): Promise<{ ok: boolean; error?: string }> {
  return await action;
}

export default function ModelSpaceViewport({
  view,
  status,
  planModel,
  sectionModel,
  planViewModel,
  drawOutlineRequestId,
  fitViewKey = view,
  viewportTransform,
  onViewportTransformChange,
  editableFields,
  onCommitField,
  onCommitFootprintEdit,
}: {
  view: ModuleViewsTab;
  status: ModuleViewsStatus;
  planModel?: ModulePlanModel | null;
  sectionModel?: ModuleSectionModel | null;
  planViewModel?: PlanViewModel | null;
  drawOutlineRequestId?: number;
  fitViewKey?: string;
  viewportTransform: DrawingWorkbenchViewportTransform;
  onViewportTransformChange?: (next: DrawingWorkbenchViewportTransform) => void;
  editableFields?: EstimateDrawingField[];
  onCommitField?: (
    field: EstimateDrawingField,
    nextValue: string,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onCommitFootprintEdit?: (
    edit: EstimateDrawingFootprintEdit,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const scaleFrameRef = useRef<HTMLDivElement | null>(null);
  const drawPopoverRef = useRef<HTMLDivElement | null>(null);
  const footprintSvgRef = useRef<SVGSVGElement | null>(null);
  const lastDrawOutlineRequestIdRef = useRef<number | undefined>(undefined);
  const userAdjustedViewportRef = useRef(false);
  const autoFitKeyRef = useRef<string | null>(null);
  const [footprintError, setFootprintError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [footprintHoveredAttachmentSide, setFootprintHoveredAttachmentSide] = useState<AttachmentSide | null>(null);
  const [footprintHoveredHandleId, setFootprintHoveredHandleId] = useState<HouseFootprintHandleId | null>(null);
  const [footprintActiveHandleId, setFootprintActiveHandleId] = useState<HouseFootprintHandleId | null>(null);
  const [footprintContextHovered, setFootprintContextHovered] = useState(false);
  const [footprintDragSession, setFootprintDragSession] = useState<FootprintDragSession | null>(null);
  const [footprintVertexDragSession, setFootprintVertexDragSession] = useState<FootprintVertexDragSession | null>(null);
  const [drawOutlineSession, setDrawOutlineSession] = useState<DrawOutlineSession | null>(null);
  const [drawOutlineHoverPoint, setDrawOutlineHoverPoint] = useState<DrawOutlineHoverPoint | null>(null);
  const [drawPopoverPosition, setDrawPopoverPosition] = useState<DrawPopoverPosition | null>(null);
  const [panDragSession, setPanDragSession] = useState<PanDragSession | null>(null);
  const [planHoveredResizeFieldId, setPlanHoveredResizeFieldId] = useState<ModulePlanResizeFieldId | null>(null);
  const [planActiveResizeFieldId, setPlanActiveResizeFieldId] = useState<ModulePlanResizeFieldId | null>(null);
  const [planFieldDragSession, setPlanFieldDragSession] = useState<PlanFieldDragSession | null>(null);

  const zoom = clampZoom(viewportTransform.zoom);
  const editableFieldMap = useMemo(() => {
    const next = new Map<string, EstimateDrawingField>();
    for (const field of editableFields ?? []) {
      if (!field.svgFieldId) continue;
      next.set(field.svgFieldId, field);
    }
    return next;
  }, [editableFields]);
  const modelInteractiveFields = useMemo<ModuleDrawingInteractiveFieldMap>(() => {
    const next: ModuleDrawingInteractiveFieldMap = {};
    for (const field of editableFieldMap.values()) {
      if (!field.svgFieldId) continue;
      next[field.svgFieldId] = {
        fieldId: field.id,
      };
    }
    return next;
  }, [editableFieldMap]);
  const canEditFootprint = view === 'plan' && Boolean(planModel) && Boolean(onCommitFootprintEdit) && canEditHouseFootprintPlan(planModel);
  const canRotatePlan = view === 'plan' && Boolean(planModel) && Boolean(onCommitFootprintEdit) && planModel?.roofType !== 'hip_corner';
  const canEditPlanDimensions =
    view === 'plan' &&
    Boolean(planModel) &&
    Boolean(onCommitField) &&
    (editableFieldMap.has('plan:lengthA') || editableFieldMap.has('plan:spanA'));
  const showPlanViewport = view === 'plan' && Boolean(planModel);
  const showSectionViewport = view === 'section' && Boolean(sectionModel);
  const showDrawingViewport = showPlanViewport || showSectionViewport;
  const interactionError = fieldError ?? footprintError;

  const commitFootprintEdit = useCallback(
    async (edit: EstimateDrawingFootprintEdit) => {
      if (!onCommitFootprintEdit) {
        return { ok: false, error: 'Drawing inputs are not available for this estimate.' };
      }
      const result = await resolveCommitResult(onCommitFootprintEdit(edit));
      setFootprintError(result.ok ? null : result.error ?? 'Unable to update the drawing draft.');
      if (result.ok) setFieldError(null);
      return result;
    },
    [onCommitFootprintEdit],
  );

  const commitFieldEdit = useCallback(
    async (field: EstimateDrawingField, nextValue: string) => {
      if (!onCommitField) {
        return { ok: false, error: 'Drawing inputs are not available for this estimate.' };
      }
      const result = await resolveCommitResult(onCommitField(field, nextValue));
      setFieldError(result.ok ? null : result.error ?? 'Unable to update the drawing draft.');
      if (result.ok) setFootprintError(null);
      return result;
    },
    [onCommitField],
  );

  const updateViewportTransform = useCallback(
    (next: Partial<DrawingWorkbenchViewportTransform>) => {
      onViewportTransformChange?.({
        zoom,
        panX: viewportTransform.panX,
        panY: viewportTransform.panY,
        ...next,
      });
    },
    [onViewportTransformChange, viewportTransform.panX, viewportTransform.panY, zoom],
  );

  const handleZoomChange = useCallback(
    (delta: number) => {
      userAdjustedViewportRef.current = true;
      updateViewportTransform({ zoom: clampZoom(zoom + delta) });
    },
    [updateViewportTransform, zoom],
  );

  const handleZoomAtViewportPoint = useCallback(
    (delta: number, clientX: number, clientY: number) => {
      const scroller = scrollerRef.current;
      if (!scroller) {
        handleZoomChange(delta);
        return;
      }
      const nextZoom = clampZoom(zoom + delta);
      if (nextZoom === zoom) return;
      userAdjustedViewportRef.current = true;
      const rect = scroller.getBoundingClientRect();
      const anchorX = clientX - rect.left;
      const anchorY = clientY - rect.top;
      const scale = nextZoom / Math.max(zoom, 0.001);
      updateViewportTransform({
        zoom: nextZoom,
        panX: anchorX - (anchorX - viewportTransform.panX) * scale,
        panY: anchorY - (anchorY - viewportTransform.panY) * scale,
      });
    },
    [handleZoomChange, updateViewportTransform, viewportTransform.panX, viewportTransform.panY, zoom],
  );

  const measureFitViewTransform = useCallback((): DrawingWorkbenchViewportTransform | null => {
    const scroller = scrollerRef.current;
    const scaleFrame = scaleFrameRef.current;
    if (!scroller || !scaleFrame) return null;

    const scrollerRect = scroller.getBoundingClientRect();
    const frameRect = scaleFrame.getBoundingClientRect();
    const scrollerWidth = scroller.clientWidth || scrollerRect.width;
    const scrollerHeight = scroller.clientHeight || scrollerRect.height;
    const frameWidth =
      scaleFrame.offsetWidth || scaleFrame.scrollWidth || (frameRect.width > 0 ? frameRect.width / Math.max(zoom, 0.001) : 0);
    const frameHeight =
      scaleFrame.offsetHeight || scaleFrame.scrollHeight || (frameRect.height > 0 ? frameRect.height / Math.max(zoom, 0.001) : 0);

    if (scrollerWidth <= 0 || scrollerHeight <= 0 || frameWidth <= 0 || frameHeight <= 0) return null;

    const focusRect = resolveModelSpaceSvgFocusRect({ scaleFrame, frameRect, frameWidth, frameHeight, zoom });
    const targetRect = focusRect ?? { x: 0, y: 0, width: frameWidth, height: frameHeight };
    const availableWidth = Math.max(1, scrollerWidth - FIT_VIEW_MARGIN_PX * 2);
    const availableHeight = Math.max(1, scrollerHeight - FIT_VIEW_MARGIN_PX * 2);
    const nextZoom = clampZoom(Math.min(availableWidth / targetRect.width, availableHeight / targetRect.height));
    return {
      zoom: nextZoom,
      panX: scrollerWidth / 2 - (targetRect.x + targetRect.width / 2) * nextZoom,
      panY: scrollerHeight / 2 - (targetRect.y + targetRect.height / 2) * nextZoom,
    };
  }, [zoom]);

  const resolveCurrentFitKey = useCallback(
    () => `${fitViewKey}:${resolveModelSpaceSvgLayoutKey(scaleFrameRef.current)}`,
    [fitViewKey],
  );

  const fitViewportToContent = useCallback((): boolean => {
    const next = measureFitViewTransform();
    if (!next) return false;
    updateViewportTransform(next);
    return true;
  }, [measureFitViewTransform, updateViewportTransform]);

  const handleResetView = useCallback(() => {
    setFootprintError(null);
    setFieldError(null);
    setPanDragSession(null);
    userAdjustedViewportRef.current = false;
    if (fitViewportToContent()) {
      autoFitKeyRef.current = resolveCurrentFitKey();
    } else {
      updateViewportTransform({ zoom: 1, panX: 0, panY: 0 });
    }
  }, [fitViewportToContent, resolveCurrentFitKey, updateViewportTransform]);

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      handleZoomAtViewportPoint(event.deltaY < 0 ? 0.1 : -0.1, event.clientX, event.clientY);
    },
    [handleZoomAtViewportPoint],
  );

  const handleFootprintPresetSelect = useCallback(
    async (preset: NonNullable<ModulePlanModel['houseFootprintPreset']>) => {
      setFieldError(null);
      setFootprintHoveredHandleId(null);
      setFootprintActiveHandleId(null);
      setFootprintDragSession(null);
      setDrawOutlineSession(null);
      setDrawOutlineHoverPoint(null);
      setFootprintError(null);
      await commitFootprintEdit({ type: 'preset', preset });
    },
    [commitFootprintEdit],
  );

  const startDrawOutlineSession = useCallback(() => {
    setFieldError(null);
    setFootprintHoveredHandleId(null);
    setFootprintActiveHandleId(null);
    setFootprintDragSession(null);
    setFootprintVertexDragSession(null);
    setDrawOutlineHoverPoint(null);
    setFootprintError(null);
    setDrawOutlineSession({
      points: [],
      pendingPoint: null,
      distanceDraft: '',
      angleDraft: '',
      angleMode: 'relative',
    });
  }, []);

  useEffect(() => {
    if (drawOutlineRequestId === undefined || drawOutlineRequestId <= 0 || drawOutlineRequestId === lastDrawOutlineRequestIdRef.current) return;
    lastDrawOutlineRequestIdRef.current = drawOutlineRequestId;
    if (!canEditFootprint || view !== 'plan') return;
    startDrawOutlineSession();
  }, [canEditFootprint, drawOutlineRequestId, startDrawOutlineSession, view]);

  const handleFootprintModeSelect = useCallback(
    async (mode: NonNullable<Required<ModulePlanModel>['houseFootprintMode']>) => {
      setFieldError(null);
      setFootprintHoveredHandleId(null);
      setFootprintActiveHandleId(null);
      setFootprintDragSession(null);
      setFootprintVertexDragSession(null);
      setDrawOutlineHoverPoint(null);
      setFootprintError(null);
      if (mode === 'custom_polygon') {
        startDrawOutlineSession();
        return;
      }
      setDrawOutlineSession(null);
      setDrawOutlineHoverPoint(null);
      await commitFootprintEdit({ type: 'mode', mode });
    },
    [commitFootprintEdit, startDrawOutlineSession],
  );

  const handleFootprintRotate = useCallback(
    async (delta: -1 | 1) => {
      setFieldError(null);
      setFootprintHoveredAttachmentSide(null);
      setFootprintHoveredHandleId(null);
      setFootprintActiveHandleId(null);
      setFootprintDragSession(null);
      setFootprintVertexDragSession(null);
      setDrawOutlineSession(null);
      setDrawOutlineHoverPoint(null);
      setFootprintError(null);
      await commitFootprintEdit({ type: 'rotate', delta });
    },
    [commitFootprintEdit],
  );

  const handleFootprintAttachmentSideSelect = useCallback(
    async (side: AttachmentSide) => {
      setFieldError(null);
      setFootprintHoveredAttachmentSide(side);
      setFootprintHoveredHandleId(null);
      setFootprintActiveHandleId(null);
      setFootprintDragSession(null);
      setFootprintVertexDragSession(null);
      setDrawOutlineSession(null);
      setDrawOutlineHoverPoint(null);
      setFootprintError(null);
      await commitFootprintEdit({ type: 'attachment_side', side });
    },
    [commitFootprintEdit],
  );

  const handleFootprintDragStart = useCallback(
    (meta: HouseFootprintEditorDragMeta, event: { pointerId: number; clientX: number; clientY: number }) => {
      if (!canEditFootprint || !planModel) return;
      const svg = footprintSvgRef.current;
      if (!svg) return;
      const startPoint = clientPointToSvg(svg, event.clientX, event.clientY);
      if (!startPoint) return;
      setFieldError(null);
      setFootprintError(null);
      setFootprintContextHovered(true);
      setFootprintActiveHandleId(meta.handleId);
      setFootprintHoveredHandleId(meta.handleId);
      setFootprintDragSession({
        ...meta,
        pointerId: event.pointerId,
        startSvgX: startPoint.x,
        startSvgY: startPoint.y,
        startParams: normalizeHouseFootprintParams(planModel.houseFootprintParams),
      });
    },
    [canEditFootprint, planModel],
  );

  const handleFootprintVertexDragStart = useCallback(
    (meta: HouseFootprintVertexDragMeta, event: { pointerId: number; clientX: number; clientY: number }) => {
      if (!canEditFootprint || !planModel || (planModel.houseFootprintMode ?? 'preset') !== 'custom_polygon') return;
      const svg = footprintSvgRef.current;
      if (!svg) return;
      const startPoint = clientPointToSvg(svg, event.clientX, event.clientY);
      if (!startPoint) return;
      setFieldError(null);
      setFootprintError(null);
      setFootprintContextHovered(true);
      setFootprintDragSession(null);
      setFootprintVertexDragSession({
        ...meta,
        pointerId: event.pointerId,
        startSvgX: startPoint.x,
        startSvgY: startPoint.y,
        startPolygon: planModel.houseFootprintPolygon ?? [],
      });
    },
    [canEditFootprint, planModel],
  );

  const handleFootprintEdgeAdd = useCallback(
    async (edgeIndex: number) => {
      if (!canEditFootprint || !planModel || (planModel.houseFootprintMode ?? 'preset') !== 'custom_polygon') return;
      const polygon = planModel.houseFootprintPolygon ?? [];
      if (polygon.length < 3) return;
      const start = polygon[edgeIndex];
      const end = polygon[(edgeIndex + 1) % polygon.length];
      if (!start || !end) return;
      const next = [...polygon];
      next.splice(edgeIndex + 1, 0, {
        alongM: formatPolygonMetres((parsePolygonMetres(start.alongM) + parsePolygonMetres(end.alongM)) / 2),
        depthM: formatPolygonMetres((parsePolygonMetres(start.depthM) + parsePolygonMetres(end.depthM)) / 2),
      });
      await commitFootprintEdit({ type: 'polygon', polygon: next });
    },
    [canEditFootprint, commitFootprintEdit, planModel],
  );

  const handleFootprintVertexDelete = useCallback(
    async (vertexIndex: number) => {
      if (!canEditFootprint || !planModel || (planModel.houseFootprintMode ?? 'preset') !== 'custom_polygon') return;
      const polygon = planModel.houseFootprintPolygon ?? [];
      if (polygon.length <= 3 || vertexIndex < 0 || vertexIndex >= polygon.length) return;
      await commitFootprintEdit({ type: 'polygon', polygon: polygon.filter((_, index) => index !== vertexIndex) });
    },
    [canEditFootprint, commitFootprintEdit, planModel],
  );

  const handleDrawOutlinePointSelect = useCallback(
    (rawPoint: NonNullable<Required<ModulePlanModel>['houseFootprintPolygon']>[number]) => {
      if (!drawOutlineSession) return;
      const point = {
        alongM: parsePolygonMetres(rawPoint.alongM),
        depthM: parsePolygonMetres(rawPoint.depthM),
      };
      if (!Number.isFinite(point.alongM) || !Number.isFinite(point.depthM)) return;
      setDrawOutlineHoverPoint(null);
      if (!drawOutlineSession.points.length) {
        setFootprintError(null);
        setDrawOutlineSession({ ...drawOutlineSession, points: [point], pendingPoint: null, distanceDraft: '', angleDraft: '', angleMode: 'absolute' });
        return;
      }

      const start = drawOutlineSession.points[drawOutlineSession.points.length - 1]!;
      const distance = distanceBetweenOutlinePoints(start, point);
      if (distance < MIN_OUTLINE_SEGMENT_M) {
        setFootprintError('Click a point at least 1mm from the previous point.');
        return;
      }
      const previous = drawOutlineSession.points[drawOutlineSession.points.length - 2];
      const absoluteAngle = absoluteAngleDeg(start, point);
      const nextAngleMode: DrawOutlineAngleMode = previous ? drawOutlineSession.angleMode : 'absolute';
      const angle =
        nextAngleMode === 'relative' && previous
          ? normalizeAngleDeg(absoluteAngle - absoluteAngleDeg(previous, start))
          : normalizeAngleDeg(absoluteAngle);
      setFootprintError(null);
      setDrawOutlineSession({
        ...drawOutlineSession,
        pendingPoint: point,
        distanceDraft: formatOutlineNumber(distance),
        angleDraft: formatOutlineNumber(angle),
        angleMode: previous ? nextAngleMode : 'absolute',
      });
    },
    [drawOutlineSession],
  );

  const handleDrawOutlineConfirmSegment = useCallback(() => {
    if (!drawOutlineSession) return;
    const nextPoint = resolvePendingOutlinePoint(drawOutlineSession);
    if (!nextPoint) {
      setFootprintError('Enter a valid segment distance and angle.');
      return;
    }
    const previous = drawOutlineSession.points[drawOutlineSession.points.length - 1];
    if (previous && distanceBetweenOutlinePoints(previous, nextPoint) < MIN_OUTLINE_SEGMENT_M) {
      setFootprintError('House footprint outline cannot include duplicate consecutive points.');
      return;
    }
    setDrawOutlineHoverPoint(null);
    setFootprintError(null);
    setDrawOutlineSession({
      ...drawOutlineSession,
      points: [...drawOutlineSession.points, nextPoint],
      pendingPoint: null,
      distanceDraft: '',
      angleDraft: '',
      angleMode: 'relative',
    });
  }, [drawOutlineSession]);

  const handleDrawOutlineUndo = useCallback(() => {
    if (!drawOutlineSession) return;
    setDrawOutlineHoverPoint(null);
    setFootprintError(null);
    if (drawOutlineSession.pendingPoint || drawOutlineSession.distanceDraft || drawOutlineSession.angleDraft) {
      setDrawOutlineSession({ ...drawOutlineSession, pendingPoint: null, distanceDraft: '', angleDraft: '' });
      return;
    }
    setDrawOutlineSession({
      ...drawOutlineSession,
      points: drawOutlineSession.points.slice(0, -1),
      angleMode: drawOutlineSession.points.length <= 2 ? 'absolute' : drawOutlineSession.angleMode,
    });
  }, [drawOutlineSession]);

  const handleDrawOutlineCancel = useCallback(() => {
    setFootprintError(null);
    setDrawOutlineHoverPoint(null);
    setDrawOutlineSession(null);
  }, []);

  const handleDrawOutlineClose = useCallback(async () => {
    if (!drawOutlineSession) return;
    const pendingPoint = resolvePendingOutlinePoint(drawOutlineSession);
    const points = pendingPoint ? [...drawOutlineSession.points, pendingPoint] : drawOutlineSession.points;
    const validation = validateOutlinePoints(points);
    if (!validation.ok) {
      setFootprintError(validation.error);
      return;
    }
    const result = await commitFootprintEdit({ type: 'custom_polygon', polygon: outlinePointsToPolygon(points) });
    if (result.ok) {
      setDrawOutlineHoverPoint(null);
      setDrawOutlineSession(null);
    }
  }, [commitFootprintEdit, drawOutlineSession]);

  const handleDrawOutlinePointHover = useCallback(
    (rawPoint: NonNullable<Required<ModulePlanModel>['houseFootprintPolygon']>[number] | null) => {
      if (!drawOutlineSession || !rawPoint || !drawOutlineSession.points.length || hasDrawOutlineDraft(drawOutlineSession)) {
        setDrawOutlineHoverPoint(null);
        return;
      }
      const point = {
        alongM: parsePolygonMetres(rawPoint.alongM),
        depthM: parsePolygonMetres(rawPoint.depthM),
      };
      if (!Number.isFinite(point.alongM) || !Number.isFinite(point.depthM)) {
        setDrawOutlineHoverPoint(null);
        return;
      }

      const firstPoint = drawOutlineSession.points[0];
      const closeHovered =
        drawOutlineSession.points.length >= 3 && firstPoint ? distanceBetweenOutlinePoints(firstPoint, point) <= CLOSE_START_TOLERANCE_M : false;
      const nextPoint = closeHovered && firstPoint ? firstPoint : point;
      setDrawOutlineHoverPoint((current) => {
        if (
          current &&
          current.closeHovered === closeHovered &&
          current.point.alongM === nextPoint.alongM &&
          current.point.depthM === nextPoint.depthM
        ) {
          return current;
        }
        return { point: nextPoint, closeHovered };
      });
    },
    [drawOutlineSession],
  );

  const handleCanvasPanStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || drawOutlineSession) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          'button,input,select,[data-plan-resize-handle-hit],[data-footprint-edge],[data-footprint-resize-edge-hit],[data-footprint-custom-edge-hit],[data-footprint-custom-vertex]',
        )
      ) {
        return;
      }
      userAdjustedViewportRef.current = true;
      setPanDragSession({
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startPanX: viewportTransform.panX,
        startPanY: viewportTransform.panY,
      });
    },
    [drawOutlineSession, viewportTransform.panX, viewportTransform.panY],
  );

  useEffect(() => {
    userAdjustedViewportRef.current = false;
    autoFitKeyRef.current = null;
  }, [fitViewKey]);

  const handlePlanFieldDragStart = useCallback(
    (meta: ModulePlanResizeDragMeta, event: { pointerId: number; clientX: number; clientY: number }) => {
      if (!canEditPlanDimensions || !planModel) return;
      const field = editableFieldMap.get(meta.fieldId);
      if (!field) return;
      const svg = footprintSvgRef.current;
      if (!svg) return;
      const startPoint = clientPointToSvg(svg, event.clientX, event.clientY);
      if (!startPoint) return;

      const fallbackValue = meta.fieldId === 'plan:lengthA' ? planModel.lengthA : planModel.spanA;
      const startValueM = Number.parseFloat(field.rawValue);

      setFootprintError(null);
      setFieldError(null);
      setPlanActiveResizeFieldId(meta.fieldId);
      setPlanHoveredResizeFieldId(meta.fieldId);
      setPlanFieldDragSession({
        ...meta,
        pointerId: event.pointerId,
        startSvgX: startPoint.x,
        startSvgY: startPoint.y,
        startValueM: Number.isFinite(startValueM) ? startValueM : fallbackValue,
        field,
      });
    },
    [canEditPlanDimensions, editableFieldMap, planModel],
  );

  useEffect(() => {
    if (!panDragSession) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== panDragSession.pointerId) return;
      updateViewportTransform({
        panX: panDragSession.startPanX + event.clientX - panDragSession.startClientX,
        panY: panDragSession.startPanY + event.clientY - panDragSession.startClientY,
      });
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerId !== panDragSession.pointerId) return;
      setPanDragSession(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [panDragSession, updateViewportTransform]);

  useEffect(() => {
    if (!footprintDragSession || !onCommitFootprintEdit) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== footprintDragSession.pointerId) return;
      const svg = footprintSvgRef.current;
      if (!svg) return;
      const nextPoint = clientPointToSvg(svg, event.clientX, event.clientY);
      if (!nextPoint) return;

      const deltaSvgX = nextPoint.x - footprintDragSession.startSvgX;
      const deltaSvgY = nextPoint.y - footprintDragSession.startSvgY;
      const deltaUnits = deltaSvgX * footprintDragSession.axisX + deltaSvgY * footprintDragSession.axisY;
      const deltaM = (deltaUnits / Math.max(footprintDragSession.scale, 0.001)) * footprintDragSession.deltaMultiplier;
      const minValueM = footprintDragSession.minValueM;
      const maxValueM = Math.max(minValueM, footprintDragSession.maxValueM);
      const startParams = footprintDragSession.startParams;

      let key: keyof CalculatorHouseFootprintParams = 'bandDepthM';
      let nextValue = parseHouseFootprintParamValue(startParams.bandDepthM, 1.8) + deltaM;

      switch (footprintDragSession.handleId) {
        case 'returnRun':
          key = 'returnRunM';
          nextValue = parseHouseFootprintParamValue(startParams.returnRunM, 2.4) + deltaM;
          break;
        case 'recessWidth':
          key = 'recessWidthM';
          nextValue = parseHouseFootprintParamValue(startParams.recessWidthM, 2.4) + deltaM;
          break;
        case 'recessDepth':
          key = 'recessDepthM';
          nextValue = parseHouseFootprintParamValue(startParams.recessDepthM, 1.2) + deltaM;
          break;
        case 'leftLegRun':
          key = 'leftLegRunM';
          nextValue = parseHouseFootprintParamValue(startParams.leftLegRunM, 2.4) + deltaM;
          break;
        case 'rightLegRun':
          key = 'rightLegRunM';
          nextValue = parseHouseFootprintParamValue(startParams.rightLegRunM, 2.4) + deltaM;
          break;
        case 'sideRun':
          key = 'sideRunM';
          nextValue = parseHouseFootprintParamValue(startParams.sideRunM, 2.4) + deltaM;
          break;
        case 'bandDepth':
        default:
          key = 'bandDepthM';
          nextValue = parseHouseFootprintParamValue(startParams.bandDepthM, 1.8) + deltaM;
          break;
      }

      void commitFootprintEdit({
        type: 'param',
        key,
        value: formatHouseFootprintParamValue(snapHouseFootprintValue(Math.min(Math.max(nextValue, minValueM), maxValueM))),
      });
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerId !== footprintDragSession.pointerId) return;
      setFootprintDragSession(null);
      setFootprintVertexDragSession(null);
      setFootprintActiveHandleId(null);
      setFootprintHoveredHandleId(null);
      setFootprintContextHovered(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [commitFootprintEdit, footprintDragSession, onCommitFootprintEdit]);

  useEffect(() => {
    if (!footprintVertexDragSession || !onCommitFootprintEdit) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== footprintVertexDragSession.pointerId) return;
      const svg = footprintSvgRef.current;
      if (!svg) return;
      const nextPoint = clientPointToSvg(svg, event.clientX, event.clientY);
      if (!nextPoint) return;

      const deltaSvgX = nextPoint.x - footprintVertexDragSession.startSvgX;
      const deltaSvgY = nextPoint.y - footprintVertexDragSession.startSvgY;
      const deltaAlongM =
        (deltaSvgX * footprintVertexDragSession.alongAxisX + deltaSvgY * footprintVertexDragSession.alongAxisY) /
        Math.max(footprintVertexDragSession.scale, 0.001);
      const deltaDepthM =
        (deltaSvgX * footprintVertexDragSession.depthAxisX + deltaSvgY * footprintVertexDragSession.depthAxisY) /
        Math.max(footprintVertexDragSession.scale, 0.001);
      const startPoint = footprintVertexDragSession.startPolygon[footprintVertexDragSession.vertexIndex];
      if (!startPoint) return;
      const nextPolygon = moveCustomPolygonVertex(
        footprintVertexDragSession.startPolygon,
        footprintVertexDragSession.vertexIndex,
        snapHouseFootprintValue(parsePolygonMetres(startPoint.alongM) + deltaAlongM),
        snapHouseFootprintValue(parsePolygonMetres(startPoint.depthM) + deltaDepthM),
      );
      void commitFootprintEdit({ type: 'polygon', polygon: nextPolygon });
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerId !== footprintVertexDragSession.pointerId) return;
      setFootprintVertexDragSession(null);
      setFootprintContextHovered(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [commitFootprintEdit, footprintVertexDragSession, onCommitFootprintEdit]);

  useEffect(() => {
    if (!planFieldDragSession || !onCommitField) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== planFieldDragSession.pointerId) return;
      const svg = footprintSvgRef.current;
      if (!svg) return;
      const nextPoint = clientPointToSvg(svg, event.clientX, event.clientY);
      if (!nextPoint) return;

      const deltaSvgX = nextPoint.x - planFieldDragSession.startSvgX;
      const deltaSvgY = nextPoint.y - planFieldDragSession.startSvgY;
      const deltaUnits = deltaSvgX * planFieldDragSession.axisX + deltaSvgY * planFieldDragSession.axisY;
      const deltaM = (deltaUnits / Math.max(planFieldDragSession.scale, 0.001)) * planFieldDragSession.deltaMultiplier;
      const unclampedValueM = planFieldDragSession.startValueM + deltaM;
      const nextValueM = Number.isFinite(planFieldDragSession.maxValueM)
        ? Math.min(Math.max(unclampedValueM, planFieldDragSession.minValueM), planFieldDragSession.maxValueM)
        : Math.max(unclampedValueM, planFieldDragSession.minValueM);

      void commitFieldEdit(planFieldDragSession.field, formatDrawingFieldValue(nextValueM));
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerId !== planFieldDragSession.pointerId) return;
      setPlanFieldDragSession(null);
      setPlanActiveResizeFieldId(null);
      setPlanHoveredResizeFieldId(null);
      setPanDragSession(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [commitFieldEdit, onCommitField, planFieldDragSession]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (drawOutlineSession && event.key === 'Enter') {
        event.preventDefault();
        handleDrawOutlineConfirmSegment();
        return;
      }
      if (drawOutlineSession && event.key === 'Backspace') {
        event.preventDefault();
        handleDrawOutlineUndo();
        return;
      }
      if (event.key !== 'Escape') return;
      if (drawOutlineSession) {
        event.preventDefault();
        handleDrawOutlineCancel();
        return;
      }
      setFootprintDragSession(null);
      setFootprintActiveHandleId(null);
      setFootprintHoveredHandleId(null);
      setFootprintContextHovered(false);
      setPlanFieldDragSession(null);
      setPlanActiveResizeFieldId(null);
      setPlanHoveredResizeFieldId(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawOutlineSession, handleDrawOutlineCancel, handleDrawOutlineConfirmSegment, handleDrawOutlineUndo]);

  const drawOutlinePendingPoint = useMemo(() => (drawOutlineSession ? resolvePendingOutlinePoint(drawOutlineSession) : null), [drawOutlineSession]);
  const drawOutlineHoverPreviewPoint =
    drawOutlineSession && !drawOutlinePendingPoint && !hasDrawOutlineDraft(drawOutlineSession) ? drawOutlineHoverPoint?.point ?? null : null;
  const drawOutlinePreviewPointKind: 'pending' | 'hover' | null = drawOutlinePendingPoint ? 'pending' : drawOutlineHoverPreviewPoint ? 'hover' : null;
  const drawOutlineConfirmedPointCount = drawOutlineSession?.points.length ?? 0;
  const drawOutlineCloseReady = drawOutlineConfirmedPointCount >= 3;
  const drawOutlineCloseHovered = Boolean(drawOutlineCloseReady && drawOutlineHoverPoint?.closeHovered && drawOutlineHoverPreviewPoint);
  const drawOutlinePopoverAnchorPointCount = drawOutlinePendingPoint ? drawOutlineConfirmedPointCount + 1 : drawOutlineConfirmedPointCount;
  const drawOutlinePreviewPolygon = useMemo(() => {
    if (!drawOutlineSession) return undefined;
    const previewPoint = drawOutlinePendingPoint ?? drawOutlineHoverPreviewPoint;
    return outlinePointsToPolygon(previewPoint ? [...drawOutlineSession.points, previewPoint] : drawOutlineSession.points);
  }, [drawOutlineHoverPreviewPoint, drawOutlinePendingPoint, drawOutlineSession]);

  useEffect(() => {
    if (!showDrawingViewport) return;
    const currentFitKey = resolveCurrentFitKey();
    if (autoFitKeyRef.current === currentFitKey) return;
    if (userAdjustedViewportRef.current && autoFitKeyRef.current === null) return;
    if (fitViewportToContent()) autoFitKeyRef.current = currentFitKey;
  }, [fitViewportToContent, planModel, resolveCurrentFitKey, sectionModel, showDrawingViewport]);

  useEffect(() => {
    if (!drawOutlineSession) {
      setDrawPopoverPosition(null);
      return;
    }

    const pointCount = drawOutlinePopoverAnchorPointCount;
    if (pointCount < 1) {
      setDrawPopoverPosition(null);
      return;
    }

    const scroller = scrollerRef.current;
    const popover = drawPopoverRef.current;
    const anchor = scroller?.querySelector(`[data-footprint-custom-vertex="${pointCount - 1}"]`);
    if (!scroller || !popover || !anchor) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const scrollerWidth = scroller.clientWidth || scrollerRect.width;
    const scrollerHeight = scroller.clientHeight || scrollerRect.height;
    const popoverWidth = popover.offsetWidth || popoverRect.width;
    const popoverHeight = popover.offsetHeight || popoverRect.height;

    if (scrollerWidth <= 0 || scrollerHeight <= 0 || popoverWidth <= 0 || popoverHeight <= 0) return;

    const anchorLeft = anchorRect.left - scrollerRect.left;
    const anchorRight = anchorRect.right - scrollerRect.left;
    const anchorCenterY = anchorRect.top - scrollerRect.top + anchorRect.height / 2;
    let left = anchorRight + DRAW_POPOVER_GAP_PX;
    let top = anchorCenterY - popoverHeight / 2;

    if (left + popoverWidth + DRAW_POPOVER_MARGIN_PX > scrollerWidth) {
      left = anchorLeft - popoverWidth - DRAW_POPOVER_GAP_PX;
    }
    if (left < DRAW_POPOVER_MARGIN_PX) {
      left = Math.min(Math.max(anchorRight + DRAW_POPOVER_GAP_PX, DRAW_POPOVER_MARGIN_PX), scrollerWidth - popoverWidth - DRAW_POPOVER_MARGIN_PX);
    }

    left = Math.max(DRAW_POPOVER_MARGIN_PX, Math.min(left, scrollerWidth - popoverWidth - DRAW_POPOVER_MARGIN_PX));
    top = Math.max(DRAW_POPOVER_MARGIN_PX, Math.min(top, scrollerHeight - popoverHeight - DRAW_POPOVER_MARGIN_PX));

    setDrawPopoverPosition((current) => {
      if (current && Math.abs(current.left - left) < 0.5 && Math.abs(current.top - top) < 0.5) return current;
      return { left, top };
    });
  }, [drawOutlinePopoverAnchorPointCount, drawOutlineSession, viewportTransform.panX, viewportTransform.panY, zoom]);

  const footprintEditor = useMemo<ModuleFootprintEditorProps | undefined>(() => {
    if (!canEditFootprint && !canRotatePlan) return undefined;
    return {
      available: canEditFootprint,
      surface: 'model',
      isEditing: true,
      customPolygonOverride: drawOutlinePreviewPolygon,
      customPolygonOpen: Boolean(drawOutlineSession),
      customPolygonConfirmedPointCount: drawOutlineConfirmedPointCount,
      customPolygonPreviewPointKind: drawOutlinePreviewPointKind,
      customPolygonCloseReady: drawOutlineCloseReady,
      customPolygonCloseHovered: drawOutlineCloseHovered,
      hideHouseFootprint: Boolean(drawOutlineSession && (drawOutlinePreviewPolygon?.length ?? 0) < 3),
      isContextHovered: footprintContextHovered,
      hoveredAttachmentSide: footprintHoveredAttachmentSide,
      hoveredHandleId: footprintHoveredHandleId,
      activeHandleId: footprintActiveHandleId,
      onStartEditing: () => undefined,
      onDoneEditing: () => undefined,
      onContextHoverChange: (hovered) => setFootprintContextHovered(hovered),
      onContextPopoverHoverChange: () => undefined,
      onAttachmentSideHover: (side) => setFootprintHoveredAttachmentSide(side),
      onAttachmentSideSelect: (side) => void handleFootprintAttachmentSideSelect(side),
      onHandleHover: (handleId) => setFootprintHoveredHandleId(handleId),
      onHandleDragStart: handleFootprintDragStart,
      onVertexDragStart: handleFootprintVertexDragStart,
      onVertexDelete: (vertexIndex) => void handleFootprintVertexDelete(vertexIndex),
      onEdgeAdd: (edgeIndex) => void handleFootprintEdgeAdd(edgeIndex),
      onPresetSelect: (preset) => void handleFootprintPresetSelect(preset),
      onModeSelect: (mode) => void handleFootprintModeSelect(mode),
      onRotate: (delta) => void handleFootprintRotate(delta),
      onCanvasPointSelect: drawOutlineSession ? handleDrawOutlinePointSelect : undefined,
      onCanvasPointHover: drawOutlineSession ? handleDrawOutlinePointHover : undefined,
      onCloseStartSelect: drawOutlineSession ? () => void handleDrawOutlineClose() : undefined,
      onSvgMount: (node) => {
        footprintSvgRef.current = node;
      },
    };
  }, [
    canEditFootprint,
    canRotatePlan,
    drawOutlineCloseHovered,
    drawOutlineCloseReady,
    drawOutlineConfirmedPointCount,
    drawOutlinePreviewPointKind,
    drawOutlinePreviewPolygon,
    drawOutlineSession,
    footprintActiveHandleId,
    footprintContextHovered,
    footprintHoveredAttachmentSide,
    footprintHoveredHandleId,
    handleFootprintAttachmentSideSelect,
    handleFootprintDragStart,
    handleFootprintEdgeAdd,
    handleFootprintModeSelect,
    handleFootprintPresetSelect,
    handleFootprintRotate,
    handleFootprintVertexDelete,
    handleFootprintVertexDragStart,
    handleDrawOutlineClose,
    handleDrawOutlinePointHover,
    handleDrawOutlinePointSelect,
  ]);

  const planInteraction = useMemo<ModulePlanInteractionProps | undefined>(() => {
    if (!canEditPlanDimensions) return undefined;
    return {
      available: true,
      hoveredResizeFieldId: planHoveredResizeFieldId,
      activeResizeFieldId: planActiveResizeFieldId,
      onResizeFieldHover: (fieldId) => setPlanHoveredResizeFieldId(fieldId),
      onResizeFieldDragStart: handlePlanFieldDragStart,
      onSvgMount: (node) => {
        footprintSvgRef.current = node;
      },
    };
  }, [canEditPlanDimensions, handlePlanFieldDragStart, planActiveResizeFieldId, planHoveredResizeFieldId]);

  const scaleFrameStyle = useMemo(
    () => ({
      transform: `translate(${viewportTransform.panX}px, ${viewportTransform.panY}px) scale(${zoom})`,
    }),
    [viewportTransform.panX, viewportTransform.panY, zoom],
  );
  const drawPopoverStyle = useMemo(
    () =>
      drawPopoverPosition
        ? {
            left: `${drawPopoverPosition.left}px`,
            top: `${drawPopoverPosition.top}px`,
          }
        : undefined,
    [drawPopoverPosition],
  );

  void planViewModel;

  return (
    <section className={styles.viewport} aria-label={`${view === 'plan' ? 'Plan' : 'Section'} model space viewport`} style={moduleDrawingThemeCssVariables('model')}>
      <div
        ref={scrollerRef}
        data-model-space-scroller
        className={`${styles.scroller} ${panDragSession ? styles.scrollerPanning : ''}`}
        onPointerDown={handleCanvasPanStart}
        onWheel={handleWheel}
      >
        <div className={styles.canvasControls} onPointerDown={(event) => event.stopPropagation()}>
          <button type="button" className={styles.overlayButton} onClick={() => handleZoomChange(-0.1)}>
            -
          </button>
          <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
          <button type="button" className={styles.overlayButton} onClick={() => handleZoomChange(0.1)}>
            +
          </button>
          <button type="button" className={styles.overlayButton} onClick={handleResetView}>
            Reset
          </button>
        </div>

        {interactionError ? <p className={styles.error}>{interactionError}</p> : null}

        {drawOutlineSession ? (
          <div
            ref={drawPopoverRef}
            className={styles.drawPopover}
            aria-label="Draw house outline controls"
            data-draw-popover-anchor={drawPopoverPosition ? 'vertex' : 'default'}
            style={drawPopoverStyle}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <p className={styles.drawHint}>
              {drawOutlineSession.points.length
                ? `${drawOutlineSession.points.length} point${drawOutlineSession.points.length === 1 ? '' : 's'} placed`
                : 'Click first corner'}
            </p>
            <label className={styles.popoverField}>
              <span className={styles.fieldLabel}>Distance (m)</span>
              <input
                className={styles.input}
                inputMode="decimal"
                value={drawOutlineSession.distanceDraft}
                disabled={!drawOutlineSession.points.length}
                onChange={(event) =>
                  setDrawOutlineSession((current) =>
                    current ? { ...current, distanceDraft: event.target.value, pendingPoint: null } : current,
                  )
                }
              />
            </label>
            <label className={styles.popoverField}>
              <span className={styles.fieldLabel}>Angle (deg)</span>
              <input
                className={styles.input}
                inputMode="decimal"
                value={drawOutlineSession.angleDraft}
                disabled={!drawOutlineSession.points.length}
                onChange={(event) =>
                  setDrawOutlineSession((current) =>
                    current ? { ...current, angleDraft: event.target.value, pendingPoint: null } : current,
                  )
                }
              />
            </label>
            <button type="button" className={styles.confirmButton} onClick={handleDrawOutlineConfirmSegment} disabled={!drawOutlineSession.points.length}>
              Confirm
            </button>
            <div className={styles.drawActions}>
              <button type="button" className={styles.overlayButton} onClick={handleDrawOutlineClose}>
                Close
              </button>
              <button type="button" className={styles.overlayButton} onClick={handleDrawOutlineUndo} disabled={!drawOutlineSession.points.length}>
                Undo
              </button>
              <button type="button" className={styles.overlayButton} onClick={handleDrawOutlineCancel}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div ref={scaleFrameRef} data-model-space-scale-frame className={styles.scaleFrame} style={scaleFrameStyle}>
          <div className={styles.canvas}>
            {showDrawingViewport ? (
              <ModuleDrawingRenderer
                view={view}
                status={status}
                planModel={planModel}
                sectionModel={sectionModel}
                presentation="model"
                interactiveFields={showPlanViewport ? modelInteractiveFields : undefined}
                footprintEditor={showPlanViewport ? footprintEditor : undefined}
                planInteraction={showPlanViewport ? planInteraction : undefined}
              />
            ) : (
              <div className={styles.placeholder}>
                <p className={styles.placeholderTitle}>Waiting for valid model-space geometry.</p>
                <p className={styles.placeholderText}>Resolve the current drawing inputs to restore the generated model-space view.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
