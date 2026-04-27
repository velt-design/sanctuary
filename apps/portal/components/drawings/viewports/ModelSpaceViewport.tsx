'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from 'react';
import type { AttachmentSide } from '@sp/costing';
import {
  ModuleDrawingRenderer,
  type HouseFirstPlanShapeDragStartMeta,
  type ModuleDrawingInteractiveFieldMap,
  type ModulePlanInteractionProps,
  type ModulePlanResizeDragMeta,
  type ModulePlanResizeFieldId,
  canEditHouseFootprintPlan,
  type HouseFootprintEditorDragMeta,
  type HouseFootprintVertexDragMeta,
  type ModuleFootprintCanvasPoint,
  type ModuleFootprintCanvasPointResolver,
  type ModuleFootprintEditorProps,
  type ModuleViewsStatus,
  type ModuleViewsTab,
} from '@/app/staff/calculator/ModuleViewsCard';
import type { HouseFootprintHandleId, ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import type { PlanViewModel } from '@/lib/drawings/views/plan/buildPlanViewModel';
import type { DrawingWorkbenchViewportTransform } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { EstimateDrawingField, EstimateDrawingFootprintEdit } from '@/lib/estimates/drawingEdits';
import type {
  HouseFirstDeckDraft,
  HouseFirstOpeningDraft,
  WorkbenchHouseSelection,
  WorkbenchMode,
} from '@/lib/drawings/state/houseFirstWorkbenchModel';
import {
  normalizeHouseFootprintParams,
  type CalculatorHouseFootprintParams,
  type CalculatorHouseFootprintPolygonPoint,
} from '@/lib/types/calculator';
import { moduleDrawingThemeCssVariables } from '@/lib/theme/moduleDrawing';
import {
  resizeCustomPolygonEdge,
  type HouseFirstPlanDeckReferenceFrame,
  type HouseFirstPlanDeckInteraction,
  type HouseFirstPlanOpeningInteraction,
  type HouseFirstPlanCustomEdgeCandidate,
  type HouseFirstPlanPresetDimensionAnnotation,
  type PlanPoint,
} from '@/lib/drawings/views/plan/houseFirstPlanOverlay';
import { blockNativeSelectionEvent } from './nativeSelection';
import styles from './ModelSpaceViewport.module.css';
import {
  cancelDrawOutlineTool,
  confirmDrawOutlineSegment,
  createInactiveDrawOutlineState,
  deriveDrawOutlineViewModel,
  finishSuccessfulDrawOutlineCommit,
  hoverDrawOutlinePoint,
  isDrawOutlineActive,
  prepareDrawOutlineClose,
  selectDrawOutlinePoint,
  setDrawOutlineAngleDraft,
  setDrawOutlineDistanceDraft,
  startDrawOutlineTool,
  undoDrawOutline,
  type DrawOutlineDiagnosticState,
  type DrawOutlineToolState,
  type DrawOutlineTransitionResult,
} from './drawOutlineToolState';

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

type TouchPointerSnapshot = {
  pointerId: number;
  clientX: number;
  clientY: number;
};

type PinchZoomSession = {
  firstPointerId: number;
  secondPointerId: number;
  startMidpointX: number;
  startMidpointY: number;
  startDistance: number;
  startZoom: number;
  startPanX: number;
  startPanY: number;
};

type WebKitGestureSession = {
  startAnchorX: number;
  startAnchorY: number;
  startZoom: number;
  startPanX: number;
  startPanY: number;
};

type NativeGestureEvent = Event & {
  scale?: number;
  clientX?: number;
  clientY?: number;
};

type DrawOutlinePointerSession = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPanX: number;
  startPanY: number;
  startPoint: ModuleFootprintCanvasPoint;
  hasPanned: boolean;
};

type DrawPopoverPosition = {
  left: number;
  top: number;
};

type HouseFirstDimensionEditorState = {
  annotation: HouseFirstPlanPresetDimensionAnnotation | HouseFirstPlanCustomEdgeCandidate;
  value: string;
};

type DeckSvgInteraction = Extract<HouseFirstPlanShapeDragStartMeta, { ownerKind: 'deck' }>['deckInteraction'];

type DeckDragSession = {
  pointerId: number;
  deckId: string;
  startSvgX: number;
  startSvgY: number;
  startCenter: PlanPoint;
  startWidthM: number;
  startDepthM: number;
  interaction: HouseFirstPlanDeckInteraction;
  svgInteraction: DeckSvgInteraction;
};

type DeckPreviewState = {
  deckId: string;
  polygon: PlanPoint[];
  hostEdgeId: AttachmentSide;
  hostEdgeStart: PlanPoint;
  hostEdgeEnd: PlanPoint;
  centerOffsetM: number;
  referenceEdgeGapM: number;
  placement: 'snapped' | 'free';
  snapped: boolean;
};

type OpeningSvgInteraction = Extract<HouseFirstPlanShapeDragStartMeta, { ownerKind: 'opening' }>['openingInteraction'];

type OpeningDragSession = {
  pointerId: number;
  openingId: string;
  startSvgX: number;
  startSvgY: number;
  startPolygon: PlanPoint[];
  startOffsetAlongWallM: number;
  interaction: HouseFirstPlanOpeningInteraction;
  svgInteraction: OpeningSvgInteraction;
};

type OpeningPreviewState = {
  openingId: string;
  polygon: PlanPoint[];
  offsetAlongWallM: number;
  clamped: boolean;
};

type DeckInteractionTelemetry = {
  selectedDeckId: string | null;
  housePolygonSource: 'custom_saved' | 'preset_derived' | null;
  selectedDeckType: 'none' | 'preset_snapped' | 'preset_free' | 'custom_outline' | 'preset_unresolved';
  dragEligible: boolean;
  dragReason: string | null;
  hostEdgeResolvable: boolean;
  relationshipDimensionsAvailable: boolean;
  snapState: 'idle' | 'free' | 'snapped';
  snapMessage: string | null;
};

type DeckInteractionHintState = {
  title: string;
  detail: string;
  tone: 'eligible' | 'deferred' | 'status';
};

type ModelSpaceRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ModelSpaceGesture =
  | 'idle'
  | 'mouse-pan'
  | 'wheel-pan'
  | 'wheel-zoom'
  | 'pinch-zoom'
  | 'trackpad-pinch'
  | 'draw-click-candidate'
  | 'draw-panning';

type ModelSpacePinchSource = 'none' | 'touch-pointer' | 'wheel' | 'webkit-gesture';

const MIN_MODEL_ZOOM = 0.25;
const MAX_MODEL_ZOOM = 4;
const FIT_VIEW_MARGIN_PX = 24;
const DRAW_POPOVER_MARGIN_PX = 12;
const DRAW_POPOVER_GAP_PX = 14;
const DRAW_OUTLINE_PAN_THRESHOLD_PX = 5;
const WHEEL_LINE_DELTA_PX = 16;
const WHEEL_PAGE_DELTA_PX = 240;
const WHEEL_ZOOM_SENSITIVITY = 0.0012;
const WHEEL_GESTURE_IDLE_MS = 600;
const DECK_SNAP_TOLERANCE_M = 0.25;
const DECK_UNSNAP_TOLERANCE_M = 0.4;
const DECK_REFERENCE_SWITCH_HYSTERESIS_M = 0.2;

function drawOutlineStatusText(state: DrawOutlineDiagnosticState): string {
  switch (state) {
    case 'first-point':
      return 'Draw outline: click first corner';
    case 'placing':
      return 'Draw outline: click next corner or enter distance and angle';
    case 'pending-segment':
      return 'Draw outline: confirm segment or undo';
    case 'close-ready':
      return 'Draw outline: close shape or add another corner';
    case 'close-hovered':
      return 'Draw outline: release on first corner to close';
    case 'error':
      return 'Draw outline: fix issue or undo';
    case 'inactive':
    default:
      return '';
  }
}

function clampZoom(value: number): number {
  return Math.min(Math.max(value, MIN_MODEL_ZOOM), MAX_MODEL_ZOOM);
}

function clampValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isViewportNavigationControlTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest('button,input,select,textarea,[contenteditable="true"],[data-draw-outline-controls]'),
    )
  );
}

function isViewportEditHitTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        '[data-plan-resize-handle-hit],[data-editable-field-id],[data-house-first-shape-hit],[data-house-first-custom-edge-hit],[data-house-first-plan-dimension],[data-footprint-edge],[data-footprint-resize-edge-hit],[data-footprint-custom-edge-hit],[data-footprint-custom-vertex],[data-footprint-custom-vertex-hit],[data-footprint-custom-close-hit]',
      ),
    )
  );
}

function isViewportMousePanIgnoredTarget(target: EventTarget | null): boolean {
  return isViewportNavigationControlTarget(target) || isViewportEditHitTarget(target);
}

function normalizeWheelDeltaPixels(event: Pick<WheelEvent<Element>, 'deltaMode' | 'deltaX' | 'deltaY'>): {
  deltaX: number;
  deltaY: number;
} {
  const multiplier = event.deltaMode === 1 ? WHEEL_LINE_DELTA_PX : event.deltaMode === 2 ? WHEEL_PAGE_DELTA_PX : 1;
  return {
    deltaX: event.deltaX * multiplier,
    deltaY: event.deltaY * multiplier,
  };
}

function resolveTouchMidpoint(first: TouchPointerSnapshot, second: TouchPointerSnapshot): { x: number; y: number } {
  return {
    x: (first.clientX + second.clientX) / 2,
    y: (first.clientY + second.clientY) / 2,
  };
}

function resolveTouchDistance(first: TouchPointerSnapshot, second: TouchPointerSnapshot): number {
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

function resolveTouchPointerPair(pointers: Map<number, TouchPointerSnapshot>): [TouchPointerSnapshot, TouchPointerSnapshot] | null {
  if (pointers.size !== 2) return null;
  const pair = Array.from(pointers.values());
  const first = pair[0];
  const second = pair[1];
  return first && second ? [first, second] : null;
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

function resolveModelSpaceFocusTargetRect(input: { scaleFrame: HTMLDivElement; frameRect: DOMRect; zoom: number }): ModelSpaceRect | null {
  const focusTarget = input.scaleFrame.querySelector('[data-model-space-focus-target]');
  if (!focusTarget) return null;
  const safeZoom = Math.max(input.zoom, 0.001);
  const targetRect = focusTarget.getBoundingClientRect();
  const width = targetRect.width / safeZoom;
  const height = targetRect.height / safeZoom;
  if (width <= 0 || height <= 0) return null;
  return {
    x: (targetRect.left - input.frameRect.left) / safeZoom,
    y: (targetRect.top - input.frameRect.top) / safeZoom,
    width,
    height,
  };
}

function resolveModelSpaceSvgFocusRect(input: {
  scaleFrame: HTMLDivElement;
  frameRect: DOMRect;
  zoom: number;
}): ModelSpaceRect | null {
  const svg = input.scaleFrame.querySelector<SVGSVGElement>('svg[data-model-space-svg]');
  const viewBox = parseModelSpaceRect(svg?.dataset.modelSpaceViewBox ?? svg?.getAttribute('viewBox'));
  const focusBox = parseModelSpaceRect(svg?.dataset.modelSpaceFocusBox);
  if (!svg || !viewBox || !focusBox) return null;

  const safeZoom = Math.max(input.zoom, 0.001);
  const svgRect = svg.getBoundingClientRect();
  const svgWidth = (svgRect.width > 0 ? svgRect.width / safeZoom : 0) || Number.parseFloat(svg.getAttribute('width') ?? '');
  const svgHeight = (svgRect.height > 0 ? svgRect.height / safeZoom : 0) || Number.parseFloat(svg.getAttribute('height') ?? '');
  if (svgWidth <= 0 || svgHeight <= 0) return null;

  const svgLeft = svgRect.width > 0 ? (svgRect.left - input.frameRect.left) / safeZoom : 0;
  const svgTop = svgRect.height > 0 ? (svgRect.top - input.frameRect.top) / safeZoom : 0;
  const cssPerUnitX = svgWidth / viewBox.width;
  const cssPerUnitY = svgHeight / viewBox.height;

  return {
    x: svgLeft + (focusBox.x - viewBox.x) * cssPerUnitX,
    y: svgTop + (focusBox.y - viewBox.y) * cssPerUnitY,
    width: focusBox.width * cssPerUnitX,
    height: focusBox.height * cssPerUnitY,
  };
}

function resolveModelSpaceSvgRect(input: { scaleFrame: HTMLDivElement; frameRect: DOMRect; zoom: number }): ModelSpaceRect | null {
  const svg = input.scaleFrame.querySelector<SVGSVGElement>('svg[data-model-space-svg]');
  if (!svg) return null;
  const safeZoom = Math.max(input.zoom, 0.001);
  const svgRect = svg.getBoundingClientRect();
  const width = (svgRect.width > 0 ? svgRect.width / safeZoom : 0) || Number.parseFloat(svg.getAttribute('width') ?? '');
  const height = (svgRect.height > 0 ? svgRect.height / safeZoom : 0) || Number.parseFloat(svg.getAttribute('height') ?? '');
  if (width <= 0 || height <= 0) return null;
  return {
    x: svgRect.width > 0 ? (svgRect.left - input.frameRect.left) / safeZoom : 0,
    y: svgRect.height > 0 ? (svgRect.top - input.frameRect.top) / safeZoom : 0,
    width,
    height,
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

function formatDeckPresetValue(value: number): string {
  return value.toFixed(3).replace(/\.?0+$/, '') || '0';
}

function resolveDeckHostReferenceCenterOffset(input: {
  annotation: HouseFirstPlanPresetDimensionAnnotation;
  nextValue: string;
}): { ok: true; centerOffsetM: string } | { ok: false; error: string } {
  const interaction = input.annotation.deckInteraction;
  const nextGapM = Number.parseFloat(input.nextValue);
  if (!interaction) return { ok: false, error: 'Deck relationship metadata is unavailable.' };
  if (!Number.isFinite(nextGapM) || nextGapM < 0) return { ok: false, error: 'Enter a non-negative offset.' };

  const maxGapM = Math.max(0, interaction.hostSpanM - interaction.deckWidthM);
  if (nextGapM > maxGapM + 1e-6) {
    return { ok: false, error: 'Offset must stay within the host edge span.' };
  }

  const availableHalfSpanM = Math.max(0, (interaction.hostSpanM - interaction.deckWidthM) / 2);
  const centerOffsetM =
    input.annotation.fieldKey === 'hostStartGapM'
      ? nextGapM - availableHalfSpanM
      : input.annotation.fieldKey === 'hostEndGapM'
        ? availableHalfSpanM - nextGapM
        : Number.NaN;

  if (!Number.isFinite(centerOffsetM)) {
    return { ok: false, error: 'Unsupported deck relationship dimension.' };
  }

  return {
    ok: true,
    centerOffsetM: formatDeckPresetValue(clampValue(centerOffsetM, interaction.minCenterOffsetM, interaction.maxCenterOffsetM)),
  };
}

function resolveDeckCrossEdgeCenterOffset(input: {
  annotation: HouseFirstPlanPresetDimensionAnnotation;
  nextValue: string;
}): { ok: true; centerOffsetM: string } | { ok: false; error: string } {
  const interaction = input.annotation.deckInteraction;
  const nextGapM = Number.parseFloat(input.nextValue);
  if (!interaction?.crossEdgeReference) return { ok: false, error: 'Deck witness metadata is unavailable.' };
  if (!Number.isFinite(nextGapM) || nextGapM < 0) return { ok: false, error: 'Enter a non-negative gap.' };

  const primaryFrame = interaction.referenceFrames.find((frame) => frame.hostEdgeId === interaction.hostEdgeId);
  if (!primaryFrame) return { ok: false, error: 'Deck host metadata is unavailable.' };

  const crossFrame = interaction.crossEdgeReference.frame;
  const deckWidthM = interaction.deckWidthM;
  let centerAlongM: number;

  if (crossFrame.hostEdgeId === 'left') {
    centerAlongM = crossFrame.edgeCoordinateM - nextGapM - deckWidthM / 2;
  } else if (crossFrame.hostEdgeId === 'right') {
    centerAlongM = crossFrame.edgeCoordinateM + nextGapM + deckWidthM / 2;
  } else if (crossFrame.hostEdgeId === 'rear') {
    centerAlongM = crossFrame.edgeCoordinateM - nextGapM - deckWidthM / 2;
  } else {
    centerAlongM = crossFrame.edgeCoordinateM + nextGapM + deckWidthM / 2;
  }

  const hostMidpointM = (primaryFrame.spanStartM + primaryFrame.spanEndM) / 2;
  return {
    ok: true,
    centerOffsetM: formatDeckPresetValue(centerAlongM - hostMidpointM),
  };
}

function translatePolygon(
  polygon: PlanPoint[],
  deltaX: number,
  deltaY: number,
): PlanPoint[] {
  if (Math.abs(deltaX) <= 1e-6 && Math.abs(deltaY) <= 1e-6) return polygon;
  return polygon.map((point) => ({
    x: point.x + deltaX,
    y: point.y + deltaY,
  }));
}

function resolvePolygonCenter(polygon: PlanPoint[]): PlanPoint {
  if (!polygon.length) return { x: 0, y: 0 };
  const sum = polygon.reduce(
    (accumulator, point) => ({
      x: accumulator.x + point.x,
      y: accumulator.y + point.y,
    }),
    { x: 0, y: 0 },
  );
  return {
    x: sum.x / polygon.length,
    y: sum.y / polygon.length,
  };
}

function clampPresetDeckCenterOffset(input: {
  centerOffsetM: number;
  frame: HouseFirstPlanDeckReferenceFrame;
  deckWidthM: number;
}): number {
  const hostSpanM = Math.max(0, input.frame.spanEndM - input.frame.spanStartM);
  const availableHalfSpanM =
    input.deckWidthM <= hostSpanM + 1e-6 ? Math.max(0, (hostSpanM - input.deckWidthM) / 2) : 0;
  return clampValue(input.centerOffsetM, -availableHalfSpanM, availableHalfSpanM);
}

function projectPointToDeckReferenceFrame(
  point: PlanPoint,
  frame: HouseFirstPlanDeckReferenceFrame,
): { alongM: number; outwardM: number } {
  const relative = {
    x: point.x - frame.hostEdgeStart.x,
    y: point.y - frame.hostEdgeStart.y,
  };
  return {
    alongM: relative.x * frame.alongUnitX + relative.y * frame.alongUnitY + frame.spanStartM,
    outwardM: relative.x * frame.outwardUnitX + relative.y * frame.outwardUnitY,
  };
}

function buildDeckPreviewPolygon(input: {
  frame: HouseFirstPlanDeckReferenceFrame;
  deckWidthM: number;
  deckDepthM: number;
  centerOffsetM: number;
  referenceEdgeGapM: number;
}): PlanPoint[] {
  const edgeMidpointM = (input.frame.spanStartM + input.frame.spanEndM) / 2;
  const centerAlongM = edgeMidpointM + input.centerOffsetM;
  const nearAlongM = centerAlongM - input.deckWidthM / 2;
  const farAlongM = centerAlongM + input.deckWidthM / 2;
  const nearOutM = input.referenceEdgeGapM;
  const farOutM = nearOutM + input.deckDepthM;
  const pointAt = (alongM: number, outM: number): PlanPoint => ({
    x:
      input.frame.hostEdgeStart.x +
      input.frame.alongUnitX * (alongM - input.frame.spanStartM) +
      input.frame.outwardUnitX * outM,
    y:
      input.frame.hostEdgeStart.y +
      input.frame.alongUnitY * (alongM - input.frame.spanStartM) +
      input.frame.outwardUnitY * outM,
  });
  if (input.frame.outwardDirection < 0) {
    return [
      pointAt(nearAlongM, farOutM),
      pointAt(farAlongM, farOutM),
      pointAt(farAlongM, nearOutM),
      pointAt(nearAlongM, nearOutM),
    ];
  }
  return [
    pointAt(nearAlongM, nearOutM),
    pointAt(farAlongM, nearOutM),
    pointAt(farAlongM, farOutM),
    pointAt(nearAlongM, farOutM),
  ];
}

function resolveDeckReferenceFrameFromCenter(input: {
  center: PlanPoint;
  deckDepthM: number;
  frames: HouseFirstPlanDeckReferenceFrame[];
  previousHostEdgeId: AttachmentSide;
}): HouseFirstPlanDeckReferenceFrame {
  const scoredFrames = input.frames.map((frame) => {
    const projection = projectPointToDeckReferenceFrame(input.center, frame);
    return {
      frame,
      gapM: Math.max(0, projection.outwardM - input.deckDepthM / 2),
    };
  });
  const previous = scoredFrames.find((candidate) => candidate.frame.hostEdgeId === input.previousHostEdgeId) ?? scoredFrames[0]!;
  const nearest =
    [...scoredFrames].sort((left, right) => left.gapM - right.gapM)[0] ?? previous;
  if (
    nearest.frame.hostEdgeId !== previous.frame.hostEdgeId &&
    nearest.gapM + DECK_REFERENCE_SWITCH_HYSTERESIS_M >= previous.gapM
  ) {
    return previous.frame;
  }
  return nearest.frame;
}

function resolveDeckPreviewState(input: {
  session: DeckDragSession;
  nextSvgX: number;
  nextSvgY: number;
  previousPreviewState: DeckPreviewState | null;
}): DeckPreviewState {
  const svgDx = input.nextSvgX - input.session.startSvgX;
  const svgDy = input.nextSvgY - input.session.startSvgY;
  const interactionSvgDx = input.session.svgInteraction.hostEdgeEnd.x - input.session.svgInteraction.hostEdgeStart.x;
  const interactionSvgDy = input.session.svgInteraction.hostEdgeEnd.y - input.session.svgInteraction.hostEdgeStart.y;
  const svgLength = Math.hypot(interactionSvgDx, interactionSvgDy);
  const metresPerSvgUnit = svgLength > 1e-6 ? input.session.interaction.hostSpanM / svgLength : 0;
  const center = {
    x: input.session.startCenter.x + svgDx * metresPerSvgUnit,
    y: input.session.startCenter.y + svgDy * metresPerSvgUnit,
  };
  const currentHostEdgeId = input.previousPreviewState?.hostEdgeId ?? input.session.interaction.hostEdgeId;
  const frame = resolveDeckReferenceFrameFromCenter({
    center,
    deckDepthM: input.session.startDepthM,
    frames: input.session.interaction.referenceFrames,
    previousHostEdgeId: currentHostEdgeId,
  });
  const projection = projectPointToDeckReferenceFrame(center, frame);
  const rawCenterOffsetM = projection.alongM - ((frame.spanStartM + frame.spanEndM) / 2);
  const snappedThreshold =
    input.previousPreviewState?.snapped && input.previousPreviewState.hostEdgeId === frame.hostEdgeId
      ? DECK_UNSNAP_TOLERANCE_M
      : DECK_SNAP_TOLERANCE_M;
  const rawGapM = Math.max(0, projection.outwardM - input.session.startDepthM / 2);
  const snapped = rawGapM <= snappedThreshold;
  const centerOffsetM = snapped
    ? clampPresetDeckCenterOffset({
        centerOffsetM: rawCenterOffsetM,
        frame,
        deckWidthM: input.session.startWidthM,
      })
    : rawCenterOffsetM;
  const referenceEdgeGapM = snapped ? 0 : rawGapM;

  return {
    deckId: input.session.deckId,
    hostEdgeId: frame.hostEdgeId,
    hostEdgeStart: frame.hostEdgeStart,
    hostEdgeEnd: frame.hostEdgeEnd,
    centerOffsetM,
    referenceEdgeGapM,
    placement: snapped ? 'snapped' : 'free',
    snapped,
    polygon: buildDeckPreviewPolygon({
      frame,
      deckWidthM: input.session.startWidthM,
      deckDepthM: input.session.startDepthM,
      centerOffsetM,
      referenceEdgeGapM,
    }),
  };
}

function resolveOpeningPreviewState(input: {
  session: OpeningDragSession;
  nextSvgX: number;
  nextSvgY: number;
}): OpeningPreviewState {
  const svgDx = input.session.svgInteraction.hostEdgeEnd.x - input.session.svgInteraction.hostEdgeStart.x;
  const svgDy = input.session.svgInteraction.hostEdgeEnd.y - input.session.svgInteraction.hostEdgeStart.y;
  const svgLength = Math.hypot(svgDx, svgDy);
  const axisX = svgLength > 1e-6 ? svgDx / svgLength : 1;
  const axisY = svgLength > 1e-6 ? svgDy / svgLength : 0;
  const deltaSvgX = input.nextSvgX - input.session.startSvgX;
  const deltaSvgY = input.nextSvgY - input.session.startSvgY;
  const deltaSvgAlong = deltaSvgX * axisX + deltaSvgY * axisY;
  const metresPerSvgUnit = svgLength > 1e-6 ? input.session.interaction.hostSpanM / svgLength : 0;
  const unclampedOffsetAlongWallM = input.session.startOffsetAlongWallM + deltaSvgAlong * metresPerSvgUnit;
  const offsetAlongWallM = clampValue(
    unclampedOffsetAlongWallM,
    input.session.interaction.minOffsetAlongWallM,
    input.session.interaction.maxOffsetAlongWallM,
  );
  const deltaOffsetM = offsetAlongWallM - input.session.startOffsetAlongWallM;

  return {
    openingId: input.session.openingId,
    polygon: translatePolygon(
      input.session.startPolygon,
      (input.session.interaction.hostEdgeEnd.x - input.session.interaction.hostEdgeStart.x) /
        Math.max(Math.hypot(
          input.session.interaction.hostEdgeEnd.x - input.session.interaction.hostEdgeStart.x,
          input.session.interaction.hostEdgeEnd.y - input.session.interaction.hostEdgeStart.y,
        ), 1e-6) * deltaOffsetM,
      (input.session.interaction.hostEdgeEnd.y - input.session.interaction.hostEdgeStart.y) /
        Math.max(Math.hypot(
          input.session.interaction.hostEdgeEnd.x - input.session.interaction.hostEdgeStart.x,
          input.session.interaction.hostEdgeEnd.y - input.session.interaction.hostEdgeStart.y,
        ), 1e-6) * deltaOffsetM,
    ),
    offsetAlongWallM,
    clamped: Math.abs(offsetAlongWallM - unclampedOffsetAlongWallM) > 1e-6,
  };
}

export default function ModelSpaceViewport({
  view,
  workbenchDisplayMode = 'pergolas',
  status,
  planModel,
  sectionModel,
  planViewModel,
  drawOutlineRequestId,
  drawOutlineMode,
  drawOutlineSeedPolygon,
  fitViewKey = view,
  autoFitOnReady = true,
  viewportTransform,
  onViewportTransformChange,
  editableFields,
  onCommitField,
  onCommitFootprintEdit,
  onCommitCustomPolygon,
  onSelectHouseFirstTarget,
  onCommitHouseFirstFootprintDimension,
  onCommitHouseFirstDeckDimension,
  onCommitHouseFirstOpeningDimension,
  onDeckInteractionTelemetryChange,
}: {
  view: ModuleViewsTab;
  workbenchDisplayMode?: WorkbenchMode;
  status: ModuleViewsStatus;
  planModel?: ModulePlanModel | null;
  sectionModel?: ModuleSectionModel | null;
  planViewModel?: PlanViewModel | null;
  drawOutlineRequestId?: number;
  drawOutlineMode?: 'footprint' | 'deck' | null;
  drawOutlineSeedPolygon?: CalculatorHouseFootprintPolygonPoint[] | null;
  fitViewKey?: string;
  autoFitOnReady?: boolean;
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
  onCommitCustomPolygon?: (
    polygon: CalculatorHouseFootprintPolygonPoint[],
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onSelectHouseFirstTarget?: (selection: WorkbenchHouseSelection) => void;
  onCommitHouseFirstFootprintDimension?: (
    edit: EstimateDrawingFootprintEdit,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onCommitHouseFirstDeckDimension?: (
    deckId: string,
    patch: Partial<HouseFirstDeckDraft>,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onCommitHouseFirstOpeningDimension?: (
    openingId: string,
    patch: Partial<HouseFirstOpeningDraft>,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onDeckInteractionTelemetryChange?: (telemetry: DeckInteractionTelemetry) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const scaleFrameRef = useRef<HTMLDivElement | null>(null);
  const drawPopoverRef = useRef<HTMLDivElement | null>(null);
  const dimensionPopoverRef = useRef<HTMLDivElement | null>(null);
  const footprintSvgRef = useRef<SVGSVGElement | null>(null);
  const drawOutlineCanvasPointResolverRef = useRef<ModuleFootprintCanvasPointResolver | null>(null);
  const drawOutlinePointerSessionRef = useRef<DrawOutlinePointerSession | null>(null);
  const lastDeckTelemetrySignatureRef = useRef<string | null>(null);
  const activeTouchPointersRef = useRef<Map<number, TouchPointerSnapshot>>(new Map());
  const pinchZoomSessionRef = useRef<PinchZoomSession | null>(null);
  const webKitGestureSessionRef = useRef<WebKitGestureSession | null>(null);
  const wheelGestureIdleTimeoutRef = useRef<number | null>(null);
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
  const [drawOutlineState, setDrawOutlineState] = useState<DrawOutlineToolState>(() => createInactiveDrawOutlineState());
  const [drawOutlineLandingPoint, setDrawOutlineLandingPoint] = useState<ModuleFootprintCanvasPoint | null>(null);
  const [drawOutlinePointerSession, setDrawOutlinePointerSession] = useState<DrawOutlinePointerSession | null>(null);
  const [drawPopoverPosition, setDrawPopoverPosition] = useState<DrawPopoverPosition | null>(null);
  const [activeTouchCount, setActiveTouchCount] = useState(0);
  const [pinchZoomActive, setPinchZoomActive] = useState(false);
  const [pinchSource, setPinchSource] = useState<ModelSpacePinchSource>('none');
  const [viewportNavigationGesture, setViewportNavigationGesture] = useState<ModelSpaceGesture>('idle');
  const [panDragSession, setPanDragSession] = useState<PanDragSession | null>(null);
  const [planHoveredResizeFieldId, setPlanHoveredResizeFieldId] = useState<ModulePlanResizeFieldId | null>(null);
  const [planActiveResizeFieldId, setPlanActiveResizeFieldId] = useState<ModulePlanResizeFieldId | null>(null);
  const [planFieldDragSession, setPlanFieldDragSession] = useState<PlanFieldDragSession | null>(null);
  const [houseFirstActiveCustomEdgeId, setHouseFirstActiveCustomEdgeId] = useState<string | null>(null);
  const [houseFirstDimensionEditor, setHouseFirstDimensionEditor] = useState<HouseFirstDimensionEditorState | null>(null);
  const [houseFirstDimensionPopoverPosition, setHouseFirstDimensionPopoverPosition] = useState<DrawPopoverPosition | null>(null);
  const [deckDragSession, setDeckDragSession] = useState<DeckDragSession | null>(null);
  const [deckPreviewState, setDeckPreviewState] = useState<DeckPreviewState | null>(null);
  const [openingDragSession, setOpeningDragSession] = useState<OpeningDragSession | null>(null);
  const [openingPreviewState, setOpeningPreviewState] = useState<OpeningPreviewState | null>(null);
  const [deckInteractionHint, setDeckInteractionHint] = useState<DeckInteractionHintState | null>(null);

  useEffect(() => {
    drawOutlinePointerSessionRef.current = drawOutlinePointerSession;
  }, [drawOutlinePointerSession]);

  useEffect(
    () => () => {
      if (wheelGestureIdleTimeoutRef.current !== null) {
        window.clearTimeout(wheelGestureIdleTimeoutRef.current);
      }
    },
    [],
  );

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
  const canCommitCustomPolygon = view === 'plan' && Boolean(planModel) && Boolean(onCommitCustomPolygon);
  const deckOutlineMode = drawOutlineMode === 'deck';
  const canRotatePlan = view === 'plan' && Boolean(planModel) && Boolean(onCommitFootprintEdit) && planModel?.roofType !== 'hip_corner';
  const canEditPlanDimensions =
    view === 'plan' &&
    Boolean(planModel) &&
    Boolean(onCommitField) &&
    (editableFieldMap.has('plan:lengthA') || editableFieldMap.has('plan:spanA'));
  const showHouseSectionPlaceholder = workbenchDisplayMode === 'house' && view === 'section';
  const showPlanViewport = view === 'plan' && Boolean(planModel);
  const showSectionViewport = view === 'section' && Boolean(sectionModel) && !showHouseSectionPlaceholder;
  const showDrawingViewport = showPlanViewport || showSectionViewport;
  const modelSpaceAutoFitReady = showDrawingViewport;
  const modelSpaceAutoFitKey = `${fitViewKey}:${modelSpaceAutoFitReady ? 'ready' : 'empty'}`;
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

  const closeHouseFirstDimensionEditor = useCallback(() => {
    setHouseFirstDimensionEditor(null);
    setHouseFirstDimensionPopoverPosition(null);
  }, []);

  const activateHouseFirstDimensionEditor = useCallback(
    (
      annotation: HouseFirstPlanPresetDimensionAnnotation | HouseFirstPlanCustomEdgeCandidate,
      target: SVGTextElement,
    ) => {
      void target;
      setFootprintError(null);
      setFieldError(null);
      setHouseFirstDimensionEditor({
        annotation,
        value: annotation.rawValue,
      });
    },
    [],
  );

  const handleHouseFirstShapeSelect = useCallback(
    (target: { ownerKind: 'footprint' | 'deck' | 'opening'; ownerId: string }) => {
      closeHouseFirstDimensionEditor();
      setHouseFirstActiveCustomEdgeId(null);
      if (!onSelectHouseFirstTarget) return;
      onSelectHouseFirstTarget(
        target.ownerKind === 'footprint'
          ? { kind: 'footprint', targetId: target.ownerId }
          : target.ownerKind === 'opening'
            ? { kind: 'opening', targetId: target.ownerId }
            : { kind: 'deck', targetId: target.ownerId },
      );
    },
    [closeHouseFirstDimensionEditor, onSelectHouseFirstTarget],
  );

  const handleHouseFirstCustomEdgeSelect = useCallback(
    (target: { ownerKind: 'footprint' | 'deck'; ownerId: string; edgeIndex: number }) => {
      closeHouseFirstDimensionEditor();
      setHouseFirstActiveCustomEdgeId(`${target.ownerId}:edge:${target.edgeIndex}`);
      onSelectHouseFirstTarget?.(
        target.ownerKind === 'footprint'
          ? { kind: 'footprint', targetId: target.ownerId }
          : { kind: 'deck', targetId: target.ownerId },
      );
    },
    [closeHouseFirstDimensionEditor, onSelectHouseFirstTarget],
  );

  const handleHouseFirstShapeDragStart = useCallback(
    (
      meta: HouseFirstPlanShapeDragStartMeta,
      event: { pointerId: number; clientX: number; clientY: number },
    ) => {
      const svg = footprintSvgRef.current;
      if (!svg) return;
      const startPoint = clientPointToSvg(svg, event.clientX, event.clientY);
      if (!startPoint) return;
      if (meta.ownerKind === 'deck') {
        if (!onCommitHouseFirstDeckDimension) return;
        const overlayShape = planViewModel?.houseFirst?.shapes.find(
          (shape) => shape.ownerKind === 'deck' && shape.ownerId === meta.ownerId,
        );
        if (!overlayShape?.deckInteraction) return;

        closeHouseFirstDimensionEditor();
        setFieldError(null);
        setFootprintError(null);
        setOpeningDragSession(null);
        setOpeningPreviewState(null);
        setDeckPreviewState(null);
        setDeckInteractionHint({
          title: 'Deck drag',
          detail: 'Drag the deck anywhere. It will magnetize to a house edge when you bring it close enough.',
          tone: 'status',
        });
        setDeckDragSession({
          pointerId: event.pointerId,
          deckId: meta.ownerId,
          startSvgX: startPoint.x,
          startSvgY: startPoint.y,
          startCenter: resolvePolygonCenter(overlayShape.polygon),
          startWidthM: overlayShape.deckInteraction.deckWidthM,
          startDepthM: overlayShape.deckInteraction.deckDepthM,
          interaction: overlayShape.deckInteraction,
          svgInteraction: meta.deckInteraction,
        });
        return;
      }

      if (!onCommitHouseFirstOpeningDimension) return;
      const overlayShape = planViewModel?.houseFirst?.shapes.find(
        (shape) => shape.ownerKind === 'opening' && shape.ownerId === meta.ownerId,
      );
      if (!overlayShape?.openingInteraction) return;

      closeHouseFirstDimensionEditor();
      setFieldError(null);
      setFootprintError(null);
      setDeckDragSession(null);
      setDeckPreviewState(null);
      setDeckInteractionHint(null);
      setOpeningPreviewState(null);
      setOpeningDragSession({
        pointerId: event.pointerId,
        openingId: meta.ownerId,
        startSvgX: startPoint.x,
        startSvgY: startPoint.y,
        startPolygon: overlayShape.polygon,
        startOffsetAlongWallM: overlayShape.openingInteraction.offsetAlongWallM,
        interaction: overlayShape.openingInteraction,
        svgInteraction: meta.openingInteraction,
      });
    },
    [
      closeHouseFirstDimensionEditor,
      onCommitHouseFirstDeckDimension,
      onCommitHouseFirstOpeningDimension,
      planViewModel,
    ],
  );

  const commitHouseFirstDimensionEdit = useCallback(
    async (editor: HouseFirstDimensionEditorState): Promise<boolean> => {
      const nextValue = editor.value.trim();
      const annotation = editor.annotation;
      const houseFootprintDimensionCommit = onCommitHouseFirstFootprintDimension ?? onCommitFootprintEdit;
      let result:
        | {
            ok: boolean;
            error?: string;
          }
        | undefined;

      if (annotation.targetKind === 'house_preset_param') {
        result = houseFootprintDimensionCommit
          ? await resolveCommitResult(
              houseFootprintDimensionCommit({
                type: 'param',
                key: annotation.fieldKey as keyof CalculatorHouseFootprintParams,
                value: nextValue,
              }),
            )
          : { ok: false, error: 'House footprint dimensions are not editable in this view.' };
      } else if (annotation.targetKind === 'house_custom_edge') {
        const polygon = resizeCustomPolygonEdge({
          polygon: annotation.localPolygon,
          edgeIndex: annotation.edgeIndex,
          nextLengthM: nextValue,
        });
        result = polygon
          ? houseFootprintDimensionCommit
            ? await resolveCommitResult(
                houseFootprintDimensionCommit({
                  type: 'polygon',
                  polygon,
                }),
              )
            : { ok: false, error: 'House footprint dimensions are not editable in this view.' }
          : { ok: false, error: 'Enter a positive edge length.' };
      } else if (annotation.targetKind === 'deck_preset_param') {
        result = onCommitHouseFirstDeckDimension
          ? await resolveCommitResult(
              onCommitHouseFirstDeckDimension(annotation.ownerId, {
                presetRect: {
                  [annotation.fieldKey]: nextValue,
                } as unknown as HouseFirstDeckDraft['presetRect'],
              }),
            )
          : { ok: false, error: 'Deck dimensions are not editable in this view.' };
      } else if (annotation.targetKind === 'deck_custom_edge') {
        const polygon = resizeCustomPolygonEdge({
          polygon: annotation.localPolygon,
          edgeIndex: annotation.edgeIndex,
          nextLengthM: nextValue,
        });
        result =
          polygon && onCommitHouseFirstDeckDimension
            ? await resolveCommitResult(
                onCommitHouseFirstDeckDimension(annotation.ownerId, {
                  shape: 'custom',
                  outline: polygon,
                }),
              )
            : { ok: false, error: polygon ? 'Deck dimensions are not editable in this view.' : 'Enter a positive edge length.' };
      } else if (annotation.targetKind === 'deck_host_edge_reference') {
        const resolvedRelationship =
          annotation.fieldKey === 'hostStartGapM' || annotation.fieldKey === 'hostEndGapM'
            ? resolveDeckHostReferenceCenterOffset({
                annotation,
                nextValue,
              })
            : annotation.fieldKey === 'crossEdgeGapM'
              ? resolveDeckCrossEdgeCenterOffset({
                  annotation,
                  nextValue,
                })
              : annotation.fieldKey === 'referenceEdgeGapM'
                ? { ok: true as const, centerOffsetM: '' }
                : { ok: false as const, error: 'Unsupported deck relationship dimension.' };
        result =
          resolvedRelationship.ok && onCommitHouseFirstDeckDimension
            ? await resolveCommitResult(
                onCommitHouseFirstDeckDimension(annotation.ownerId, {
                  ...(annotation.fieldKey === 'referenceEdgeGapM'
                    ? {
                        isAttached: false,
                        presetType: 'rect_detached',
                        presetRect: {
                          detachedGapM: nextValue,
                        } as unknown as HouseFirstDeckDraft['presetRect'],
                      }
                    : {
                        presetRect: {
                          centerOffsetM: resolvedRelationship.centerOffsetM,
                        } as unknown as HouseFirstDeckDraft['presetRect'],
                      }),
                }),
              )
            : {
                ok: false,
                error:
                  resolvedRelationship.ok
                    ? 'Deck dimensions are not editable in this view.'
                    : resolvedRelationship.error,
              };
      } else if (annotation.targetKind === 'opening_param') {
        result = onCommitHouseFirstOpeningDimension
          ? await resolveCommitResult(
              onCommitHouseFirstOpeningDimension(annotation.ownerId, {
                [annotation.fieldKey]: nextValue,
              } as Partial<HouseFirstOpeningDraft>),
            )
          : { ok: false, error: 'Opening dimensions are not editable in this view.' };
      } else {
        result = { ok: false, error: 'Unsupported dimension target.' };
      }

      if (!result?.ok) {
        setFieldError(result?.error ?? 'Unable to update the dimension.');
        return false;
      }

      setFieldError(null);
      setFootprintError(null);
      closeHouseFirstDimensionEditor();
      return true;
    },
    [
      closeHouseFirstDimensionEditor,
      onCommitFootprintEdit,
      onCommitHouseFirstDeckDimension,
      onCommitHouseFirstOpeningDimension,
      onCommitHouseFirstFootprintDimension,
    ],
  );

  const applyDrawOutlineTransition = useCallback((result: DrawOutlineTransitionResult) => {
    setDrawOutlineState(result.state);
    if (!isDrawOutlineActive(result.state)) {
      setDrawOutlineLandingPoint(null);
      drawOutlinePointerSessionRef.current = null;
      setDrawOutlinePointerSession(null);
    }
    if (result.error !== undefined) setFootprintError(result.error);
  }, []);

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

  const clearTouchNavigation = useCallback(() => {
    activeTouchPointersRef.current.clear();
    pinchZoomSessionRef.current = null;
    setActiveTouchCount(0);
    setPinchZoomActive(false);
    setPinchSource((current) => (current === 'touch-pointer' ? 'none' : current));
    setViewportNavigationGesture((current) => (current === 'pinch-zoom' ? 'idle' : current));
  }, []);

  const clearWebKitGestureNavigation = useCallback(() => {
    webKitGestureSessionRef.current = null;
    setPinchZoomActive(false);
    setPinchSource((current) => (current === 'webkit-gesture' ? 'none' : current));
    setViewportNavigationGesture((current) => (current === 'trackpad-pinch' ? 'idle' : current));
  }, []);

  const markTransientViewportGesture = useCallback((gesture: 'wheel-pan' | 'wheel-zoom', source: ModelSpacePinchSource = 'none') => {
    setViewportNavigationGesture(gesture);
    setPinchSource(source);
    if (wheelGestureIdleTimeoutRef.current !== null) {
      window.clearTimeout(wheelGestureIdleTimeoutRef.current);
    }
    wheelGestureIdleTimeoutRef.current = window.setTimeout(() => {
      wheelGestureIdleTimeoutRef.current = null;
      setViewportNavigationGesture((current) => (current === gesture ? 'idle' : current));
      setPinchSource((current) => (current === source ? 'none' : current));
    }, WHEEL_GESTURE_IDLE_MS);
  }, []);

  const resolveViewportAnchor = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const scroller = scrollerRef.current;
    if (!scroller) return null;
    const rect = scroller.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  const resolveViewportAnchorFromGestureEvent = useCallback((event: NativeGestureEvent): { x: number; y: number } | null => {
    const scroller = scrollerRef.current;
    if (!scroller) return null;
    const rect = scroller.getBoundingClientRect();
    if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
      return {
        x: Number(event.clientX) - rect.left,
        y: Number(event.clientY) - rect.top,
      };
    }
    const width = scroller.clientWidth || rect.width;
    const height = scroller.clientHeight || rect.height;
    return {
      x: Math.max(0, width / 2),
      y: Math.max(0, height / 2),
    };
  }, []);

  const applyAnchoredViewportZoom = useCallback(
    (input: {
      nextZoom: number;
      startZoom: number;
      startPanX: number;
      startPanY: number;
      startAnchorX: number;
      startAnchorY: number;
      currentAnchorX: number;
      currentAnchorY: number;
    }) => {
      const nextZoom = clampZoom(input.nextZoom);
      const safeStartZoom = Math.max(input.startZoom, 0.001);
      const contentAnchorX = (input.startAnchorX - input.startPanX) / safeStartZoom;
      const contentAnchorY = (input.startAnchorY - input.startPanY) / safeStartZoom;
      updateViewportTransform({
        zoom: nextZoom,
        panX: input.currentAnchorX - contentAnchorX * nextZoom,
        panY: input.currentAnchorY - contentAnchorY * nextZoom,
      });
    },
    [updateViewportTransform],
  );

  const handleZoomChange = useCallback(
    (delta: number) => {
      userAdjustedViewportRef.current = true;
      updateViewportTransform({ zoom: clampZoom(zoom + delta) });
    },
    [updateViewportTransform, zoom],
  );

  const measureFitViewTransform = useCallback((): DrawingWorkbenchViewportTransform | null => {
    const scroller = scrollerRef.current;
    const scaleFrame = scaleFrameRef.current;
    if (!scroller || !scaleFrame) return null;

    const scrollerRect = scroller.getBoundingClientRect();
    const frameRect = scaleFrame.getBoundingClientRect();
    const scrollerWidth = scroller.clientWidth || scrollerRect.width;
    const scrollerHeight = scroller.clientHeight || scrollerRect.height;
    if (scrollerWidth <= 0 || scrollerHeight <= 0) return null;

    const focusRect =
      resolveModelSpaceFocusTargetRect({ scaleFrame, frameRect, zoom }) ??
      resolveModelSpaceSvgFocusRect({ scaleFrame, frameRect, zoom });
    const svgRect = focusRect ? null : resolveModelSpaceSvgRect({ scaleFrame, frameRect, zoom });
    const frameWidth =
      scaleFrame.offsetWidth || scaleFrame.scrollWidth || (frameRect.width > 0 ? frameRect.width / Math.max(zoom, 0.001) : 0);
    const frameHeight =
      scaleFrame.offsetHeight || scaleFrame.scrollHeight || (frameRect.height > 0 ? frameRect.height / Math.max(zoom, 0.001) : 0);
    const frameFallback = frameWidth > 0 && frameHeight > 0 ? { x: 0, y: 0, width: frameWidth, height: frameHeight } : null;
    const targetRect = focusRect ?? svgRect ?? frameFallback;
    if (!targetRect) return null;

    const availableWidth = Math.max(1, scrollerWidth - FIT_VIEW_MARGIN_PX * 2);
    const availableHeight = Math.max(1, scrollerHeight - FIT_VIEW_MARGIN_PX * 2);
    const nextZoom = clampZoom(Math.min(availableWidth / targetRect.width, availableHeight / targetRect.height));
    return {
      zoom: nextZoom,
      panX: scrollerWidth / 2 - (targetRect.x + targetRect.width / 2) * nextZoom,
      panY: scrollerHeight / 2 - (targetRect.y + targetRect.height / 2) * nextZoom,
    };
  }, [zoom]);

  const fitViewportToContent = useCallback((): boolean => {
    const next = measureFitViewTransform();
    if (!next) return false;
    updateViewportTransform(next);
    return true;
  }, [measureFitViewTransform, updateViewportTransform]);

  const handleFitView = useCallback(() => {
    setFootprintError(null);
    setFieldError(null);
    setPanDragSession(null);
    clearTouchNavigation();
    clearWebKitGestureNavigation();
    userAdjustedViewportRef.current = false;
    if (fitViewportToContent()) {
      autoFitKeyRef.current = modelSpaceAutoFitKey;
    } else {
      updateViewportTransform({ zoom: 1, panX: 0, panY: 0 });
    }
  }, [clearTouchNavigation, clearWebKitGestureNavigation, fitViewportToContent, modelSpaceAutoFitKey, updateViewportTransform]);

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      if (isViewportNavigationControlTarget(event.target)) return;
      const delta = normalizeWheelDeltaPixels(event);
      if (delta.deltaX === 0 && delta.deltaY === 0) return;
      event.preventDefault();
      userAdjustedViewportRef.current = true;
      if (!event.ctrlKey && !event.metaKey) {
        markTransientViewportGesture('wheel-pan', 'none');
        updateViewportTransform({
          panX: viewportTransform.panX - delta.deltaX,
          panY: viewportTransform.panY - delta.deltaY,
        });
        return;
      }
      const anchor = resolveViewportAnchor(event.clientX, event.clientY);
      if (!anchor) return;
      const nextZoom = clampZoom(zoom * Math.exp(-delta.deltaY * WHEEL_ZOOM_SENSITIVITY));
      if (nextZoom === zoom) return;
      markTransientViewportGesture('wheel-zoom', 'wheel');
      applyAnchoredViewportZoom({
        nextZoom,
        startZoom: zoom,
        startPanX: viewportTransform.panX,
        startPanY: viewportTransform.panY,
        startAnchorX: anchor.x,
        startAnchorY: anchor.y,
        currentAnchorX: anchor.x,
        currentAnchorY: anchor.y,
      });
    },
    [
      applyAnchoredViewportZoom,
      markTransientViewportGesture,
      resolveViewportAnchor,
      updateViewportTransform,
      viewportTransform.panX,
      viewportTransform.panY,
      zoom,
    ],
  );

  const handleFootprintPresetSelect = useCallback(
    async (preset: NonNullable<ModulePlanModel['houseFootprintPreset']>) => {
      setFieldError(null);
      setFootprintHoveredHandleId(null);
      setFootprintActiveHandleId(null);
      setFootprintDragSession(null);
      setDrawOutlineLandingPoint(null);
      drawOutlinePointerSessionRef.current = null;
      setDrawOutlinePointerSession(null);
      setDrawOutlineState(createInactiveDrawOutlineState());
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
    setDrawOutlineLandingPoint(null);
    drawOutlinePointerSessionRef.current = null;
    setDrawOutlinePointerSession(null);
    applyDrawOutlineTransition(startDrawOutlineTool());
  }, [applyDrawOutlineTransition]);

  useEffect(() => {
    if (drawOutlineRequestId === undefined || drawOutlineRequestId <= 0 || drawOutlineRequestId === lastDrawOutlineRequestIdRef.current) return;
    lastDrawOutlineRequestIdRef.current = drawOutlineRequestId;
    if ((!canEditFootprint && !canCommitCustomPolygon) || view !== 'plan') return;
    startDrawOutlineSession();
  }, [canCommitCustomPolygon, canEditFootprint, drawOutlineRequestId, startDrawOutlineSession, view]);

  const handleFootprintModeSelect = useCallback(
    async (mode: NonNullable<Required<ModulePlanModel>['houseFootprintMode']>) => {
      setFieldError(null);
      setFootprintHoveredHandleId(null);
      setFootprintActiveHandleId(null);
      setFootprintDragSession(null);
      setFootprintVertexDragSession(null);
      setFootprintError(null);
      setDrawOutlineLandingPoint(null);
      drawOutlinePointerSessionRef.current = null;
      setDrawOutlinePointerSession(null);
      if (mode === 'custom_polygon') {
        startDrawOutlineSession();
        return;
      }
      setDrawOutlineState(createInactiveDrawOutlineState());
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
      setDrawOutlineLandingPoint(null);
      drawOutlinePointerSessionRef.current = null;
      setDrawOutlinePointerSession(null);
      setDrawOutlineState(createInactiveDrawOutlineState());
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
      setDrawOutlineLandingPoint(null);
      drawOutlinePointerSessionRef.current = null;
      setDrawOutlinePointerSession(null);
      setDrawOutlineState(createInactiveDrawOutlineState());
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
    (rawPoint: ModuleFootprintCanvasPoint) => {
      const point = {
        alongM: parsePolygonMetres(rawPoint.alongM),
        depthM: parsePolygonMetres(rawPoint.depthM),
      };
      if (!Number.isFinite(point.alongM) || !Number.isFinite(point.depthM)) return;
      setDrawOutlineLandingPoint(rawPoint);
      applyDrawOutlineTransition(selectDrawOutlinePoint(drawOutlineState, point));
    },
    [applyDrawOutlineTransition, drawOutlineState],
  );

  const handleDrawOutlineCanvasPointerDown = useCallback(
    (rawPoint: ModuleFootprintCanvasPoint, event: { pointerId: number; clientX: number; clientY: number }) => {
      if (!Number.isFinite(rawPoint.numericAlongM) || !Number.isFinite(rawPoint.numericDepthM)) return;
      const nextSession = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startPanX: viewportTransform.panX,
        startPanY: viewportTransform.panY,
        startPoint: rawPoint,
        hasPanned: false,
      };
      setDrawOutlineLandingPoint(rawPoint);
      drawOutlinePointerSessionRef.current = nextSession;
      setDrawOutlinePointerSession(nextSession);
    },
    [viewportTransform.panX, viewportTransform.panY],
  );

  const handleDrawOutlineConfirmSegment = useCallback(() => {
    applyDrawOutlineTransition(confirmDrawOutlineSegment(drawOutlineState));
  }, [applyDrawOutlineTransition, drawOutlineState]);

  const handleDrawOutlineUndo = useCallback(() => {
    applyDrawOutlineTransition(undoDrawOutline(drawOutlineState));
  }, [applyDrawOutlineTransition, drawOutlineState]);

  const handleDrawOutlineCancel = useCallback(() => {
    applyDrawOutlineTransition(cancelDrawOutlineTool());
  }, [applyDrawOutlineTransition]);

  const handleDrawOutlineClose = useCallback(async () => {
    const closeResult = prepareDrawOutlineClose(drawOutlineState);
    if (!closeResult.ok) {
      if (closeResult.error) setFootprintError(closeResult.error);
      return;
    }
    const result =
      deckOutlineMode && onCommitCustomPolygon
        ? await resolveCommitResult(onCommitCustomPolygon(closeResult.polygon))
        : await commitFootprintEdit({ type: 'custom_polygon', polygon: closeResult.polygon });
    if (result.ok) {
      applyDrawOutlineTransition(finishSuccessfulDrawOutlineCommit());
    }
  }, [applyDrawOutlineTransition, commitFootprintEdit, deckOutlineMode, drawOutlineState, onCommitCustomPolygon]);

  const handleDrawOutlinePointHover = useCallback(
    (rawPoint: ModuleFootprintCanvasPoint | null) => {
      if (!rawPoint) {
        setDrawOutlineLandingPoint(null);
        applyDrawOutlineTransition(hoverDrawOutlinePoint(drawOutlineState, null));
        return;
      }
      const point = {
        alongM: parsePolygonMetres(rawPoint.alongM),
        depthM: parsePolygonMetres(rawPoint.depthM),
      };
      if (
        !Number.isFinite(point.alongM) ||
        !Number.isFinite(point.depthM) ||
        !Number.isFinite(rawPoint.numericAlongM) ||
        !Number.isFinite(rawPoint.numericDepthM)
      ) {
        setDrawOutlineLandingPoint(null);
        applyDrawOutlineTransition(hoverDrawOutlinePoint(drawOutlineState, null));
        return;
      }
      setDrawOutlineLandingPoint(rawPoint);
      applyDrawOutlineTransition(hoverDrawOutlinePoint(drawOutlineState, point));
    },
    [applyDrawOutlineTransition, drawOutlineState],
  );

  const clearViewportEditSessions = useCallback(() => {
    setPanDragSession(null);
    setFootprintDragSession(null);
    setFootprintVertexDragSession(null);
    setFootprintActiveHandleId(null);
    setPlanFieldDragSession(null);
    setPlanActiveResizeFieldId(null);
  }, []);

  const startPinchZoomSessionFromActiveTouches = useCallback(() => {
    const pair = resolveTouchPointerPair(activeTouchPointersRef.current);
    const midpoint = pair ? resolveTouchMidpoint(pair[0], pair[1]) : null;
    const anchor = midpoint ? resolveViewportAnchor(midpoint.x, midpoint.y) : null;
    if (!pair || !anchor) return;
    const distance = resolveTouchDistance(pair[0], pair[1]);
    if (distance <= 0) return;
    pinchZoomSessionRef.current = {
      firstPointerId: pair[0].pointerId,
      secondPointerId: pair[1].pointerId,
      startMidpointX: anchor.x,
      startMidpointY: anchor.y,
      startDistance: distance,
      startZoom: zoom,
      startPanX: viewportTransform.panX,
      startPanY: viewportTransform.panY,
    };
    userAdjustedViewportRef.current = true;
    drawOutlinePointerSessionRef.current = null;
    setDrawOutlinePointerSession(null);
    setDrawOutlineState((current) => hoverDrawOutlinePoint(current, null).state);
    setPinchZoomActive(true);
    setPinchSource('touch-pointer');
    setViewportNavigationGesture('pinch-zoom');
  }, [resolveViewportAnchor, viewportTransform.panX, viewportTransform.panY, zoom]);

  const handleScrollerPointerDownCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === 'touch' && !isViewportNavigationControlTarget(event.target)) {
        activeTouchPointersRef.current.set(event.pointerId, {
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
        });
        setActiveTouchCount(activeTouchPointersRef.current.size);
        if (activeTouchPointersRef.current.size === 2 && !pinchZoomSessionRef.current) {
          event.preventDefault();
          event.stopPropagation();
          clearViewportEditSessions();
          startPinchZoomSessionFromActiveTouches();
          return;
        }
      }

      if (!isDrawOutlineActive(drawOutlineState) || event.button !== 0 || isViewportMousePanIgnoredTarget(event.target)) return;
      const point = drawOutlineCanvasPointResolverRef.current?.(event.clientX, event.clientY) ?? null;
      if (!point) {
        setDrawOutlineLandingPoint(null);
        return;
      }
      event.preventDefault();
      handleDrawOutlineCanvasPointerDown(point, {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      });
    },
    [clearViewportEditSessions, drawOutlineState, handleDrawOutlineCanvasPointerDown, startPinchZoomSessionFromActiveTouches],
  );

  const handleScrollerPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDrawOutlineActive(drawOutlineState) || isViewportMousePanIgnoredTarget(event.target)) return;
      if (drawOutlinePointerSessionRef.current?.hasPanned) return;
      handleDrawOutlinePointHover(drawOutlineCanvasPointResolverRef.current?.(event.clientX, event.clientY) ?? null);
    },
    [drawOutlineState, handleDrawOutlinePointHover],
  );

  const handleScrollerPointerLeave = useCallback(
    () => {
      if (!isDrawOutlineActive(drawOutlineState)) return;
      handleDrawOutlinePointHover(null);
    },
    [drawOutlineState, handleDrawOutlinePointHover],
  );

  const handleCanvasPanStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === 'touch') return;
      if ((event.button !== 0 && event.button !== 2) || isDrawOutlineActive(drawOutlineState)) return;
      if (isViewportMousePanIgnoredTarget(event.target)) return;
      event.preventDefault();
      userAdjustedViewportRef.current = true;
      setViewportNavigationGesture('mouse-pan');
      setPanDragSession({
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startPanX: viewportTransform.panX,
        startPanY: viewportTransform.panY,
      });
    },
    [drawOutlineState, viewportTransform.panX, viewportTransform.panY],
  );

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const shouldHandleGestureEvent = (event: Event): boolean => {
      if (isViewportNavigationControlTarget(event.target)) return false;
      return event.target instanceof Node ? scroller.contains(event.target) : true;
    };

    const handleGestureStart = (event: Event) => {
      if (!shouldHandleGestureEvent(event)) return;
      const gestureEvent = event as NativeGestureEvent;
      const anchor = resolveViewportAnchorFromGestureEvent(gestureEvent);
      if (!anchor) return;
      event.preventDefault();
      clearTouchNavigation();
      clearViewportEditSessions();
      webKitGestureSessionRef.current = {
        startAnchorX: anchor.x,
        startAnchorY: anchor.y,
        startZoom: zoom,
        startPanX: viewportTransform.panX,
        startPanY: viewportTransform.panY,
      };
      userAdjustedViewportRef.current = true;
      setPinchZoomActive(true);
      setPinchSource('webkit-gesture');
      setViewportNavigationGesture('trackpad-pinch');
    };

    const handleGestureChange = (event: Event) => {
      if (!shouldHandleGestureEvent(event)) return;
      const session = webKitGestureSessionRef.current;
      if (!session) return;
      const scale = Number((event as NativeGestureEvent).scale ?? 1);
      if (!Number.isFinite(scale) || scale <= 0) return;
      event.preventDefault();
      applyAnchoredViewportZoom({
        nextZoom: session.startZoom * scale,
        startZoom: session.startZoom,
        startPanX: session.startPanX,
        startPanY: session.startPanY,
        startAnchorX: session.startAnchorX,
        startAnchorY: session.startAnchorY,
        currentAnchorX: session.startAnchorX,
        currentAnchorY: session.startAnchorY,
      });
    };

    const handleGestureEnd = () => {
      clearWebKitGestureNavigation();
    };

    scroller.addEventListener('gesturestart', handleGestureStart);
    scroller.addEventListener('gesturechange', handleGestureChange);
    scroller.addEventListener('gestureend', handleGestureEnd);
    scroller.addEventListener('gesturecancel', handleGestureEnd);

    return () => {
      scroller.removeEventListener('gesturestart', handleGestureStart);
      scroller.removeEventListener('gesturechange', handleGestureChange);
      scroller.removeEventListener('gestureend', handleGestureEnd);
      scroller.removeEventListener('gesturecancel', handleGestureEnd);
    };
  }, [
    applyAnchoredViewportZoom,
    clearTouchNavigation,
    clearViewportEditSessions,
    clearWebKitGestureNavigation,
    resolveViewportAnchorFromGestureEvent,
    viewportTransform.panX,
    viewportTransform.panY,
    zoom,
  ]);

  useEffect(() => {
    userAdjustedViewportRef.current = false;
    autoFitKeyRef.current = autoFitOnReady ? null : modelSpaceAutoFitKey;
    clearTouchNavigation();
    clearWebKitGestureNavigation();
  }, [autoFitOnReady, clearTouchNavigation, clearWebKitGestureNavigation, modelSpaceAutoFitKey]);

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

  const drawOutlineActiveForPointerListeners = isDrawOutlineActive(drawOutlineState);

  useEffect(() => {
    if (!drawOutlineActiveForPointerListeners) return;

    const handlePointerMove = (event: PointerEvent) => {
      const session = drawOutlinePointerSessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      const deltaX = event.clientX - session.startClientX;
      const deltaY = event.clientY - session.startClientY;
      const distance = Math.hypot(deltaX, deltaY);
      if (distance < DRAW_OUTLINE_PAN_THRESHOLD_PX && !session.hasPanned) return;

      userAdjustedViewportRef.current = true;
      updateViewportTransform({
        panX: session.startPanX + deltaX,
        panY: session.startPanY + deltaY,
      });
      if (!session.hasPanned) {
        const nextSession = {
          ...session,
          hasPanned: true,
        };
        drawOutlinePointerSessionRef.current = nextSession;
        setDrawOutlinePointerSession(nextSession);
        setDrawOutlineState((current) => hoverDrawOutlinePoint(current, null).state);
      }
    };

    const handlePointerEnd = (event: PointerEvent) => {
      const latestSession = drawOutlinePointerSessionRef.current;
      if (!latestSession || event.pointerId !== latestSession.pointerId) return;
      const shouldSelect = event.type === 'pointerup' && !latestSession.hasPanned;
      const startPoint = latestSession.startPoint;
      drawOutlinePointerSessionRef.current = null;
      setDrawOutlinePointerSession(null);
      if (shouldSelect) handleDrawOutlinePointSelect(startPoint);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [drawOutlineActiveForPointerListeners, handleDrawOutlinePointSelect, updateViewportTransform]);

  useEffect(() => {
    if (activeTouchCount <= 0) return;

    const handlePointerMove = (event: PointerEvent) => {
      const current = activeTouchPointersRef.current.get(event.pointerId);
      if (!current) return;
      activeTouchPointersRef.current.set(event.pointerId, {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      });

      const session = pinchZoomSessionRef.current;
      if (!session) return;
      const first = activeTouchPointersRef.current.get(session.firstPointerId);
      const second = activeTouchPointersRef.current.get(session.secondPointerId);
      if (!first || !second) return;
      const distance = resolveTouchDistance(first, second);
      if (distance <= 0) return;
      const midpoint = resolveTouchMidpoint(first, second);
      const anchor = resolveViewportAnchor(midpoint.x, midpoint.y);
      if (!anchor) return;
      event.preventDefault();
      applyAnchoredViewportZoom({
        nextZoom: session.startZoom * (distance / Math.max(session.startDistance, 0.001)),
        startZoom: session.startZoom,
        startPanX: session.startPanX,
        startPanY: session.startPanY,
        startAnchorX: session.startMidpointX,
        startAnchorY: session.startMidpointY,
        currentAnchorX: anchor.x,
        currentAnchorY: anchor.y,
      });
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (!activeTouchPointersRef.current.has(event.pointerId)) return;
      const session = pinchZoomSessionRef.current;
      if (session && (event.pointerId === session.firstPointerId || event.pointerId === session.secondPointerId)) {
        clearTouchNavigation();
        return;
      }
      activeTouchPointersRef.current.delete(event.pointerId);
      setActiveTouchCount(activeTouchPointersRef.current.size);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [activeTouchCount, applyAnchoredViewportZoom, clearTouchNavigation, resolveViewportAnchor]);

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
      setViewportNavigationGesture((current) => (current === 'mouse-pan' ? 'idle' : current));
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
    if (!deckDragSession || !onCommitHouseFirstDeckDimension) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== deckDragSession.pointerId) return;
      const svg = footprintSvgRef.current;
      if (!svg) return;
      const nextPoint = clientPointToSvg(svg, event.clientX, event.clientY);
      if (!nextPoint) return;
      const preview = resolveDeckPreviewState({
        session: deckDragSession,
        nextSvgX: nextPoint.x,
        nextSvgY: nextPoint.y,
        previousPreviewState: deckPreviewState,
      });
      setDeckPreviewState(preview);
      setDeckInteractionHint({
        title: preview.snapped ? 'Snap preview' : 'Free placement',
        detail: preview.snapped
          ? 'Release to snap the deck to the house edge.'
          : 'Release to keep this deck free in space.',
        tone: 'status',
      });
    };

    const finishDrag = async (event: PointerEvent) => {
      if (event.pointerId !== deckDragSession.pointerId) return;
      const preview = deckPreviewState;
      setDeckDragSession(null);
      setDeckPreviewState(null);
      if (!preview) return;

      const result = await resolveCommitResult(
        onCommitHouseFirstDeckDimension(deckDragSession.deckId, {
          hostEdgeId: preview.hostEdgeId,
          isAttached: preview.placement === 'snapped',
          presetType: preview.placement === 'snapped' ? 'rect_attached' : 'rect_detached',
          ...(preview.placement === 'snapped' && deckDragSession.interaction.placement === 'free'
            ? { elevationMode: 'aligned_to_threshold' as const }
            : preview.placement === 'free' && deckDragSession.interaction.placement === 'snapped'
              ? { elevationMode: 'ground' as const }
              : null),
          presetRect: {
            centerOffsetM: formatDeckPresetValue(preview.centerOffsetM),
            detachedGapM: preview.placement === 'free' ? formatDeckPresetValue(preview.referenceEdgeGapM) : null,
          } as unknown as HouseFirstDeckDraft['presetRect'],
        }),
      );
      setFieldError(result.ok ? null : result.error ?? 'Unable to update the deck position.');
      if (result.ok) setFootprintError(null);
      setDeckInteractionHint(
        result.ok
          ? {
              title: preview.snapped ? 'Deck snapped' : 'Deck moved',
              detail: preview.snapped
                ? 'The deck is now snapped to the selected house edge.'
                : 'The deck stayed free in space with witness dimensions.',
              tone: 'status',
            }
          : {
              title: 'Deck move blocked',
              detail: result.error ?? 'Unable to update the deck position.',
              tone: 'deferred',
            },
      );
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };
  }, [deckDragSession, deckPreviewState, onCommitHouseFirstDeckDimension]);

  useEffect(() => {
    if (!openingDragSession || !onCommitHouseFirstOpeningDimension) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== openingDragSession.pointerId) return;
      const svg = footprintSvgRef.current;
      if (!svg) return;
      const nextPoint = clientPointToSvg(svg, event.clientX, event.clientY);
      if (!nextPoint) return;
      const preview = resolveOpeningPreviewState({
        session: openingDragSession,
        nextSvgX: nextPoint.x,
        nextSvgY: nextPoint.y,
      });
      setOpeningPreviewState(preview);
    };

    const finishDrag = async (event: PointerEvent) => {
      if (event.pointerId !== openingDragSession.pointerId) return;
      const preview = openingPreviewState;
      setOpeningDragSession(null);
      setOpeningPreviewState(null);
      if (!preview) return;

      const result = await resolveCommitResult(
        onCommitHouseFirstOpeningDimension(openingDragSession.openingId, {
          offsetAlongWallM: formatDeckPresetValue(preview.offsetAlongWallM),
        }),
      );
      setFieldError(result.ok ? null : result.error ?? 'Unable to update the window position.');
      if (result.ok) setFootprintError(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };
  }, [onCommitHouseFirstOpeningDimension, openingDragSession, openingPreviewState]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isDrawOutlineActive(drawOutlineState) && event.key === 'Enter') {
        event.preventDefault();
        handleDrawOutlineConfirmSegment();
        return;
      }
      if (isDrawOutlineActive(drawOutlineState) && event.key === 'Backspace') {
        event.preventDefault();
        handleDrawOutlineUndo();
        return;
      }
      if (event.key !== 'Escape') return;
      if (isDrawOutlineActive(drawOutlineState)) {
        event.preventDefault();
        handleDrawOutlineCancel();
        return;
      }
      if (deckDragSession) {
        event.preventDefault();
        setDeckDragSession(null);
        setDeckPreviewState(null);
        return;
      }
      if (openingDragSession) {
        event.preventDefault();
        setOpeningDragSession(null);
        setOpeningPreviewState(null);
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
  }, [
    deckDragSession,
    drawOutlineState,
    handleDrawOutlineCancel,
    handleDrawOutlineConfirmSegment,
    handleDrawOutlineUndo,
    openingDragSession,
  ]);

  const drawOutlineViewModel = useMemo(
    () => deriveDrawOutlineViewModel(drawOutlineState, Boolean(isDrawOutlineActive(drawOutlineState) && interactionError)),
    [drawOutlineState, interactionError],
  );
  const activeDrawOutlineState = drawOutlineViewModel.activeState;
  const drawOutlinePendingPoint = drawOutlineViewModel.pendingPoint;
  const drawOutlinePreviewPointKind = drawOutlineViewModel.previewPointKind;
  const drawOutlineConfirmedPointCount = drawOutlineViewModel.confirmedPointCount;
  const drawOutlineCloseReady = drawOutlineViewModel.closeReady;
  const drawOutlineCloseHovered = drawOutlineViewModel.closeHovered;
  const drawOutlinePopoverAnchorPointCount = drawOutlineViewModel.popoverAnchorPointCount;
  const drawOutlinePreviewPolygon = drawOutlineViewModel.previewPolygon;
  const activeDrawOutlineLandingPoint = drawOutlineViewModel.isActive ? drawOutlineLandingPoint : null;
  const drawOutlineGesture = drawOutlinePointerSession
    ? drawOutlinePointerSession.hasPanned
      ? 'panning'
      : 'click-candidate'
    : 'idle';
  const modelSpaceGesture: ModelSpaceGesture =
    drawOutlineGesture === 'click-candidate'
      ? 'draw-click-candidate'
      : drawOutlineGesture === 'panning'
        ? 'draw-panning'
        : pinchZoomActive
          ? pinchSource === 'webkit-gesture'
            ? 'trackpad-pinch'
            : 'pinch-zoom'
          : panDragSession
            ? 'mouse-pan'
            : viewportNavigationGesture;
  const drawOutlineHasError = drawOutlineViewModel.diagnosticState === 'error';
  const drawOutlineDiagnosticState = drawOutlineViewModel.diagnosticState;
  const drawOutlineStatusCopy = drawOutlineStatusText(drawOutlineDiagnosticState);
  const isCustomPolygonFootprint = view === 'plan' && (planModel?.houseFootprintMode ?? 'preset') === 'custom_polygon';
  const hasExistingCustomPolygon = isCustomPolygonFootprint && (planModel?.houseFootprintPolygon?.length ?? 0) >= 3;
  const hasDeckSeedPolygon = deckOutlineMode && (drawOutlineSeedPolygon?.length ?? 0) >= 3;
  const canRedrawDrawOutline =
    ((canEditFootprint && hasExistingCustomPolygon) || (canCommitCustomPolygon && hasDeckSeedPolygon)) &&
    !drawOutlineViewModel.isActive;
  const drawOutlineRedrawActive = drawOutlineViewModel.isActive && (hasExistingCustomPolygon || hasDeckSeedPolygon);
  const drawOutlineDraftSource = drawOutlineViewModel.isActive ? 'active-draft' : planModel?.houseConnectionType === 'none' ? 'none' : 'persisted';

  const handleDrawOutlineRedraw = useCallback(() => {
    if (!canRedrawDrawOutline) return;
    startDrawOutlineSession();
  }, [canRedrawDrawOutline, startDrawOutlineSession]);

  useEffect(() => {
    if (!drawOutlineViewModel.isActive && drawOutlineLandingPoint) setDrawOutlineLandingPoint(null);
  }, [drawOutlineLandingPoint, drawOutlineViewModel.isActive]);

  useEffect(() => {
    if (!autoFitOnReady) return;
    if (!modelSpaceAutoFitReady) return;
    if (autoFitKeyRef.current === modelSpaceAutoFitKey) return;
    if (fitViewportToContent()) autoFitKeyRef.current = modelSpaceAutoFitKey;
  }, [autoFitOnReady, fitViewportToContent, modelSpaceAutoFitKey, modelSpaceAutoFitReady]);

  useEffect(() => {
    if (!drawOutlineViewModel.isActive) {
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
  }, [drawOutlinePopoverAnchorPointCount, drawOutlineViewModel.isActive, viewportTransform.panX, viewportTransform.panY, zoom]);

  const houseFirstPlanOverlay =
    view === 'plan' && !drawOutlineViewModel.isActive ? planViewModel?.houseFirst ?? null : null;
  const houseFirstPreviewOverlay = useMemo(
    () =>
      deckPreviewState && deckDragSession
        ? {
            ownerId: deckPreviewState.deckId,
            polygon: deckPreviewState.polygon,
            hostEdge: {
              start: deckPreviewState.hostEdgeStart,
              end: deckPreviewState.hostEdgeEnd,
              snapped: deckPreviewState.snapped,
            },
          }
        : openingPreviewState && openingDragSession
          ? {
              ownerId: openingPreviewState.openingId,
              polygon: openingPreviewState.polygon,
              hostEdge: {
                start: openingDragSession.interaction.hostEdgeStart,
                end: openingDragSession.interaction.hostEdgeEnd,
                snapped: false,
              },
            }
        : null,
    [deckDragSession, deckPreviewState, openingDragSession, openingPreviewState],
  );
  const selectedDeckShape = useMemo(
    () =>
      houseFirstPlanOverlay?.shapes.find(
        (shape) => shape.ownerKind === 'deck' && shape.selected,
      ) ?? null,
    [houseFirstPlanOverlay],
  );
  const selectedOpeningShape = useMemo(
    () =>
      houseFirstPlanOverlay?.shapes.find(
        (shape) => shape.ownerKind === 'opening' && shape.selected,
      ) ?? null,
    [houseFirstPlanOverlay],
  );
  const selectedDeckRelationshipDimensionsAvailable = useMemo(
    () =>
      selectedDeckShape
        ? (houseFirstPlanOverlay?.presetAnnotations ?? []).some(
            (annotation) =>
              annotation.ownerKind === 'deck' &&
              annotation.ownerId === selectedDeckShape.ownerId &&
              annotation.targetKind === 'deck_host_edge_reference',
          )
        : false,
    [houseFirstPlanOverlay, selectedDeckShape],
  );
  const selectedDeckId = selectedDeckShape?.ownerId ?? null;
  const selectedDeckType = useMemo<DeckInteractionTelemetry['selectedDeckType']>(() => {
    if (!selectedDeckShape) return 'none';
    if (selectedDeckShape.custom) return 'custom_outline';
    if (selectedDeckShape.deckInteraction) {
      return selectedDeckShape.deckInteraction.placement === 'snapped' ? 'preset_snapped' : 'preset_free';
    }
    return 'preset_unresolved';
  }, [houseFirstPlanOverlay, selectedDeckShape]);

  useEffect(() => {
    setDeckInteractionHint(null);
  }, [selectedDeckId]);

  useEffect(() => {
    if (deckDragSession || deckPreviewState) {
      return;
    }
    if (!selectedDeckShape?.deckDragEligibility) {
      setDeckInteractionHint((current) => (current === null ? current : null));
      return;
    }
    const nextHint: DeckInteractionHintState = {
      title:
        selectedDeckShape.deckDragEligibility.eligible
          ? selectedDeckType === 'preset_free'
            ? 'Free preset deck'
            : 'Snapped preset deck'
          : selectedDeckType === 'custom_outline'
            ? 'Custom deck'
            : selectedDeckType === 'preset_free'
              ? 'Free preset deck'
              : 'Deck interaction',
      detail: selectedDeckShape.deckDragEligibility.reason,
      tone: selectedDeckShape.deckDragEligibility.eligible ? 'eligible' : 'deferred',
    };
    setDeckInteractionHint((current) =>
      current?.tone === 'status'
        ? current
        : current &&
            current.title === nextHint.title &&
            current.detail === nextHint.detail &&
            current.tone === nextHint.tone
          ? current
          : nextHint,
    );
  }, [deckDragSession, deckPreviewState, selectedDeckShape?.deckDragEligibility, selectedDeckType, selectedDeckId]);

  useEffect(() => {
    const telemetry = {
      selectedDeckId: selectedDeckShape?.ownerId ?? null,
      housePolygonSource: houseFirstPlanOverlay?.housePolygonSource ?? null,
      selectedDeckType,
      dragEligible: selectedDeckShape?.deckDragEligibility?.eligible ?? false,
      dragReason: selectedDeckShape?.deckDragEligibility?.reason ?? null,
      hostEdgeResolvable: Boolean(selectedDeckShape?.deckInteraction),
      relationshipDimensionsAvailable: selectedDeckRelationshipDimensionsAvailable,
      snapState: deckPreviewState ? (deckPreviewState.snapped ? 'snapped' : 'free') : 'idle',
      snapMessage:
        deckPreviewState && selectedDeckShape?.deckDragEligibility?.eligible
          ? deckPreviewState.snapped
            ? 'Snap preview active on the host edge limit.'
            : 'Free placement preview. Release to keep the current offset.'
          : null,
    } satisfies DeckInteractionTelemetry;
    const signature = [
      telemetry.selectedDeckId ?? '',
      telemetry.housePolygonSource ?? '',
      telemetry.selectedDeckType,
      telemetry.dragEligible ? '1' : '0',
      telemetry.dragReason ?? '',
      telemetry.hostEdgeResolvable ? '1' : '0',
      telemetry.relationshipDimensionsAvailable ? '1' : '0',
      telemetry.snapState,
      telemetry.snapMessage ?? '',
    ].join('|');
    if (lastDeckTelemetrySignatureRef.current === signature) {
      return;
    }
    lastDeckTelemetrySignatureRef.current = signature;
    onDeckInteractionTelemetryChange?.(telemetry);
  }, [
    deckPreviewState,
    houseFirstPlanOverlay?.housePolygonSource,
    onDeckInteractionTelemetryChange,
    selectedDeckRelationshipDimensionsAvailable,
    selectedDeckShape,
    selectedDeckType,
  ]);

  const handleNativeSelectionCapture = useCallback((event: Event) => {
    blockNativeSelectionEvent(event);
  }, []);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const handleSelectStart = (event: Event) => handleNativeSelectionCapture(event);
    const handleDragStart = (event: Event) => handleNativeSelectionCapture(event);
    node.addEventListener('selectstart', handleSelectStart, true);
    node.addEventListener('dragstart', handleDragStart, true);
    return () => {
      node.removeEventListener('selectstart', handleSelectStart, true);
      node.removeEventListener('dragstart', handleDragStart, true);
    };
  }, [handleNativeSelectionCapture]);

  useEffect(() => {
    if (!houseFirstPlanOverlay?.customEdgeCandidates.some((candidate) => candidate.id === houseFirstActiveCustomEdgeId)) {
      setHouseFirstActiveCustomEdgeId(null);
    }
  }, [houseFirstActiveCustomEdgeId, houseFirstPlanOverlay]);

  useEffect(() => {
    const selectedDeckStillVisible =
      deckDragSession &&
      houseFirstPlanOverlay?.shapes.some(
        (shape) => shape.ownerKind === 'deck' && shape.ownerId === deckDragSession.deckId && shape.selected,
      );
    if (!selectedDeckStillVisible) {
      setDeckDragSession(null);
      setDeckPreviewState(null);
    }
  }, [deckDragSession, houseFirstPlanOverlay]);

  useEffect(() => {
    const selectedOpeningStillVisible =
      openingDragSession &&
      houseFirstPlanOverlay?.shapes.some(
        (shape) => shape.ownerKind === 'opening' && shape.ownerId === openingDragSession.openingId && shape.selected,
      );
    if (!selectedOpeningStillVisible) {
      setOpeningDragSession(null);
      setOpeningPreviewState(null);
    }
  }, [houseFirstPlanOverlay, openingDragSession]);

  useEffect(() => {
    if (!houseFirstDimensionEditor) return;
    const annotationId = houseFirstDimensionEditor.annotation.id;
    const stillVisible = Boolean(
      houseFirstPlanOverlay?.presetAnnotations.some((annotation) => annotation.id === annotationId) ||
        houseFirstPlanOverlay?.customEdgeCandidates.some((annotation) => annotation.id === annotationId),
    );
    if (!stillVisible) closeHouseFirstDimensionEditor();
  }, [closeHouseFirstDimensionEditor, houseFirstDimensionEditor, houseFirstPlanOverlay]);

  useEffect(() => {
    const annotation = houseFirstDimensionEditor?.annotation;
    const scroller = scrollerRef.current;
    const popover = dimensionPopoverRef.current;
    if (!annotation || !scroller || !popover) {
      setHouseFirstDimensionPopoverPosition(null);
      return;
    }

    const escapedId =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(annotation.id)
        : annotation.id.replace(/"/g, '\\"');
    const target = scroller.querySelector(
      `[data-editable-field-id="${escapedId}"]`,
    ) as SVGGraphicsElement | null;
    if (!target) {
      setHouseFirstDimensionPopoverPosition(null);
      return;
    }

    const scrollerRect = scroller.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const scrollerWidth = scroller.clientWidth || scrollerRect.width;
    const scrollerHeight = scroller.clientHeight || scrollerRect.height;
    const popoverWidth = popover.offsetWidth || popoverRect.width;
    const popoverHeight = popover.offsetHeight || popoverRect.height;
    if (scrollerWidth <= 0 || scrollerHeight <= 0 || popoverWidth <= 0 || popoverHeight <= 0) {
      setHouseFirstDimensionPopoverPosition(null);
      return;
    }

    const anchorLeft = targetRect.left - scrollerRect.left;
    const anchorRight = targetRect.right - scrollerRect.left;
    const anchorCenterY = targetRect.top - scrollerRect.top + targetRect.height / 2;
    let left = anchorRight + DRAW_POPOVER_GAP_PX;
    let top = anchorCenterY - popoverHeight / 2;
    if (left + popoverWidth + DRAW_POPOVER_MARGIN_PX > scrollerWidth) {
      left = anchorLeft - popoverWidth - DRAW_POPOVER_GAP_PX;
    }
    if (left < DRAW_POPOVER_MARGIN_PX) {
      left = Math.min(
        Math.max(anchorRight + DRAW_POPOVER_GAP_PX, DRAW_POPOVER_MARGIN_PX),
        scrollerWidth - popoverWidth - DRAW_POPOVER_MARGIN_PX,
      );
    }
    left = Math.max(DRAW_POPOVER_MARGIN_PX, Math.min(left, scrollerWidth - popoverWidth - DRAW_POPOVER_MARGIN_PX));
    top = Math.max(DRAW_POPOVER_MARGIN_PX, Math.min(top, scrollerHeight - popoverHeight - DRAW_POPOVER_MARGIN_PX));
    setHouseFirstDimensionPopoverPosition({ left, top });
  }, [houseFirstDimensionEditor, viewportTransform.panX, viewportTransform.panY, zoom]);

  const houseFirstDimensionPopoverStyle = useMemo(
    () =>
      houseFirstDimensionPopoverPosition
        ? {
            left: `${houseFirstDimensionPopoverPosition.left}px`,
            top: `${houseFirstDimensionPopoverPosition.top}px`,
          }
        : undefined,
    [houseFirstDimensionPopoverPosition],
  );

  const footprintEditor = useMemo<ModuleFootprintEditorProps | undefined>(() => {
    if (!canEditFootprint && !canRotatePlan && !deckOutlineMode) return undefined;
    const customPolygonOverride =
      deckOutlineMode && !drawOutlineViewModel.isActive
        ? drawOutlineSeedPolygon ?? []
        : drawOutlinePreviewPolygon;
    return {
      available: canEditFootprint || deckOutlineMode,
      surface: 'model',
      isEditing: true,
      allowAttachmentSideCanvasSelect: false,
      allowResizeEdgeDrag: false,
      customPolygonOverride,
      customPolygonOpen: drawOutlineViewModel.isActive,
      customPolygonConfirmedPointCount: drawOutlineConfirmedPointCount,
      customPolygonPreviewPointKind: drawOutlinePreviewPointKind,
      customPolygonCloseReady: drawOutlineCloseReady,
      customPolygonCloseHovered: drawOutlineCloseHovered,
      customPolygonLandingPoint: activeDrawOutlineLandingPoint,
      customPolygonHasError: drawOutlineHasError,
      hideHouseFootprint: deckOutlineMode ? false : drawOutlineViewModel.hideHouseFootprint,
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
      onHandleDragStart: deckOutlineMode ? () => undefined : handleFootprintDragStart,
      onVertexDragStart: deckOutlineMode ? undefined : handleFootprintVertexDragStart,
      onVertexDelete: deckOutlineMode ? undefined : (vertexIndex) => void handleFootprintVertexDelete(vertexIndex),
      onEdgeAdd: deckOutlineMode ? undefined : (edgeIndex) => void handleFootprintEdgeAdd(edgeIndex),
      onPresetSelect: deckOutlineMode ? () => undefined : (preset) => void handleFootprintPresetSelect(preset),
      onModeSelect: deckOutlineMode ? undefined : (mode) => void handleFootprintModeSelect(mode),
      onRotate: deckOutlineMode ? () => undefined : (delta) => void handleFootprintRotate(delta),
      onCanvasPointSelect: undefined,
      onCanvasPointPointerDown: undefined,
      onCanvasPointHover: undefined,
      onCanvasPointResolverChange: (resolver) => {
        drawOutlineCanvasPointResolverRef.current = resolver;
      },
      onCloseStartSelect: drawOutlineViewModel.isActive ? () => void handleDrawOutlineClose() : undefined,
      onSvgMount: (node) => {
        footprintSvgRef.current = node;
      },
    };
  }, [
    canCommitCustomPolygon,
    canEditFootprint,
    canRotatePlan,
    deckOutlineMode,
    drawOutlineCloseHovered,
    drawOutlineCloseReady,
    drawOutlineConfirmedPointCount,
    drawOutlineHasError,
    activeDrawOutlineLandingPoint,
    drawOutlinePreviewPointKind,
    drawOutlinePreviewPolygon,
    drawOutlineSeedPolygon,
    drawOutlineViewModel.hideHouseFootprint,
    drawOutlineViewModel.isActive,
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

  return (
    <section className={styles.viewport} aria-label={`${view === 'plan' ? 'Plan' : 'Section'} model space viewport`} style={moduleDrawingThemeCssVariables('model')}>
      <div
        ref={scrollerRef}
        data-model-space-scroller
        data-draw-outline-active={drawOutlineViewModel.isActive ? 'true' : 'false'}
        data-draw-outline-state={drawOutlineDiagnosticState}
        data-draw-outline-point-count={drawOutlineConfirmedPointCount}
        data-draw-outline-has-pending-point={drawOutlinePendingPoint ? 'true' : 'false'}
        data-draw-outline-preview-kind={drawOutlinePreviewPointKind ?? 'none'}
        data-draw-outline-close-ready={drawOutlineCloseReady ? 'true' : 'false'}
        data-draw-outline-close-hovered={drawOutlineCloseHovered ? 'true' : 'false'}
        data-draw-outline-has-landing-point={activeDrawOutlineLandingPoint ? 'true' : 'false'}
        data-draw-outline-landing-along-m={activeDrawOutlineLandingPoint?.alongM ?? ''}
        data-draw-outline-landing-depth-m={activeDrawOutlineLandingPoint?.depthM ?? ''}
        data-draw-outline-gesture={drawOutlineGesture}
        data-draw-outline-pan-threshold-px={DRAW_OUTLINE_PAN_THRESHOLD_PX}
        data-draw-outline-angle-mode={drawOutlineViewModel.angleMode}
        data-draw-outline-has-error={drawOutlineHasError ? 'true' : 'false'}
        data-draw-outline-can-redraw={canRedrawDrawOutline ? 'true' : 'false'}
        data-draw-outline-redraw-active={drawOutlineRedrawActive ? 'true' : 'false'}
        data-draw-outline-draft-source={drawOutlineDraftSource}
        data-model-space-gesture={modelSpaceGesture}
        data-model-space-active-touch-count={activeTouchCount}
        data-model-space-pinch-active={pinchZoomActive ? 'true' : 'false'}
        data-model-space-pinch-source={pinchSource}
        data-model-space-auto-fit-key={modelSpaceAutoFitKey}
        data-model-space-auto-fit-ready={modelSpaceAutoFitReady ? 'true' : 'false'}
        data-house-first-deck-drag-active={deckDragSession ? 'true' : 'false'}
        data-house-first-deck-snap-state={deckPreviewState ? (deckPreviewState.snapped ? 'snapped' : 'free') : 'idle'}
        data-house-first-opening-drag-active={openingDragSession ? 'true' : 'false'}
        data-house-first-selected-deck-id={selectedDeckShape?.ownerId ?? ''}
        data-house-first-selected-deck-type={selectedDeckType}
        data-house-first-selected-deck-drag-eligible={
          selectedDeckShape?.deckDragEligibility?.eligible ? 'true' : 'false'
        }
        data-house-first-selected-deck-host-edge-resolvable={
          selectedDeckShape?.deckInteraction ? 'true' : 'false'
        }
        data-house-first-selected-deck-relationship-dims={
          selectedDeckRelationshipDimensionsAvailable ? 'true' : 'false'
        }
        data-house-first-selected-deck-drag-reason={
          selectedDeckShape?.deckDragEligibility?.reason ?? ''
        }
        data-house-first-selected-opening-id={selectedOpeningShape?.ownerId ?? ''}
        data-house-first-selected-opening-drag-eligible={
          selectedOpeningShape?.openingDragEligibility?.eligible ? 'true' : 'false'
        }
        data-house-first-selected-opening-drag-reason={
          selectedOpeningShape?.openingDragEligibility?.reason ?? ''
        }
        data-native-selection-suppressed="true"
        className={`${styles.scroller} ${
          modelSpaceGesture === 'mouse-pan' || modelSpaceGesture === 'pinch-zoom' || modelSpaceGesture === 'trackpad-pinch'
            ? styles.scrollerPanning
            : ''
        }`}
        onPointerDownCapture={handleScrollerPointerDownCapture}
        onPointerMove={handleScrollerPointerMove}
        onPointerLeave={handleScrollerPointerLeave}
        onPointerDown={handleCanvasPanStart}
        onWheel={handleWheel}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div className={styles.canvasControls} onPointerDown={(event) => event.stopPropagation()}>
          <button type="button" className={styles.overlayButton} onClick={() => handleZoomChange(-0.1)}>
            -
          </button>
          <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
          <button type="button" className={styles.overlayButton} onClick={() => handleZoomChange(0.1)}>
            +
          </button>
          <button type="button" className={styles.overlayButton} onClick={handleFitView}>
            Fit view
          </button>
        </div>

        {canRedrawDrawOutline ? (
          <div className={styles.drawRedrawBar} data-draw-outline-redraw-entry="true" onPointerDown={(event) => event.stopPropagation()}>
            <button type="button" className={styles.overlayButton} onClick={handleDrawOutlineRedraw}>
              Redraw outline
            </button>
          </div>
        ) : null}

        {drawOutlineViewModel.isActive ? (
          <div
            className={styles.drawStatus}
            aria-label="Draw outline status"
            data-draw-outline-status="true"
            data-draw-outline-status-state={drawOutlineDiagnosticState}
          >
            <span className={styles.drawStatusText}>{drawOutlineStatusCopy}</span>
            <span className={styles.drawStatusMeta}>Esc cancels</span>
          </div>
        ) : null}

        {!drawOutlineViewModel.isActive && deckInteractionHint ? (
          <div
            className={[
              styles.deckInteractionHint,
              deckInteractionHint.tone === 'eligible'
                ? styles.deckInteractionHintEligible
                : deckInteractionHint.tone === 'deferred'
                  ? styles.deckInteractionHintDeferred
                  : styles.deckInteractionHintStatus,
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label="Deck interaction hint"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <span className={styles.deckInteractionHintTitle}>{deckInteractionHint.title}</span>
            <span className={styles.deckInteractionHintText}>{deckInteractionHint.detail}</span>
          </div>
        ) : null}

        {interactionError ? <p className={styles.error}>{interactionError}</p> : null}

        {activeDrawOutlineState ? (
          <div
            ref={drawPopoverRef}
            className={styles.drawPopover}
            aria-label="Draw house outline controls"
            data-draw-outline-controls="true"
            data-draw-popover-anchor={drawPopoverPosition ? 'vertex' : 'default'}
            style={drawPopoverStyle}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <p className={styles.drawHint}>
              {activeDrawOutlineState.points.length
                ? `${activeDrawOutlineState.points.length} point${activeDrawOutlineState.points.length === 1 ? '' : 's'} placed`
                : 'Click first corner'}
            </p>
            <label className={styles.popoverField}>
              <span className={styles.fieldLabel}>Distance (m)</span>
              <input
                className={styles.input}
                inputMode="decimal"
                value={activeDrawOutlineState.distanceDraft}
                disabled={!activeDrawOutlineState.points.length}
                onChange={(event) =>
                  setDrawOutlineState((current) => setDrawOutlineDistanceDraft(current, event.target.value).state)
                }
              />
            </label>
            <label className={styles.popoverField}>
              <span className={styles.fieldLabel}>Angle (deg)</span>
              <input
                className={styles.input}
                inputMode="decimal"
                value={activeDrawOutlineState.angleDraft}
                disabled={!activeDrawOutlineState.points.length}
                onChange={(event) =>
                  setDrawOutlineState((current) => setDrawOutlineAngleDraft(current, event.target.value).state)
                }
              />
            </label>
            <button type="button" className={styles.confirmButton} onClick={handleDrawOutlineConfirmSegment} disabled={!activeDrawOutlineState.points.length}>
              Confirm
            </button>
            <div className={styles.drawActions}>
              <button type="button" className={styles.overlayButton} onClick={handleDrawOutlineClose}>
                Close
              </button>
              <button type="button" className={styles.overlayButton} onClick={handleDrawOutlineUndo} disabled={!activeDrawOutlineState.points.length}>
                Undo
              </button>
              <button type="button" className={styles.overlayButton} onClick={handleDrawOutlineCancel}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {houseFirstDimensionEditor ? (
          <div
            ref={dimensionPopoverRef}
            className={styles.dimensionPopover}
            aria-label="Edit plan dimension"
            style={houseFirstDimensionPopoverStyle}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <label className={styles.popoverField}>
              <span className={styles.fieldLabel}>Dimension (m)</span>
              <input
                autoFocus
                className={styles.input}
                inputMode="decimal"
                value={houseFirstDimensionEditor.value}
                onChange={(event) =>
                  setHouseFirstDimensionEditor((current) =>
                    current
                      ? {
                          ...current,
                          value: event.target.value,
                        }
                      : current,
                  )
                }
                onBlur={() => {
                  if (!houseFirstDimensionEditor) return;
                  void commitHouseFirstDimensionEdit(houseFirstDimensionEditor);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    closeHouseFirstDimensionEditor();
                    return;
                  }
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  if (!houseFirstDimensionEditor) return;
                  void commitHouseFirstDimensionEdit(houseFirstDimensionEditor);
                }}
              />
            </label>
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
                displayMode={workbenchDisplayMode}
                interactiveFields={showPlanViewport ? modelInteractiveFields : undefined}
                footprintEditor={showPlanViewport ? footprintEditor : undefined}
                planInteraction={showPlanViewport ? planInteraction : undefined}
                houseFirstPlanOverlay={showPlanViewport ? houseFirstPlanOverlay : null}
                houseFirstPreviewOverlay={showPlanViewport ? houseFirstPreviewOverlay : null}
                activeHouseFirstCustomEdgeId={houseFirstActiveCustomEdgeId}
                onHouseFirstShapeSelect={showPlanViewport ? handleHouseFirstShapeSelect : undefined}
                onHouseFirstShapeDragStart={showPlanViewport ? handleHouseFirstShapeDragStart : undefined}
                onHouseFirstCustomEdgeSelect={showPlanViewport ? handleHouseFirstCustomEdgeSelect : undefined}
                onHouseFirstDimensionActivate={showPlanViewport ? activateHouseFirstDimensionEditor : undefined}
              />
            ) : showHouseSectionPlaceholder ? (
              <div className={styles.placeholder}>
                <p className={styles.placeholderTitle}>House mode section view is not available yet.</p>
              </div>
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
