'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
} from 'react';
import type { AttachmentSide } from '@sp/costing';
import {
  ModuleDrawingRenderer,
  type ObjectWorkbenchPreviewOverlay,
  type ObjectWorkbenchPlanShapeDragStartMeta,
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
import type { HouseFootprintHandleId, ModulePlanModel } from '@/app/staff/calculator/moduleViews';
import type { PlanViewModel } from '@/lib/drawings/views/plan/buildPlanViewModel';
import type { WorkbenchDrawingSurfaceGeometry } from '@/lib/drawings/views/workbenchDrawingSurfaceGeometry';
import { resolveModelSpaceSurfaceReadiness } from '@/lib/drawings/views/modelSpaceSurfaceReadiness';
import {
  isProjectionBackedDeckDrag,
  resolveDeckDragPlanPoint,
} from '@/lib/drawings/interactions/deckDragPointResolver';
import {
  buildDeckInteractionCapabilityFromSelection,
  type DeckInteractionCapability,
  type DeckInteractionTelemetry,
} from '@/lib/drawings/interactions/deckInteractionContract';
import {
  buildDeckInteractionTelemetry,
  buildDeckInteractionViewState,
  type DeckReleaseState,
  type DeckDragSession,
  type DeckPreviewState,
} from '@/lib/drawings/interactions/deckInteractionAdapter';
import {
  buildOpeningInteractionTelemetry,
  buildOpeningInteractionViewState,
  type OpeningDragSession,
  type OpeningPreviewState,
} from '@/lib/drawings/interactions/openingInteractionAdapter';
import {
  releaseDeckMoveTool,
  startDeckMoveTool,
  moveDeckMoveTool,
} from '@/lib/drawings/interactions/deckMoveToolController';
import {
  advanceDeckReleaseSettleState,
  createDeckReleaseSettleState,
  resolveDeckCommitSettleState,
  resolveDeckReleasePreview,
  resolveDeckSettleMatch,
  type DeckDragSettleState,
  type DeckReleaseFeedbackState,
} from '@/lib/drawings/interactions/deckReleaseSettlementController';
import {
  releaseOpeningMoveTool,
  startOpeningMoveTool,
  moveOpeningMoveTool,
} from '@/lib/drawings/interactions/openingMoveToolController';
import { resolvePlanDimensionEditIntent } from '@/lib/drawings/interactions/planDimensionEditController';
import {
  armDrawOutlineDistanceLockController,
  cancelDrawOutlineController,
  closeDrawOutlineController,
  endDrawOutlinePointerSession,
  hoverDrawOutlineCanvasPoint,
  moveDrawOutlinePointerSession,
  selectDrawOutlineCanvasPoint,
  startDrawOutlineController,
  startDrawOutlinePointerSession,
  undoDrawOutlineController,
  type DrawOutlinePointerSession,
} from '@/lib/drawings/interactions/drawOutlineToolController';
import {
  buildFootprintAttachmentSideIntent,
  buildFootprintModeIntent,
  buildFootprintPresetIntent,
  buildFootprintRotateIntent,
  resolveFootprintEdgeAddIntent,
  resolveFootprintHandleDragIntent,
  resolveFootprintVertexDeleteIntent,
  resolveFootprintVertexDragIntent,
  type FootprintDragControllerState,
  type FootprintVertexDragControllerState,
} from '@/lib/drawings/interactions/footprintEditController';
import {
  WHEEL_GESTURE_IDLE_MS,
  clampModelSpaceZoom,
  createModelSpacePinchSession,
  createModelSpaceWebKitGestureSession,
  resolveModelSpaceFitView,
  resolveModelSpacePanMove,
  resolveModelSpacePinchMove,
  resolveModelSpaceWebKitGestureChange,
  resolveModelSpaceWheelZoom,
  resolveModelSpaceZoomButton,
  resolveTouchDistance,
  resolveTouchMidpoint,
  resolveTouchPointerPair,
  type ModelSpaceGesture,
  type ModelSpacePanSession,
  type ModelSpacePinchSession,
  type ModelSpacePinchSource,
  type ModelSpaceRect,
  type ModelSpaceTouchPointerSnapshot,
  type ModelSpaceWebKitGestureSession,
} from '@/lib/drawings/interactions/modelSpaceNavigationController';
import {
  resolvePlanFieldResizeDrag,
  startPlanFieldResizeDrag,
  type PlanFieldResizeDragSession,
} from '@/lib/drawings/interactions/planFieldResizeController';
import {
  OBJECT_DRAG_INTENT_THRESHOLD_PX,
  resolveObjectInteractionMove,
  setObjectInteractionPhase,
  type ObjectInteractionPhase,
  type ObjectInteractionViewState,
} from '@/lib/drawings/interactions/objectInteractionEngine';
import type {
  DrawingWorkbenchViewportTransform,
  DrawingWorkbenchVisibilityState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { EstimateDrawingField, EstimateDrawingFootprintEdit } from '@/lib/estimates/drawingEdits';
import type {
  ObjectWorkbenchDeckPatch,
  ObjectWorkbenchDisplayFamily,
  ObjectWorkbenchOpeningPatch,
  ObjectWorkbenchViewportTargetSelection,
} from '@/lib/drawings/state/objectWorkbenchViewportTypes';
import type { WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import {
  normalizeHouseFootprintParams,
  type CalculatorHouseFootprintPolygonPoint,
} from '@/lib/types/calculator';
import { moduleDrawingThemeCssVariables } from '@/lib/theme/moduleDrawing';
import {
  type ObjectWorkbenchPlanDeckInteraction,
  type ObjectWorkbenchPlanCustomEdgeCandidate,
  type ObjectWorkbenchPlanPresetDimensionAnnotation,
  type ObjectWorkbenchPlanShapeOverlay,
  type PlanPoint,
} from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';
import { blockNativeSelectionEvent } from './nativeSelection';
import {
  buildObjectInteractionHudModel,
  buildObjectInteractionPreviewOverlay,
  resolveObjectInteractionPreviewTargetState,
} from './objectInteractionPresenter';
import styles from './ModelSpaceViewport.module.css';
import {
  createInactiveDrawOutlineState,
  deriveDrawOutlineViewModel,
  isDrawOutlineActive,
  setDrawOutlineDistanceDraft,
  type DrawOutlineToolState,
  type DrawOutlineTransitionResult,
} from './drawOutlineToolState';

type FootprintDragSession = HouseFootprintEditorDragMeta & FootprintDragControllerState & {
  pointerId: number;
};

type FootprintVertexDragSession = HouseFootprintVertexDragMeta & FootprintVertexDragControllerState & {
  pointerId: number;
};

type PanDragSession = ModelSpacePanSession;

type TouchPointerSnapshot = ModelSpaceTouchPointerSnapshot;

type PinchZoomSession = ModelSpacePinchSession;

type WebKitGestureSession = ModelSpaceWebKitGestureSession;

type NativeGestureEvent = Event & {
  scale?: number;
  clientX?: number;
  clientY?: number;
};

type DrawPopoverPosition = {
  left: number;
  top: number;
};

type ObjectWorkbenchDimensionEditorState = {
  annotation: ObjectWorkbenchPlanPresetDimensionAnnotation | ObjectWorkbenchPlanCustomEdgeCandidate;
  value: string;
};

type DeckSvgInteraction = Extract<ObjectWorkbenchPlanShapeDragStartMeta, { ownerKind: 'deck' }>['deckInteraction'];

type DeckDragPhase = ObjectInteractionPhase;

type DeckDragPinnedScrollTarget = {
  node: HTMLElement;
  scrollTop: number;
  scrollLeft: number;
};

type DeckDragViewportAnchor = {
  scrollerTop: number;
  scrollerLeft: number;
  scrollerWidth: number;
  scrollerHeight: number;
  scrollTargets: DeckDragPinnedScrollTarget[];
};

type DeckDragViewportAnchorDrift = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const DRAW_POPOVER_MARGIN_PX = 12;
const DRAW_POPOVER_GAP_PX = 14;
const DRAW_OUTLINE_PAN_THRESHOLD_PX = 5;
const DECK_RELEASE_CLICK_SUPPRESSION_MS = 400;
const DECK_VIEWPORT_STABILITY_TOLERANCE_PX = 0.5;

function clampZoom(value: number): number {
  return clampModelSpaceZoom(value);
}

function clampValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isViewportNavigationControlTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest('button,input,select,textarea,[contenteditable="true"],[data-draw-outline-distance-hud]'),
    )
  );
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function isDrawOutlineDistanceKey(event: KeyboardEvent): boolean {
  return !event.altKey && !event.ctrlKey && !event.metaKey && (/^[0-9]$/.test(event.key) || event.key === '.');
}

function appendDrawOutlineDistanceDraft(currentDraft: string, key: string): string {
  if (key === '.') {
    if (currentDraft.includes('.')) return currentDraft;
    return currentDraft ? `${currentDraft}.` : '0.';
  }
  return `${currentDraft}${key}`;
}

function isViewportEditHitTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        '[data-plan-resize-handle-hit],[data-editable-field-id],[data-object-workbench-shape-hit],[data-house-first-shape-hit],[data-object-workbench-custom-edge-hit],[data-house-first-custom-edge-hit],[data-object-workbench-plan-dimension],[data-house-first-plan-dimension],[data-footprint-edge],[data-footprint-resize-edge-hit],[data-footprint-custom-edge-hit],[data-footprint-custom-vertex],[data-footprint-custom-vertex-hit],[data-footprint-custom-close-hit]',
      ),
    )
  );
}

function isViewportMousePanIgnoredTarget(target: EventTarget | null): boolean {
  return isViewportNavigationControlTarget(target) || isViewportEditHitTarget(target);
}

function isSecondaryMouseButton(event: Pick<PointerEvent, 'button'> | Pick<ReactPointerEvent<Element>, 'button'>): boolean {
  return event.button === 2;
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

function isScrollableOverflowValue(value: string): boolean {
  return value === 'auto' || value === 'scroll' || value === 'overlay';
}

function isScrollableElement(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  const canScrollVertically = isScrollableOverflowValue(style.overflowY) && element.scrollHeight > element.clientHeight;
  const canScrollHorizontally = isScrollableOverflowValue(style.overflowX) && element.scrollWidth > element.clientWidth;
  return canScrollVertically || canScrollHorizontally;
}

function collectScrollableAncestors(node: HTMLElement | null): HTMLElement[] {
  if (!node || typeof window === 'undefined') return [];
  const scrollTargets: HTMLElement[] = [];
  let current = node.parentElement;
  while (current) {
    if (isScrollableElement(current)) {
      scrollTargets.push(current);
    }
    current = current.parentElement;
  }
  const scrollingElement = node.ownerDocument?.scrollingElement;
  if (scrollingElement instanceof HTMLElement && isScrollableElement(scrollingElement) && !scrollTargets.includes(scrollingElement)) {
    scrollTargets.push(scrollingElement);
  }
  return scrollTargets;
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
  objectWorkbenchDisplayFamily = 'pergolas',
  visibility,
  status,
  planViewModel,
  drawingSurfaceGeometry,
  activeObjectRef,
  pergolaTargetId,
  enableProjectionOnlyModelInteractions = false,
  drawOutlineRequestId,
  drawOutlineMode,
  drawOutlineSeedPolygon,
  fitViewKey = view,
  autoFitOnReady = true,
  viewportTransform,
  onViewportTransformChange,
  onConsumeDrawOutlineRequest,
  editableFields,
  onCommitField,
  onCommitFootprintEdit,
  onCommitCustomPolygon,
  onSelectObjectWorkbenchTarget,
  onSelectPergolaTarget,
  onClearWorkbenchSelection,
  onCommitHouseFormFootprintDimension,
  onCommitDeckDimension,
  onCommitOpeningDimension,
  onDeckInteractionTelemetryChange,
}: {
  view: ModuleViewsTab;
  objectWorkbenchDisplayFamily?: ObjectWorkbenchDisplayFamily;
  visibility?: DrawingWorkbenchVisibilityState;
  status: ModuleViewsStatus;
  planViewModel?: PlanViewModel | null;
  drawingSurfaceGeometry?: WorkbenchDrawingSurfaceGeometry | null;
  activeObjectRef?: WorkbenchObjectRef | null;
  pergolaTargetId?: string | null;
  enableProjectionOnlyModelInteractions?: boolean;
  drawOutlineRequestId?: number;
  drawOutlineMode?: 'footprint' | 'deck' | null;
  drawOutlineSeedPolygon?: CalculatorHouseFootprintPolygonPoint[] | null;
  fitViewKey?: string;
  autoFitOnReady?: boolean;
  viewportTransform: DrawingWorkbenchViewportTransform;
  onViewportTransformChange?: (next: DrawingWorkbenchViewportTransform) => void;
  onConsumeDrawOutlineRequest?: (requestId: number) => void;
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
  onSelectObjectWorkbenchTarget?: (selection: ObjectWorkbenchViewportTargetSelection) => void;
  onSelectPergolaTarget?: (pergolaId: string) => void;
  onClearWorkbenchSelection?: () => void;
  onCommitHouseFormFootprintDimension?: (
    edit: EstimateDrawingFootprintEdit,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onCommitDeckDimension?: (
    deckId: string,
    patch: ObjectWorkbenchDeckPatch,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onCommitOpeningDimension?: (
    openingId: string,
    patch: ObjectWorkbenchOpeningPatch,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onDeckInteractionTelemetryChange?: (telemetry: DeckInteractionTelemetry) => void;
}) {
  const workbenchDisplayMode = objectWorkbenchDisplayFamily === 'house_forms' ? 'house' : 'pergolas';
  const activePergolaId = activeObjectRef?.family === 'pergolas' ? activeObjectRef.objectId : pergolaTargetId ?? null;
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const scaleFrameRef = useRef<HTMLDivElement | null>(null);
  const drawPopoverRef = useRef<HTMLDivElement | null>(null);
  const dimensionPopoverRef = useRef<HTMLDivElement | null>(null);
  const footprintSvgRef = useRef<SVGSVGElement | null>(null);
  const drawOutlineCanvasPointResolverRef = useRef<ModuleFootprintCanvasPointResolver | null>(null);
  const planPointResolverRef = useRef<((clientX: number, clientY: number) => PlanPoint | null) | null>(null);
  const deckDragPointResolverRef = useRef<((clientX: number, clientY: number) => PlanPoint | null) | null>(null);
  const activeDeckDragPointerIdRef = useRef<number | null>(null);
  const lastResolvedDeckDragPlanPointRef = useRef<PlanPoint | null>(null);
  const deckDragSessionRef = useRef<DeckDragSession | null>(null);
  const deckPreviewStateRef = useRef<DeckPreviewState | null>(null);
  const deckDragPhaseRef = useRef<DeckDragPhase>('idle');
  const deckDragViewportAnchorRef = useRef<DeckDragViewportAnchor | null>(null);
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
  const [planFieldDragSession, setPlanFieldDragSession] = useState<PlanFieldResizeDragSession | null>(null);
  const [objectWorkbenchActiveCustomEdgeId, setObjectWorkbenchActiveCustomEdgeId] = useState<string | null>(null);
  const [objectWorkbenchDimensionEditor, setObjectWorkbenchDimensionEditor] = useState<ObjectWorkbenchDimensionEditorState | null>(null);
  const [objectWorkbenchDimensionPopoverPosition, setObjectWorkbenchDimensionPopoverPosition] = useState<DrawPopoverPosition | null>(null);
  const [deckDragSession, setDeckDragSession] = useState<DeckDragSession | null>(null);
  const [deckPreviewState, setDeckPreviewState] = useState<DeckPreviewState | null>(null);
  const [deckDragPhase, setDeckDragPhase] = useState<DeckDragPhase>('idle');
  const [deckDragSettleState, setDeckDragSettleState] = useState<DeckDragSettleState | null>(null);
  const [deckReleaseFeedbackState, setDeckReleaseFeedbackState] = useState<DeckReleaseFeedbackState | null>(null);
  const [hoveredDeckId, setHoveredDeckId] = useState<string | null>(null);
  const [openingDragSession, setOpeningDragSession] = useState<OpeningDragSession | null>(null);
  const [openingPreviewState, setOpeningPreviewState] = useState<OpeningPreviewState | null>(null);
  const deckDragClickSuppressedUntilRef = useRef(0);

  useEffect(() => {
    drawOutlinePointerSessionRef.current = drawOutlinePointerSession;
  }, [drawOutlinePointerSession]);

  useEffect(() => {
    deckPreviewStateRef.current = deckPreviewState;
  }, [deckPreviewState]);

  useEffect(() => {
    deckDragSessionRef.current = deckDragSession;
  }, [deckDragSession]);

  useEffect(() => {
    deckDragPhaseRef.current = deckDragPhase;
  }, [deckDragPhase]);

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
  const surfaceReadiness = resolveModelSpaceSurfaceReadiness({
    view,
    drawingSurfaceGeometry,
  });
  const legacyPlanModel = surfaceReadiness.legacyPlanModel;
  const legacySectionModel = surfaceReadiness.legacySectionModel;
  const geometryPlanDimensions =
    drawingSurfaceGeometry?.source === 'solved_geometry' && drawingSurfaceGeometry.artifact?.plan
      ? {
          lengthA: drawingSurfaceGeometry.artifact.plan.extents.lengthMm / 1000,
          spanA: drawingSurfaceGeometry.artifact.plan.extents.projectionMm / 1000,
        }
      : null;
  const canEditFootprint = view === 'plan' && Boolean(legacyPlanModel) && Boolean(onCommitFootprintEdit) && canEditHouseFootprintPlan(legacyPlanModel);
  const canCommitCustomPolygon = view === 'plan' && Boolean(legacyPlanModel) && Boolean(onCommitCustomPolygon);
  const deckOutlineMode = drawOutlineMode === 'deck';
  const canRotatePlan = view === 'plan' && Boolean(legacyPlanModel) && Boolean(onCommitFootprintEdit) && legacyPlanModel?.roofType !== 'hip_corner';
  const canEditPlanDimensions =
    view === 'plan' &&
      Boolean(geometryPlanDimensions ?? legacyPlanModel) &&
      Boolean(onCommitField) &&
      (editableFieldMap.has('plan:lengthA') || editableFieldMap.has('plan:spanA'));
  const showHouseSectionPlaceholder = workbenchDisplayMode === 'house' && view === 'section';
  const hasGeometryReadyPlan = surfaceReadiness.hasGeometryReadyPlan;
  const showPlanViewport = view === 'plan' && hasGeometryReadyPlan;
  const showSectionViewport = surfaceReadiness.hasDrawableSection && !showHouseSectionPlaceholder;
  const showDrawingViewport = surfaceReadiness.showDrawingViewport && !showHouseSectionPlaceholder;
  const modelSpaceAutoFitReady = showDrawingViewport;
  const modelSpaceAutoFitKey = `${fitViewKey}:${modelSpaceAutoFitReady ? 'ready' : 'empty'}`;
  const interactionError = fieldError ?? footprintError;
  const deckReleaseCommitPending =
    deckDragPhase === 'settling' && deckDragSettleState?.releaseOutcome === 'pending';
  const deckDragLocked =
    deckDragPhase === 'drag-intent' ||
    deckDragPhase === 'dragging' ||
    deckReleaseCommitPending;

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

  const closeObjectWorkbenchDimensionEditor = useCallback(() => {
    setObjectWorkbenchDimensionEditor(null);
    setObjectWorkbenchDimensionPopoverPosition(null);
  }, []);

  const activateObjectWorkbenchDimensionEditor = useCallback(
    (
      annotation: ObjectWorkbenchPlanPresetDimensionAnnotation | ObjectWorkbenchPlanCustomEdgeCandidate,
      target: SVGTextElement,
    ) => {
      void target;
      setFootprintError(null);
      setFieldError(null);
      setObjectWorkbenchDimensionEditor({
        annotation,
        value: annotation.rawValue,
      });
    },
    [],
  );

  const handleObjectWorkbenchShapeSelect = useCallback(
    (target: { ownerKind: 'footprint' | 'deck' | 'opening'; ownerId: string }) => {
      closeObjectWorkbenchDimensionEditor();
      setObjectWorkbenchActiveCustomEdgeId(null);
      if (!onSelectObjectWorkbenchTarget) return;
      onSelectObjectWorkbenchTarget(
        target.ownerKind === 'footprint'
          ? { kind: 'footprint', targetId: target.ownerId }
          : target.ownerKind === 'opening'
            ? { kind: 'opening', targetId: target.ownerId }
            : { kind: 'deck', targetId: target.ownerId },
      );
    },
    [closeObjectWorkbenchDimensionEditor, onSelectObjectWorkbenchTarget],
  );

  const handleObjectWorkbenchCustomEdgeSelect = useCallback(
    (target: { ownerKind: 'footprint' | 'deck'; ownerId: string; edgeIndex: number }) => {
      closeObjectWorkbenchDimensionEditor();
      setObjectWorkbenchActiveCustomEdgeId(`${target.ownerId}:edge:${target.edgeIndex}`);
      onSelectObjectWorkbenchTarget?.(
        target.ownerKind === 'footprint'
          ? { kind: 'footprint', targetId: target.ownerId }
          : { kind: 'deck', targetId: target.ownerId },
      );
    },
    [closeObjectWorkbenchDimensionEditor, onSelectObjectWorkbenchTarget],
  );

  const handlePergolaTargetSelect = useCallback(
    (pergolaId: string) => {
      closeObjectWorkbenchDimensionEditor();
      setObjectWorkbenchActiveCustomEdgeId(null);
      onSelectPergolaTarget?.(pergolaId);
    },
    [closeObjectWorkbenchDimensionEditor, onSelectPergolaTarget],
  );

  const handleWorkbenchCanvasSelect = useCallback(() => {
    closeObjectWorkbenchDimensionEditor();
    setObjectWorkbenchActiveCustomEdgeId(null);
    setHoveredDeckId(null);
    onClearWorkbenchSelection?.();
  }, [closeObjectWorkbenchDimensionEditor, onClearWorkbenchSelection]);

  const handleObjectWorkbenchDeckHoverChange = useCallback((deckId: string | null) => {
    if (deckDragPhaseRef.current === 'settling' || deckDragSessionRef.current) return;
    setHoveredDeckId(deckId);
  }, []);

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

  const captureDeckDragViewportAnchor = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      deckDragViewportAnchorRef.current = null;
      return;
    }
    const scrollerRect = scroller.getBoundingClientRect();
    deckDragViewportAnchorRef.current = {
      scrollerTop: scrollerRect.top,
      scrollerLeft: scrollerRect.left,
      scrollerWidth: scrollerRect.width,
      scrollerHeight: scrollerRect.height,
      scrollTargets: collectScrollableAncestors(scroller).map((node) => ({
        node,
        scrollTop: node.scrollTop,
        scrollLeft: node.scrollLeft,
      })),
    };
  }, []);

  const clearDeckDragViewportAnchor = useCallback(() => {
    deckDragViewportAnchorRef.current = null;
  }, []);

  const restoreDeckDragPinnedScrollTargets = useCallback(() => {
    const anchor = deckDragViewportAnchorRef.current;
    if (!anchor) return;
    for (const target of anchor.scrollTargets) {
      if (target.node.scrollTop !== target.scrollTop) {
        target.node.scrollTop = target.scrollTop;
      }
      if (target.node.scrollLeft !== target.scrollLeft) {
        target.node.scrollLeft = target.scrollLeft;
      }
    }
  }, []);

  const measureDeckDragViewportAnchorDrift = useCallback((): DeckDragViewportAnchorDrift | null => {
    const anchor = deckDragViewportAnchorRef.current;
    const scroller = scrollerRef.current;
    if (!anchor || !scroller) return null;
    const rect = scroller.getBoundingClientRect();
    return {
      top: rect.top - anchor.scrollerTop,
      left: rect.left - anchor.scrollerLeft,
      width: rect.width - anchor.scrollerWidth,
      height: rect.height - anchor.scrollerHeight,
    };
  }, []);

  const isDeckDragViewportAnchorStable = useCallback((drift: DeckDragViewportAnchorDrift | null) => {
    if (!drift) return true;
    return (
      Math.abs(drift.top) <= DECK_VIEWPORT_STABILITY_TOLERANCE_PX &&
      Math.abs(drift.left) <= DECK_VIEWPORT_STABILITY_TOLERANCE_PX &&
      Math.abs(drift.width) <= DECK_VIEWPORT_STABILITY_TOLERANCE_PX &&
      Math.abs(drift.height) <= DECK_VIEWPORT_STABILITY_TOLERANCE_PX
    );
  }, []);

  const captureDeckDragPointer = useCallback((pointerId: number) => {
    const captureTarget = footprintSvgRef.current ?? scrollerRef.current;
    if (!captureTarget || typeof captureTarget.setPointerCapture !== 'function') return;
    try {
      captureTarget.setPointerCapture(pointerId);
      activeDeckDragPointerIdRef.current = pointerId;
    } catch {
      activeDeckDragPointerIdRef.current = null;
    }
  }, []);

  const releaseDeckDragPointer = useCallback((pointerId?: number | null) => {
    const captureTarget = footprintSvgRef.current ?? scrollerRef.current;
    const activePointerId = pointerId ?? activeDeckDragPointerIdRef.current;
    if (!captureTarget || activePointerId === null || typeof captureTarget.releasePointerCapture !== 'function') {
      activeDeckDragPointerIdRef.current = null;
      return;
    }
    try {
      if (typeof captureTarget.hasPointerCapture === 'function' && !captureTarget.hasPointerCapture(activePointerId)) {
        activeDeckDragPointerIdRef.current = null;
        return;
      }
      captureTarget.releasePointerCapture(activePointerId);
    } catch {
      // Ignore release failures during drag cleanup.
    } finally {
      activeDeckDragPointerIdRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      releaseDeckDragPointer(activeDeckDragPointerIdRef.current);
      deckDragViewportAnchorRef.current = null;
    },
    [releaseDeckDragPointer],
  );

  const resetDeckDragInteraction = useCallback((options?: {
    suppressClick?: boolean;
    releaseFeedback?: DeckReleaseFeedbackState | null;
  }) => {
    deckDragClickSuppressedUntilRef.current = options?.suppressClick ? Date.now() + DECK_RELEASE_CLICK_SUPPRESSION_MS : 0;
    releaseDeckDragPointer(activeDeckDragPointerIdRef.current);
    clearDeckDragViewportAnchor();
    lastResolvedDeckDragPlanPointRef.current = null;
    deckDragSessionRef.current = null;
    deckDragPhaseRef.current = 'idle';
    setDeckDragSession(null);
    setDeckPreviewState(null);
    setDeckDragSettleState(null);
    setDeckDragPhase('idle');
    setDeckReleaseFeedbackState(options?.releaseFeedback ?? null);
  }, [clearDeckDragViewportAnchor, releaseDeckDragPointer]);

  const finalizeDeckDragSettlement = useCallback(
    (releaseFeedback?: DeckReleaseFeedbackState | null, options?: { suppressClick?: boolean }) => {
      resetDeckDragInteraction({ suppressClick: options?.suppressClick ?? true, releaseFeedback });
    },
    [resetDeckDragInteraction],
  );

  useEffect(() => {
    if (!deckReleaseFeedbackState) return;
    const timeoutMs = Math.max(0, deckReleaseFeedbackState.expiresAtMs - Date.now());
    const timeoutId = window.setTimeout(() => {
      setDeckReleaseFeedbackState((current) =>
        current && current.expiresAtMs === deckReleaseFeedbackState.expiresAtMs ? null : current,
      );
    }, timeoutMs);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [deckReleaseFeedbackState]);

  const handleObjectWorkbenchShapeDragStart = useCallback(
    (
      meta: ObjectWorkbenchPlanShapeDragStartMeta,
      event: { pointerId: number; clientX: number; clientY: number },
    ) => {
      const svg = footprintSvgRef.current;
      if (!svg) return;
      const startPoint = clientPointToSvg(svg, event.clientX, event.clientY);
      if (!startPoint) return;
      if (meta.ownerKind === 'deck') {
        if (!onCommitDeckDimension) return;
        if (deckDragPhaseRef.current === 'settling' || deckDragSessionRef.current) {
          resetDeckDragInteraction();
        }
        const overlayShape =
          meta.overlayShape ??
          planViewModel?.objectWorkbenchOverlay?.shapes.find(
            (shape) => shape.ownerKind === 'deck' && shape.ownerId === meta.ownerId,
        );
        if (!overlayShape?.deckInteraction) return;
        const projectionBackedDeckDrag = isProjectionBackedDeckDrag(overlayShape.deckInteraction);
        const startDragPlanPoint = resolveDeckDragPlanPoint({
          clientX: event.clientX,
          clientY: event.clientY,
          projectionBackedDeckDrag,
          deckDragPointResolver: deckDragPointResolverRef.current,
          legacyPlanPointResolver: planPointResolverRef.current,
        });
        if (projectionBackedDeckDrag && !startDragPlanPoint) return;

        closeObjectWorkbenchDimensionEditor();
        setFieldError(null);
        setFootprintError(null);
        setDeckReleaseFeedbackState(null);
        setOpeningDragSession(null);
        setOpeningPreviewState(null);
        setDeckDragSettleState(null);
        setDeckPreviewState(null);
        const deckMoveStart = startDeckMoveTool(
          {
            deckId: meta.ownerId,
            overlayShape,
            svgInteraction: meta.deckInteraction,
          },
          {
            pointerId: event.pointerId,
            clientX: event.clientX,
            clientY: event.clientY,
            svgPoint: startPoint,
            planPoint: startDragPlanPoint,
          },
        );
        if (!deckMoveStart.ok) return;
        const nextDeckDragSession = deckMoveStart.session;
        deckDragPhaseRef.current = 'drag-intent';
        deckDragSessionRef.current = nextDeckDragSession;
        setDeckDragPhase('drag-intent');
        setDeckDragSession(nextDeckDragSession);
        setPanDragSession(null);
        clearTouchNavigation();
        clearWebKitGestureNavigation();
        deckDragClickSuppressedUntilRef.current = 0;
        lastResolvedDeckDragPlanPointRef.current = startDragPlanPoint;
        captureDeckDragViewportAnchor();
        captureDeckDragPointer(event.pointerId);
        return;
      }

      if (!onCommitOpeningDimension) return;
      const overlayShape = planViewModel?.objectWorkbenchOverlay?.shapes.find(
        (shape) => shape.ownerKind === 'opening' && shape.ownerId === meta.ownerId,
      );
      if (!overlayShape?.openingInteraction) return;

      closeObjectWorkbenchDimensionEditor();
      setFieldError(null);
      setFootprintError(null);
      setDeckReleaseFeedbackState(null);
      resetDeckDragInteraction();
      setOpeningPreviewState(null);
      const openingMoveStart = startOpeningMoveTool(
        {
          openingId: meta.ownerId,
          overlayShape,
          svgInteraction: meta.openingInteraction,
        },
        {
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
          svgPoint: startPoint,
          planPoint: null,
        },
      );
      if (!openingMoveStart.ok) return;
      setOpeningDragSession(openingMoveStart.session);
    },
    [
      closeObjectWorkbenchDimensionEditor,
      onCommitDeckDimension,
      onCommitOpeningDimension,
      planViewModel,
      clearTouchNavigation,
      clearWebKitGestureNavigation,
      captureDeckDragViewportAnchor,
      captureDeckDragPointer,
      resetDeckDragInteraction,
    ],
  );

  const findObjectWorkbenchCustomDeckLocalPolygon = useCallback(
    (deckId: string): CalculatorHouseFootprintPolygonPoint[] | null =>
      planViewModel?.objectWorkbenchOverlay?.customEdgeCandidates.find(
        (candidate) => candidate.ownerKind === 'deck' && candidate.ownerId === deckId,
      )?.localPolygon ?? null,
    [planViewModel],
  );

  const commitObjectWorkbenchDimensionEdit = useCallback(
    async (editor: ObjectWorkbenchDimensionEditorState): Promise<boolean> => {
      const houseFootprintDimensionCommit = onCommitHouseFormFootprintDimension ?? onCommitFootprintEdit;
      const intent = resolvePlanDimensionEditIntent({
        annotation: editor.annotation,
        nextValue: editor.value,
        customDeckLocalPolygon:
          editor.annotation.targetKind === 'deck_host_edge_reference' &&
          editor.annotation.deckInteraction?.kind === 'custom_outline'
            ? findObjectWorkbenchCustomDeckLocalPolygon(editor.annotation.ownerId)
            : null,
      });
      let result:
        | {
            ok: boolean;
            error?: string;
          }
        | undefined;

      if (intent.kind === 'house_footprint_edit') {
        result = houseFootprintDimensionCommit
          ? await resolveCommitResult(
              houseFootprintDimensionCommit(intent.edit),
            )
          : { ok: false, error: 'House footprint dimensions are not editable in this view.' };
      } else if (intent.kind === 'deck_patch') {
        result = onCommitDeckDimension
          ? await resolveCommitResult(
              onCommitDeckDimension(intent.deckId, intent.patch),
            )
          : { ok: false, error: 'Deck dimensions are not editable in this view.' };
      } else if (intent.kind === 'opening_patch') {
        result = onCommitOpeningDimension
          ? await resolveCommitResult(
              onCommitOpeningDimension(intent.openingId, intent.patch),
            )
          : { ok: false, error: 'Opening dimensions are not editable in this view.' };
      } else {
        result = { ok: false, error: intent.error };
      }

      if (!result?.ok) {
        setFieldError(result?.error ?? 'Unable to update the dimension.');
        return false;
      }

      setFieldError(null);
      setFootprintError(null);
      closeObjectWorkbenchDimensionEditor();
      return true;
    },
    [
      closeObjectWorkbenchDimensionEditor,
      findObjectWorkbenchCustomDeckLocalPolygon,
      onCommitFootprintEdit,
      onCommitDeckDimension,
      onCommitOpeningDimension,
      onCommitHouseFormFootprintDimension,
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

  const navigationState = useMemo(
    () => ({
      transform: {
        zoom,
        panX: viewportTransform.panX,
        panY: viewportTransform.panY,
      },
      zoom,
      gesture: viewportNavigationGesture,
      pinchSource,
      deckDragLocked,
    }),
    [deckDragLocked, pinchSource, viewportNavigationGesture, viewportTransform.panX, viewportTransform.panY, zoom],
  );

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

  const handleZoomChange = useCallback(
    (delta: number) => {
      const result = resolveModelSpaceZoomButton({
        state: navigationState,
        delta,
      });
      if (!result.transform) return;
      userAdjustedViewportRef.current = true;
      updateViewportTransform(result.transform);
    },
    [navigationState, updateViewportTransform],
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

    return resolveModelSpaceFitView({
      state: navigationState,
      measurements: {
        scrollerWidth,
        scrollerHeight,
        focusRect,
        svgRect,
        frameRect: frameFallback,
      },
    }).transform;
  }, [navigationState, zoom]);

  const fitViewportToContent = useCallback((): boolean => {
    if (deckDragLocked) return false;
    const next = measureFitViewTransform();
    if (!next) return false;
    updateViewportTransform(next);
    return true;
  }, [deckDragLocked, measureFitViewTransform, updateViewportTransform]);

  const handleFitView = useCallback(() => {
    if (deckDragLocked) return;
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
  }, [clearTouchNavigation, clearWebKitGestureNavigation, deckDragLocked, fitViewportToContent, modelSpaceAutoFitKey, updateViewportTransform]);

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      if (deckDragLocked) {
        event.preventDefault();
        return;
      }
      if (isViewportNavigationControlTarget(event.target)) return;
      const anchor = resolveViewportAnchor(event.clientX, event.clientY);
      if (!anchor) return;
      const result = resolveModelSpaceWheelZoom({
        state: navigationState,
        deltaMode: event.deltaMode,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        anchor,
      });
      if (!result.transform) return;
      event.preventDefault();
      userAdjustedViewportRef.current = true;
      markTransientViewportGesture('wheel-zoom', 'wheel');
      updateViewportTransform(result.transform);
    },
    [
      markTransientViewportGesture,
      navigationState,
      resolveViewportAnchor,
      updateViewportTransform,
      deckDragLocked,
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
      const intent = buildFootprintPresetIntent(preset);
      if (intent.kind === 'footprint_edit') await commitFootprintEdit(intent.edit);
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
    applyDrawOutlineTransition(startDrawOutlineController());
  }, [applyDrawOutlineTransition]);

  useEffect(() => {
    if (drawOutlineRequestId === undefined || drawOutlineRequestId <= 0) {
      lastDrawOutlineRequestIdRef.current = undefined;
      return;
    }
    if (drawOutlineRequestId === lastDrawOutlineRequestIdRef.current) return;
    lastDrawOutlineRequestIdRef.current = drawOutlineRequestId;
    if ((!canEditFootprint && !canCommitCustomPolygon) || view !== 'plan') return;
    startDrawOutlineSession();
    onConsumeDrawOutlineRequest?.(drawOutlineRequestId);
  }, [canCommitCustomPolygon, canEditFootprint, drawOutlineRequestId, onConsumeDrawOutlineRequest, startDrawOutlineSession, view]);

  useEffect(() => {
    if (view === 'plan' || !isDrawOutlineActive(drawOutlineState)) return;
    applyDrawOutlineTransition(cancelDrawOutlineController());
  }, [applyDrawOutlineTransition, drawOutlineState, view]);

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
      const intent = buildFootprintModeIntent(mode);
      if (intent.kind === 'start_draw_outline') {
        startDrawOutlineSession();
        return;
      }
      setDrawOutlineState(createInactiveDrawOutlineState());
      if (intent.kind === 'footprint_edit') await commitFootprintEdit(intent.edit);
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
      const intent = buildFootprintRotateIntent(delta);
      if (intent.kind === 'footprint_edit') await commitFootprintEdit(intent.edit);
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
      const intent = buildFootprintAttachmentSideIntent(side);
      if (intent.kind === 'footprint_edit') await commitFootprintEdit(intent.edit);
    },
    [commitFootprintEdit],
  );

  const handleFootprintDragStart = useCallback(
    (meta: HouseFootprintEditorDragMeta, event: { pointerId: number; clientX: number; clientY: number }) => {
      if (!canEditFootprint || !legacyPlanModel) return;
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
        startParams: normalizeHouseFootprintParams(legacyPlanModel.houseFootprintParams),
      });
    },
    [canEditFootprint, legacyPlanModel],
  );

  const handleFootprintVertexDragStart = useCallback(
    (meta: HouseFootprintVertexDragMeta, event: { pointerId: number; clientX: number; clientY: number }) => {
      if (!canEditFootprint || !legacyPlanModel || (legacyPlanModel.houseFootprintMode ?? 'preset') !== 'custom_polygon') return;
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
        startPolygon: legacyPlanModel.houseFootprintPolygon ?? [],
      });
    },
    [canEditFootprint, legacyPlanModel],
  );

  const handleFootprintEdgeAdd = useCallback(
    async (edgeIndex: number) => {
      if (!canEditFootprint || !legacyPlanModel || (legacyPlanModel.houseFootprintMode ?? 'preset') !== 'custom_polygon') return;
      const intent = resolveFootprintEdgeAddIntent({
        polygon: legacyPlanModel.houseFootprintPolygon ?? [],
        edgeIndex,
      });
      if (intent.kind === 'footprint_edit') await commitFootprintEdit(intent.edit);
    },
    [canEditFootprint, commitFootprintEdit, legacyPlanModel],
  );

  const handleFootprintVertexDelete = useCallback(
    async (vertexIndex: number) => {
      if (!canEditFootprint || !legacyPlanModel || (legacyPlanModel.houseFootprintMode ?? 'preset') !== 'custom_polygon') return;
      const intent = resolveFootprintVertexDeleteIntent({
        polygon: legacyPlanModel.houseFootprintPolygon ?? [],
        vertexIndex,
      });
      if (intent.kind === 'footprint_edit') await commitFootprintEdit(intent.edit);
    },
    [canEditFootprint, commitFootprintEdit, legacyPlanModel],
  );

  const handleDrawOutlinePointSelect = useCallback(
    (rawPoint: ModuleFootprintCanvasPoint) => {
      const result = selectDrawOutlineCanvasPoint({
        state: drawOutlineState,
        rawPoint,
      });
      if (!result.transition) return;
      setDrawOutlineLandingPoint(result.landingPoint);
      applyDrawOutlineTransition(result.transition);
    },
    [applyDrawOutlineTransition, drawOutlineState],
  );

  const handleDrawOutlineCanvasPointerDown = useCallback(
    (
      rawPoint: ModuleFootprintCanvasPoint,
      event: { pointerId: number; clientX: number; clientY: number; shiftKey: boolean },
    ) => {
      const result = startDrawOutlinePointerSession({
        rawPoint,
        state: drawOutlineState,
        shiftKey: event.shiftKey,
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        startPanX: viewportTransform.panX,
        startPanY: viewportTransform.panY,
      });
      if (!result.session) return;
      setDrawOutlineLandingPoint(result.landingPoint);
      drawOutlinePointerSessionRef.current = result.session;
      setDrawOutlinePointerSession(result.session);
    },
    [drawOutlineState, viewportTransform.panX, viewportTransform.panY],
  );

  const handleDrawOutlineUndo = useCallback(() => {
    applyDrawOutlineTransition(undoDrawOutlineController(drawOutlineState));
  }, [applyDrawOutlineTransition, drawOutlineState]);

  const handleDrawOutlineCancel = useCallback(() => {
    applyDrawOutlineTransition(cancelDrawOutlineController());
  }, [applyDrawOutlineTransition]);

  const handleDrawOutlineClose = useCallback(async () => {
    const closeResult = closeDrawOutlineController({
      state: drawOutlineState,
      mode: deckOutlineMode ? 'deck_custom_outline' : 'house_footprint',
    });
    if (!closeResult.ok) {
      if (closeResult.error) setFootprintError(closeResult.error);
      return;
    }
    const result =
      closeResult.commitIntent.kind === 'custom_polygon_commit' && onCommitCustomPolygon
        ? await resolveCommitResult(onCommitCustomPolygon(closeResult.commitIntent.polygon))
        : closeResult.commitIntent.kind === 'footprint_edit'
          ? await commitFootprintEdit(closeResult.commitIntent.edit)
          : { ok: false, error: 'Unable to close the custom outline.' };
    if (result.ok) {
      applyDrawOutlineTransition(closeResult.transition);
    }
  }, [applyDrawOutlineTransition, commitFootprintEdit, deckOutlineMode, drawOutlineState, onCommitCustomPolygon]);

  const handleDrawOutlinePointHover = useCallback(
    (rawPoint: ModuleFootprintCanvasPoint | null, shiftKey = false) => {
      const result = hoverDrawOutlineCanvasPoint({
        state: drawOutlineState,
        rawPoint,
        shiftKey,
      });
      setDrawOutlineLandingPoint(result.landingPoint);
      applyDrawOutlineTransition(result.transition);
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
    const session = createModelSpacePinchSession({
      first: pair[0],
      second: pair[1],
      anchor,
      state: navigationState,
    });
    if (!session) return;
    pinchZoomSessionRef.current = session;
    userAdjustedViewportRef.current = true;
    drawOutlinePointerSessionRef.current = null;
    setDrawOutlinePointerSession(null);
    setDrawOutlineState((current) =>
      hoverDrawOutlineCanvasPoint({
        state: current,
        rawPoint: null,
      }).transition.state,
    );
    setPinchZoomActive(true);
    setPinchSource('touch-pointer');
    setViewportNavigationGesture('pinch-zoom');
  }, [navigationState, resolveViewportAnchor]);

  const handleScrollerPointerDownCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === 'touch' && !isViewportNavigationControlTarget(event.target)) {
        if (deckDragLocked) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
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

      if (deckDragLocked) {
        event.preventDefault();
        event.stopPropagation();
        return;
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
        shiftKey: event.shiftKey,
      });
    },
    [clearViewportEditSessions, deckDragLocked, drawOutlineState, handleDrawOutlineCanvasPointerDown, startPinchZoomSessionFromActiveTouches],
  );

    const handleScrollerPointerMove = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDrawOutlineActive(drawOutlineState) || isViewportMousePanIgnoredTarget(event.target)) return;
      if (drawOutlinePointerSessionRef.current?.hasPanned) return;
      handleDrawOutlinePointHover(
        drawOutlineCanvasPointResolverRef.current?.(event.clientX, event.clientY) ?? null,
        event.shiftKey,
      );
    },
    [drawOutlineState, handleDrawOutlinePointHover],
  );

  const handleScrollerPointerLeave = useCallback(
    () => {
      setHoveredDeckId(null);
      if (!isDrawOutlineActive(drawOutlineState)) return;
      handleDrawOutlinePointHover(null);
    },
    [drawOutlineState, handleDrawOutlinePointHover],
  );

  const handleCanvasPanStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === 'touch') return;
      if (deckDragLocked) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (!isSecondaryMouseButton(event)) return;
      if (isViewportNavigationControlTarget(event.target)) return;
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
    [deckDragLocked, viewportTransform.panX, viewportTransform.panY],
  );

  const handleScrollerClickCapture = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!deckDragLocked && Date.now() >= deckDragClickSuppressedUntilRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    if (!deckDragLocked) {
      deckDragClickSuppressedUntilRef.current = 0;
    }
  }, [deckDragLocked]);

  const handleScrollerLostPointerCapture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (activeDeckDragPointerIdRef.current !== event.pointerId) return;
    if (deckDragPhaseRef.current === 'settling') return;
    resetDeckDragInteraction({ suppressClick: true });
  }, [resetDeckDragInteraction]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const shouldHandleGestureEvent = (event: Event): boolean => {
      if (isViewportNavigationControlTarget(event.target)) return false;
      return event.target instanceof Node ? scroller.contains(event.target) : true;
    };

    const handleGestureStart = (event: Event) => {
      if (!shouldHandleGestureEvent(event)) return;
      if (deckDragLocked) {
        event.preventDefault();
        return;
      }
      const gestureEvent = event as NativeGestureEvent;
      const anchor = resolveViewportAnchorFromGestureEvent(gestureEvent);
      if (!anchor) return;
      event.preventDefault();
      clearTouchNavigation();
      clearViewportEditSessions();
      webKitGestureSessionRef.current = createModelSpaceWebKitGestureSession({
        anchor,
        state: navigationState,
      });
      userAdjustedViewportRef.current = true;
      setPinchZoomActive(true);
      setPinchSource('webkit-gesture');
      setViewportNavigationGesture('trackpad-pinch');
    };

    const handleGestureChange = (event: Event) => {
      if (!shouldHandleGestureEvent(event)) return;
      if (deckDragLocked) {
        event.preventDefault();
        return;
      }
      const session = webKitGestureSessionRef.current;
      if (!session) return;
      const scale = Number((event as NativeGestureEvent).scale ?? 1);
      if (!Number.isFinite(scale) || scale <= 0) return;
      event.preventDefault();
      const result = resolveModelSpaceWebKitGestureChange({
        state: navigationState,
        session,
        scale,
      });
      if (result.transform) updateViewportTransform(result.transform);
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
    clearTouchNavigation,
    clearViewportEditSessions,
    clearWebKitGestureNavigation,
    deckDragLocked,
    navigationState,
    resolveViewportAnchorFromGestureEvent,
    updateViewportTransform,
  ]);

  useEffect(() => {
    userAdjustedViewportRef.current = false;
    autoFitKeyRef.current = autoFitOnReady ? null : modelSpaceAutoFitKey;
    clearTouchNavigation();
    clearWebKitGestureNavigation();
  }, [autoFitOnReady, clearTouchNavigation, clearWebKitGestureNavigation, modelSpaceAutoFitKey]);

  const handlePlanFieldDragStart = useCallback(
    (meta: ModulePlanResizeDragMeta, event: { pointerId: number; clientX: number; clientY: number }) => {
      const svg = footprintSvgRef.current;
      if (!svg) return;
      const startPoint = clientPointToSvg(svg, event.clientX, event.clientY);
      if (!startPoint) return;

      const start = startPlanFieldResizeDrag({
        available: canEditPlanDimensions,
        geometryPlanDimensions,
        legacyPlanDimensions: legacyPlanModel,
        editableFieldMap,
        meta,
        pointerId: event.pointerId,
        startSvgPoint: startPoint,
      });
      if (!start.ok) return;

      setFootprintError(null);
      setFieldError(null);
      setPlanActiveResizeFieldId(meta.fieldId);
      setPlanHoveredResizeFieldId(meta.fieldId);
      setPlanFieldDragSession(start.session);
    },
    [canEditPlanDimensions, editableFieldMap, geometryPlanDimensions, legacyPlanModel],
  );

  const drawOutlineActiveForPointerListeners = isDrawOutlineActive(drawOutlineState);

  useEffect(() => {
    if (!drawOutlineActiveForPointerListeners) return;

    const handlePointerMove = (event: PointerEvent) => {
      const result = moveDrawOutlinePointerSession({
        session: drawOutlinePointerSessionRef.current,
        state: drawOutlineState,
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        panThresholdPx: DRAW_OUTLINE_PAN_THRESHOLD_PX,
      });
      if (result.kind === 'session_update') {
        drawOutlinePointerSessionRef.current = result.session;
        setDrawOutlinePointerSession(result.session);
        setDrawOutlineState(result.transition.state);
      }
    };

    const handlePointerEnd = (event: PointerEvent) => {
      const result = endDrawOutlinePointerSession({
        session: drawOutlinePointerSessionRef.current,
        pointerId: event.pointerId,
        eventType: event.type === 'pointerup' ? 'pointerup' : 'pointercancel',
      });
      if (result.kind === 'noop') return;
      drawOutlinePointerSessionRef.current = null;
      setDrawOutlinePointerSession(null);
      if (result.kind === 'select_point') handleDrawOutlinePointSelect(result.point);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [drawOutlineActiveForPointerListeners, drawOutlineState, handleDrawOutlinePointSelect]);

  useEffect(() => {
    if (activeTouchCount <= 0 || deckDragLocked) return;

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
      const result = resolveModelSpacePinchMove({
        state: navigationState,
        session,
        first,
        second,
        currentAnchor: anchor,
      });
      if (result.transform) updateViewportTransform(result.transform);
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
  }, [activeTouchCount, clearTouchNavigation, deckDragLocked, navigationState, resolveViewportAnchor, updateViewportTransform]);

  useEffect(() => {
    if (!panDragSession || deckDragLocked) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== panDragSession.pointerId) return;
      const result = resolveModelSpacePanMove({
        state: navigationState,
        session: panDragSession,
        clientX: event.clientX,
        clientY: event.clientY,
      });
      if (result.transform) updateViewportTransform(result.transform);
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
  }, [deckDragLocked, navigationState, panDragSession, updateViewportTransform]);

  useEffect(() => {
    if (!footprintDragSession || !onCommitFootprintEdit) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== footprintDragSession.pointerId) return;
      const svg = footprintSvgRef.current;
      if (!svg) return;
      const nextPoint = clientPointToSvg(svg, event.clientX, event.clientY);
      if (!nextPoint) return;
      const intent = resolveFootprintHandleDragIntent({
        session: footprintDragSession,
        nextSvgPoint: nextPoint,
      });
      if (intent.kind === 'footprint_edit') void commitFootprintEdit(intent.edit);
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
      const intent = resolveFootprintVertexDragIntent({
        session: footprintVertexDragSession,
        nextSvgPoint: nextPoint,
      });
      if (intent.kind === 'footprint_edit') void commitFootprintEdit(intent.edit);
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

      const intent = resolvePlanFieldResizeDrag({
        session: planFieldDragSession,
        nextSvgPoint: nextPoint,
      });
      if (intent.kind === 'field_commit') void commitFieldEdit(intent.field, intent.nextValue);
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
    if (!onCommitDeckDimension) return;

    const handlePointerMove = (event: PointerEvent) => {
      const activeDeckDragSession = deckDragSessionRef.current;
      if (!activeDeckDragSession) return;
      if (event.pointerId !== activeDeckDragSession.pointerId) return;
      event.preventDefault();
      restoreDeckDragPinnedScrollTargets();
      const moveState = resolveObjectInteractionMove({
        session: activeDeckDragSession,
        clientX: event.clientX,
        clientY: event.clientY,
        thresholdPx: OBJECT_DRAG_INTENT_THRESHOLD_PX,
      });
      if (!moveState.crossedDragThreshold) return;
      if (moveState.nextPhase !== activeDeckDragSession.phase) {
        const nextSession = setObjectInteractionPhase(activeDeckDragSession, moveState.nextPhase);
        deckDragSessionRef.current = nextSession;
        setDeckDragSession(nextSession);
        deckDragPhaseRef.current = moveState.nextPhase;
        setDeckDragPhase(moveState.nextPhase);
      }
      const svg = footprintSvgRef.current;
      if (!svg) return;
      const nextPoint = clientPointToSvg(svg, event.clientX, event.clientY);
      if (!nextPoint) return;
      const projectionBackedDeckDrag = isProjectionBackedDeckDrag(activeDeckDragSession);
      const resolvedNextDragPlanPoint = resolveDeckDragPlanPoint({
        clientX: event.clientX,
        clientY: event.clientY,
        projectionBackedDeckDrag,
        deckDragPointResolver: deckDragPointResolverRef.current,
        legacyPlanPointResolver: planPointResolverRef.current,
      });
      const nextDragPlanPoint =
        resolvedNextDragPlanPoint ??
        (activeDeckDragSession.startDragPlanPoint ? lastResolvedDeckDragPlanPointRef.current : null);
      if (projectionBackedDeckDrag && !nextDragPlanPoint) return;
      if (resolvedNextDragPlanPoint) {
        lastResolvedDeckDragPlanPointRef.current = resolvedNextDragPlanPoint;
      }
      const preview = moveDeckMoveTool({
        session: activeDeckDragSession,
        pointer: {
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
          svgPoint: nextPoint,
          planPoint: nextDragPlanPoint,
        },
        previousPreviewState: deckPreviewStateRef.current,
      });
      setDeckPreviewState(preview);
    };

    const finishDrag = async (event: PointerEvent) => {
      const activeDeckDragSession = deckDragSessionRef.current;
      if (!activeDeckDragSession) return;
      if (event.pointerId !== activeDeckDragSession.pointerId) return;
      if (deckDragPhaseRef.current === 'drag-intent') {
        event.preventDefault();
        releaseDeckDragPointer(event.pointerId);
        resetDeckDragInteraction({ suppressClick: true });
        return;
      }
      if (deckDragPhaseRef.current !== 'dragging') return;
      event.preventDefault();
      releaseDeckDragPointer(event.pointerId);
      restoreDeckDragPinnedScrollTargets();
      const preview = deckPreviewStateRef.current;
      lastResolvedDeckDragPlanPointRef.current = null;
      if (!preview) {
        finalizeDeckDragSettlement();
        return;
      }
      const commitStartedAtMs = Date.now();
      const deckMoveRelease = releaseDeckMoveTool({
        session: activeDeckDragSession,
        preview,
      });
      const commitSource = deckMoveRelease.commitSource;
      const commitTransform = deckMoveRelease.commitTransform;
      deckDragPhaseRef.current = 'settling';
      setDeckDragPhase('settling');
      setDeckDragSettleState(createDeckReleaseSettleState({
        deckId: activeDeckDragSession.deckId,
        previewState: preview,
        commitStartedAtMs,
        commitSource,
        commitTransform,
        coordinateTrace: deckMoveRelease.coordinateTrace,
      }));
      let result: { ok: boolean; error?: string };
      try {
        result = await resolveCommitResult(
          onCommitDeckDimension(
            deckMoveRelease.target.objectId,
            deckMoveRelease.patch,
          ),
        );
      } catch (error) {
        result = {
          ok: false,
          error: error instanceof Error ? error.message : 'Unable to update the deck position.',
        };
      }
      const releaseError = result.ok ? null : result.error ?? 'Unable to update the deck position.';
      setFieldError(result.ok ? null : releaseError);
      if (result.ok) setFootprintError(null);
      setDeckDragSettleState((current) =>
        current && current.deckId === activeDeckDragSession.deckId
          ? resolveDeckCommitSettleState({
              state: current,
              ok: result.ok,
              error: releaseError,
              resolvedAtMs: Date.now(),
            })
          : current,
      );
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', finishDrag, { passive: false });
    window.addEventListener('pointercancel', finishDrag, { passive: false });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };
  }, [
    finalizeDeckDragSettlement,
    onCommitDeckDimension,
    releaseDeckDragPointer,
    restoreDeckDragPinnedScrollTargets,
  ]);

  useEffect(() => {
    if (!openingDragSession || !onCommitOpeningDimension) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== openingDragSession.pointerId) return;
      const svg = footprintSvgRef.current;
      if (!svg) return;
      const nextPoint = clientPointToSvg(svg, event.clientX, event.clientY);
      if (!nextPoint) return;
      const preview = moveOpeningMoveTool({
        session: openingDragSession,
        pointer: {
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
          svgPoint: nextPoint,
          planPoint: null,
        },
      });
      setOpeningPreviewState(preview);
    };

    const finishDrag = async (event: PointerEvent) => {
      if (event.pointerId !== openingDragSession.pointerId) return;
      const preview = openingPreviewState;
      setOpeningDragSession(null);
      setOpeningPreviewState(null);
      if (!preview) return;

      const commit = releaseOpeningMoveTool({
        session: openingDragSession,
        preview,
      });
      const result = await resolveCommitResult(
        onCommitOpeningDimension(commit.target.objectId, commit.patch),
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
  }, [onCommitOpeningDimension, openingDragSession, openingPreviewState]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableKeyboardTarget(event.target)) return;

      if (isDrawOutlineActive(drawOutlineState)) {
        const activeState = drawOutlineState;
        if (isDrawOutlineDistanceKey(event) && activeState.points.length > 0) {
          event.preventDefault();
          setFootprintError(null);
          setDrawOutlineState((current) => setDrawOutlineDistanceDraft(current, appendDrawOutlineDistanceDraft(activeState.distanceDraft, event.key)).state);
          return;
        }
        if (event.key === 'Enter') {
          if (!activeState.distanceDraft) return;
          event.preventDefault();
          const result = armDrawOutlineDistanceLockController(drawOutlineState);
          if (result.error) {
            setFootprintError(result.error);
            return;
          }
          applyDrawOutlineTransition(result);
          return;
        }
        if (event.key === 'Backspace') {
          event.preventDefault();
          if (activeState.distanceDraft) {
            setFootprintError(null);
            setDrawOutlineState((current) => setDrawOutlineDistanceDraft(current, activeState.distanceDraft.slice(0, -1)).state);
            return;
          }
          handleDrawOutlineUndo();
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          if (activeState.distanceDraft) {
            setFootprintError(null);
            setDrawOutlineState((current) => setDrawOutlineDistanceDraft(current, '').state);
            return;
          }
          handleDrawOutlineCancel();
          return;
        }
      }
      if (event.key !== 'Escape') return;
      if (deckDragSession) {
        event.preventDefault();
        resetDeckDragInteraction({ suppressClick: true });
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
    handleDrawOutlineUndo,
    openingDragSession,
    resetDeckDragInteraction,
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
      ? 'drag-cancelled'
      : 'click-candidate'
    : 'idle';
  const modelSpaceGesture: ModelSpaceGesture =
    drawOutlineGesture === 'click-candidate'
      ? 'draw-click-candidate'
      : pinchZoomActive
        ? pinchSource === 'webkit-gesture'
          ? 'trackpad-pinch'
          : 'pinch-zoom'
        : panDragSession
          ? 'mouse-pan'
          : viewportNavigationGesture;
  const drawOutlineHasError = drawOutlineViewModel.diagnosticState === 'error';
  const drawOutlineDiagnosticState = drawOutlineViewModel.diagnosticState;
  const drawOutlineTypingDistanceDraft = activeDrawOutlineState?.distanceDraft ?? '';
  const showDrawOutlineDistanceHud = Boolean(activeDrawOutlineState && drawOutlineTypingDistanceDraft);
  const drawOutlineLockedDistanceDraft = drawOutlineViewModel.lockedDistanceDraft;
  const drawOutlinePreviewSource = drawOutlineViewModel.previewSource;
  const isCustomPolygonFootprint = view === 'plan' && (legacyPlanModel?.houseFootprintMode ?? 'preset') === 'custom_polygon';
  const hasExistingCustomPolygon = isCustomPolygonFootprint && (legacyPlanModel?.houseFootprintPolygon?.length ?? 0) >= 3;
  const hasDeckSeedPolygon = deckOutlineMode && (drawOutlineSeedPolygon?.length ?? 0) >= 3;
  const canRedrawDrawOutline =
    ((canEditFootprint && hasExistingCustomPolygon) || (canCommitCustomPolygon && hasDeckSeedPolygon)) &&
    !drawOutlineViewModel.isActive;
  const drawOutlineRedrawActive = drawOutlineViewModel.isActive && (hasExistingCustomPolygon || hasDeckSeedPolygon);
  const drawOutlineDraftSource = drawOutlineViewModel.isActive ? 'active-draft' : legacyPlanModel?.houseConnectionType === 'none' ? 'none' : 'persisted';

  const handleDrawOutlineRedraw = useCallback(() => {
    if (!canRedrawDrawOutline) return;
    startDrawOutlineSession();
  }, [canRedrawDrawOutline, startDrawOutlineSession]);

  useEffect(() => {
    if (!drawOutlineViewModel.isActive && drawOutlineLandingPoint) setDrawOutlineLandingPoint(null);
  }, [drawOutlineLandingPoint, drawOutlineViewModel.isActive]);

  useEffect(() => {
    if (!autoFitOnReady) return;
    if (deckDragLocked) return;
    if (!modelSpaceAutoFitReady) return;
    if (autoFitKeyRef.current === modelSpaceAutoFitKey) return;
    if (fitViewportToContent()) autoFitKeyRef.current = modelSpaceAutoFitKey;
  }, [autoFitOnReady, deckDragLocked, fitViewportToContent, modelSpaceAutoFitKey, modelSpaceAutoFitReady]);

  useEffect(() => {
    if (!showDrawOutlineDistanceHud) {
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
  }, [drawOutlinePopoverAnchorPointCount, showDrawOutlineDistanceHud, viewportTransform.panX, viewportTransform.panY, zoom]);

  const objectWorkbenchPlanOverlay =
    showPlanViewport && !drawOutlineViewModel.isActive ? planViewModel?.objectWorkbenchOverlay ?? null : null;
  const selectedDeckShape = useMemo(
    () =>
      objectWorkbenchPlanOverlay?.shapes.find(
        (shape) =>
          shape.ownerKind === 'deck' &&
          shape.selected &&
          (!hasGeometryReadyPlan || shape.source === 'top_projection_committed'),
      ) ?? null,
    [hasGeometryReadyPlan, objectWorkbenchPlanOverlay],
  );
  const selectedOpeningShape = useMemo(
    () =>
      objectWorkbenchPlanOverlay?.shapes.find(
        (shape) =>
          shape.ownerKind === 'opening' &&
          shape.selected &&
          (!hasGeometryReadyPlan || shape.source === 'top_projection_committed'),
      ) ?? null,
    [hasGeometryReadyPlan, objectWorkbenchPlanOverlay],
  );
  const settledDeckShape = useMemo(
    () =>
      deckDragSettleState
        ? objectWorkbenchPlanOverlay?.shapes.find(
            (shape) => shape.ownerKind === 'deck' && shape.ownerId === deckDragSettleState.deckId,
          ) ?? null
        : null,
    [deckDragSettleState, objectWorkbenchPlanOverlay],
  );
  const requiresCanonicalDeckSettleMatch = objectWorkbenchPlanOverlay?.housePolygonSource === 'geometry_projection';
  const deckSettleMatch = useMemo(
    () => resolveDeckSettleMatch({
      settleState: deckDragSettleState,
      settledDeckShape,
    }),
    [deckDragSettleState, settledDeckShape],
  );
  const settledDeckShapeMatchesPreview = deckSettleMatch.matches;
  const selectedDeckRelationshipDimensionsAvailable = useMemo(
    () =>
      selectedDeckShape
        ? (objectWorkbenchPlanOverlay?.presetAnnotations ?? []).some(
            (annotation) =>
              annotation.ownerKind === 'deck' &&
              annotation.ownerId === selectedDeckShape.ownerId &&
              annotation.targetKind === 'deck_host_edge_reference',
          )
        : false,
    [objectWorkbenchPlanOverlay, selectedDeckShape],
  );
  const selectedDeckId = selectedDeckShape?.ownerId ?? null;
  const selectedDeckCapability = useMemo<DeckInteractionCapability | null>(
    () =>
      selectedDeckShape
        ? buildDeckInteractionCapabilityFromSelection({
            custom: selectedDeckShape.custom,
            interactionPlacement: selectedDeckShape.deckInteraction?.placement ?? null,
            dragEligible: selectedDeckShape.deckDragEligibility?.eligible ?? false,
            dragReason: selectedDeckShape.deckDragEligibility?.reason ?? null,
            hostEdgeResolvable: Boolean(selectedDeckShape.deckInteraction),
            relationshipDimensionsAvailable: selectedDeckRelationshipDimensionsAvailable,
          })
        : null,
    [selectedDeckRelationshipDimensionsAvailable, selectedDeckShape],
  );
  const deckInteractionViewState = useMemo(
    () =>
      buildDeckInteractionViewState({
        capability: selectedDeckCapability,
        selectedDeckShape: selectedDeckShape
          ? {
              custom: selectedDeckShape.custom,
              deckInteraction: selectedDeckShape.deckInteraction,
            }
          : null,
        phase: deckDragPhase,
        previewState: deckPreviewState,
        dragSession: deckDragSession,
        hovered: hoveredDeckId === selectedDeckId,
        releaseState:
          deckDragSettleState
            ? {
                outcome: deckDragSettleState.releaseOutcome,
                releasePlacement: deckDragSettleState.releasePlacement,
                settleVisualState: deckDragSettleState.settleVisualState,
                errorDetail: deckDragSettleState.releaseError,
                previewState:
                  deckDragSettleState.releaseOutcome === 'failed' ||
                  deckDragSettleState.settleVisualState === 'complete'
                    ? null
                    : deckDragSettleState.previewState,
              }
            : deckReleaseFeedbackState
              ? {
                  outcome: deckReleaseFeedbackState.releaseOutcome,
                  releasePlacement: deckReleaseFeedbackState.releasePlacement,
                  settleVisualState: deckReleaseFeedbackState.settleVisualState,
                  errorDetail: deckReleaseFeedbackState.releaseError,
                  previewState: deckReleaseFeedbackState.previewState,
                }
              : null,
      }),
    [
      deckDragPhase,
      deckDragSession,
      deckDragSettleState,
      deckPreviewState,
      deckReleaseFeedbackState,
      hoveredDeckId,
      selectedDeckCapability,
      selectedDeckId,
      selectedDeckShape,
    ],
  );
  const openingInteractionViewState = useMemo<ObjectInteractionViewState | null>(() => {
    return buildOpeningInteractionViewState({
      selectedOpeningShape,
      dragSession: openingDragSession,
      previewState: openingPreviewState,
    });
  }, [openingDragSession, openingPreviewState, selectedOpeningShape]);
  const openingInteractionTelemetry = useMemo(
    () =>
      buildOpeningInteractionTelemetry({
        selectedOpeningId: selectedOpeningShape?.ownerId ?? null,
        viewState: openingInteractionViewState,
      }),
    [openingInteractionViewState, selectedOpeningShape?.ownerId],
  );
  const deckInteractionHud = useMemo(
    () => buildObjectInteractionHudModel(deckInteractionViewState),
    [deckInteractionViewState],
  );
  const deckInteractionTelemetry = useMemo(
    () =>
      buildDeckInteractionTelemetry({
        selectedDeckId,
        hoveredDeckId,
        housePolygonSource: objectWorkbenchPlanOverlay?.housePolygonSource ?? null,
        capability: selectedDeckCapability,
        viewState: deckInteractionViewState,
        selectedDeckShape: selectedDeckShape
          ? {
              custom: selectedDeckShape.custom,
              deckInteraction: selectedDeckShape.deckInteraction,
            }
          : null,
        previewState: deckPreviewState,
        releaseCommitSource: deckDragSettleState?.commitSource ?? deckReleaseFeedbackState?.commitSource ?? 'none',
        settleMatchSource: deckDragSettleState?.settleMatchSource ?? deckReleaseFeedbackState?.settleMatchSource ?? 'none',
        projectionSettleStatus: deckDragSettleState?.projectionSettleStatus ?? deckReleaseFeedbackState?.projectionSettleStatus ?? 'none',
      }),
    [
      deckDragSettleState,
      deckInteractionViewState,
      deckPreviewState,
      deckReleaseFeedbackState,
      hoveredDeckId,
      objectWorkbenchPlanOverlay?.housePolygonSource,
      selectedDeckCapability,
      selectedDeckId,
      selectedDeckShape,
    ],
  );
  const activeDeckPreviewState = useMemo(() => {
    return resolveDeckReleasePreview({
      settleState: deckDragSettleState,
      previewState: deckPreviewState,
      feedbackState: deckReleaseFeedbackState,
    });
  }, [deckDragSettleState, deckPreviewState, deckReleaseFeedbackState]);
  const activeDeckCoordinateTrace =
    deckDragSettleState?.coordinateTrace ?? deckReleaseFeedbackState?.coordinateTrace ?? null;
  const deckTracePreviewToCommitDelta = activeDeckCoordinateTrace?.centroidDeltaM.previewToCommit ?? null;
  const deckTraceReleaseToRebuiltDelta = activeDeckCoordinateTrace?.centroidDeltaM.releaseToRebuilt ?? null;
  const deckTraceStatus = !activeDeckCoordinateTrace
    ? 'none'
    : !activeDeckCoordinateTrace.rebuiltProjectionPolygon
      ? 'pending'
      : !deckTraceReleaseToRebuiltDelta
        ? 'pending'
        : Math.hypot(deckTraceReleaseToRebuiltDelta.x, deckTraceReleaseToRebuiltDelta.y) <= 0.1
          ? 'matched'
          : 'drift';
  const objectWorkbenchPreviewOverlay = useMemo<ObjectWorkbenchPreviewOverlay | null>(
    () => {
      if (deckDragPhase === 'drag-intent' && deckDragSession) {
        return buildObjectInteractionPreviewOverlay({
          ownerKind: 'deck',
          ownerId: deckDragSession.deckId,
          polygon: deckDragSession.startPolygon,
          viewState: deckInteractionViewState,
          anchorPoint: deckInteractionViewState.previewAnchor,
        });
      }
      if (activeDeckPreviewState) {
        const showTargetHighlight =
          activeDeckPreviewState.releasePlacement === 'snapped' || deckInteractionViewState.referenceGuideState === 'snap-lane';
        return buildObjectInteractionPreviewOverlay({
          ownerKind: 'deck',
          ownerId: activeDeckPreviewState.deckId,
          polygon: activeDeckPreviewState.polygon,
          viewState: deckInteractionViewState,
          anchorPoint: deckInteractionViewState.previewAnchor,
          lockedCornerPoint: activeDeckPreviewState.lockedCornerPoint,
          endCatchPoint: activeDeckPreviewState.endCatchPoint,
          referenceGuide: activeDeckPreviewState.referenceGuide,
          targetHighlights: showTargetHighlight
            ? [
                {
                  start: activeDeckPreviewState.hostEdgeStart,
                  end: activeDeckPreviewState.hostEdgeEnd,
                  state: resolveObjectInteractionPreviewTargetState(deckInteractionViewState),
                },
                ...(activeDeckPreviewState.secondaryHostEdgeStart && activeDeckPreviewState.secondaryHostEdgeEnd
                  ? [
                      {
                        start: activeDeckPreviewState.secondaryHostEdgeStart,
                        end: activeDeckPreviewState.secondaryHostEdgeEnd,
                        state: resolveObjectInteractionPreviewTargetState(deckInteractionViewState),
                      },
                    ]
                  : []),
              ]
            : null,
        });
      }
      if (openingPreviewState && openingDragSession && openingInteractionViewState) {
        return buildObjectInteractionPreviewOverlay({
          ownerKind: 'opening',
          ownerId: openingPreviewState.openingId,
          polygon: openingPreviewState.polygon,
          viewState: openingInteractionViewState,
          targetHighlights: [
            {
              start: openingDragSession.interaction.hostEdgeStart,
              end: openingDragSession.interaction.hostEdgeEnd,
              state: resolveObjectInteractionPreviewTargetState(openingInteractionViewState),
            },
          ],
        });
      }
      return null;
    },
    [
      deckDragPhase,
      deckDragSession,
      activeDeckPreviewState,
      deckInteractionViewState,
      openingDragSession,
      openingInteractionViewState,
      openingPreviewState,
    ],
  );

  useEffect(() => {
    if (deckDragPhase !== 'settling' || !deckDragSession || !deckDragSettleState) return;

    let cancelled = false;
    let finalizeAnimationFrameId: number | null = null;

    const observeSettlement = () => {
      finalizeAnimationFrameId = window.requestAnimationFrame(() => {
        if (cancelled) return;
        const drift = measureDeckDragViewportAnchorDrift();
        const viewportStable = isDeckDragViewportAnchorStable(drift);
        const advancement = advanceDeckReleaseSettleState({
          state: deckDragSettleState,
          match: deckSettleMatch,
          viewportStable,
          requiresCanonicalMatch: requiresCanonicalDeckSettleMatch,
          nowMs: Date.now(),
        });
        if (advancement.restorePinnedScrollTargets) {
          restoreDeckDragPinnedScrollTargets();
        }
        if (advancement.state !== deckDragSettleState) {
          setDeckDragSettleState((current) =>
            current && current.deckId === deckDragSettleState.deckId
              ? advancement.state
              : current,
          );
        }
        if (advancement.finalizeOutcome === 'failed' && advancement.releaseFeedback) {
          cancelled = true;
          finalizeDeckDragSettlement(advancement.releaseFeedback);
          return;
        }
        if (advancement.finalizeOutcome === 'committed' && advancement.releaseFeedback) {
          cancelled = true;
          finalizeDeckDragSettlement(advancement.releaseFeedback, { suppressClick: false });
          return;
        }
        observeSettlement();
      });
    };

    observeSettlement();

    return () => {
      cancelled = true;
      if (finalizeAnimationFrameId !== null) {
        window.cancelAnimationFrame(finalizeAnimationFrameId);
      }
    };
  }, [
    deckDragPhase,
    deckDragSession,
    deckDragSettleState,
    deckSettleMatch,
    finalizeDeckDragSettlement,
    isDeckDragViewportAnchorStable,
    measureDeckDragViewportAnchorDrift,
    restoreDeckDragPinnedScrollTargets,
    requiresCanonicalDeckSettleMatch,
  ]);

  useEffect(() => {
    if (!onDeckInteractionTelemetryChange) {
      return;
    }
    const signature = [
      deckInteractionTelemetry.selectedDeckId ?? '',
      deckInteractionTelemetry.housePolygonSource ?? '',
      deckInteractionTelemetry.selectedDeckType,
      deckInteractionTelemetry.dragEligible ? '1' : '0',
      deckInteractionTelemetry.dragReason ?? '',
      deckInteractionTelemetry.hostEdgeResolvable ? '1' : '0',
      deckInteractionTelemetry.relationshipDimensionsAvailable ? '1' : '0',
      deckInteractionTelemetry.phase,
      deckInteractionTelemetry.placementState,
      deckInteractionTelemetry.releaseOutcome,
      deckInteractionTelemetry.releasePlacement ?? '',
      deckInteractionTelemetry.settleVisualState ?? '',
      deckInteractionTelemetry.hoveredDeckId ?? '',
      deckInteractionTelemetry.affordanceState,
      deckInteractionTelemetry.referenceGuideState,
      deckInteractionTelemetry.canCommit ? '1' : '0',
      deckInteractionTelemetry.highlightTargetId ?? '',
      deckInteractionTelemetry.previewAnchor
        ? `${deckInteractionTelemetry.previewAnchor.x},${deckInteractionTelemetry.previewAnchor.y}`
        : '',
      deckInteractionTelemetry.snapState,
      deckInteractionTelemetry.snapMessage ?? '',
      deckInteractionTelemetry.interactionState,
      deckInteractionTelemetry.interactionLabel ?? '',
    ].join('|');
    if (lastDeckTelemetrySignatureRef.current === signature) {
      return;
    }
    lastDeckTelemetrySignatureRef.current = signature;
    onDeckInteractionTelemetryChange(deckInteractionTelemetry);
  }, [
    deckInteractionTelemetry,
    onDeckInteractionTelemetryChange,
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
    if (!deckDragLocked) return;

    const preventDefaultOnly = (event: Event) => {
      event.preventDefault();
    };
    const preventSelectionEvent = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (activeDeckDragPointerIdRef.current !== null && event.pointerId !== activeDeckDragPointerIdRef.current) return;
      preventDefaultOnly(event);
    };
    const handlePointerEnd = (event: PointerEvent) => {
      if (activeDeckDragPointerIdRef.current !== null && event.pointerId !== activeDeckDragPointerIdRef.current) return;
      preventDefaultOnly(event);
    };
    const restorePinnedViewport = () => {
      restoreDeckDragPinnedScrollTargets();
    };
    const scrollTargets = deckDragViewportAnchorRef.current?.scrollTargets.map((target) => target.node) ?? [];

    window.addEventListener('pointermove', handlePointerMove, { passive: false, capture: true });
    window.addEventListener('pointerup', handlePointerEnd, { passive: false, capture: true });
    window.addEventListener('pointercancel', handlePointerEnd, { passive: false, capture: true });
    window.addEventListener('wheel', preventDefaultOnly, { passive: false, capture: true });
    window.addEventListener('touchmove', preventDefaultOnly, { passive: false, capture: true });
    document.addEventListener('selectstart', preventSelectionEvent, true);
    document.addEventListener('dragstart', preventSelectionEvent, true);
    for (const target of scrollTargets) {
      target.addEventListener('scroll', restorePinnedViewport, { passive: true });
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove, true);
      window.removeEventListener('pointerup', handlePointerEnd, true);
      window.removeEventListener('pointercancel', handlePointerEnd, true);
      window.removeEventListener('wheel', preventDefaultOnly, true);
      window.removeEventListener('touchmove', preventDefaultOnly, true);
      document.removeEventListener('selectstart', preventSelectionEvent, true);
      document.removeEventListener('dragstart', preventSelectionEvent, true);
      for (const target of scrollTargets) {
        target.removeEventListener('scroll', restorePinnedViewport);
      }
    };
  }, [deckDragLocked, restoreDeckDragPinnedScrollTargets]);

  useEffect(() => {
    if (!objectWorkbenchPlanOverlay?.customEdgeCandidates.some((candidate) => candidate.id === objectWorkbenchActiveCustomEdgeId)) {
      setObjectWorkbenchActiveCustomEdgeId(null);
    }
  }, [objectWorkbenchActiveCustomEdgeId, objectWorkbenchPlanOverlay]);

  useEffect(() => {
    if (!deckDragSession) return;
    const overlayShapes = objectWorkbenchPlanOverlay?.shapes;
    if (!overlayShapes) return;
    const draggedDeckStillVisible = overlayShapes.some(
      (shape) => shape.ownerKind === 'deck' && shape.ownerId === deckDragSession.deckId,
    );
    if (!draggedDeckStillVisible) {
      resetDeckDragInteraction();
    }
  }, [deckDragSession, objectWorkbenchPlanOverlay, resetDeckDragInteraction]);

  useEffect(() => {
    if (!openingDragSession) return;
    const overlayShapes = objectWorkbenchPlanOverlay?.shapes;
    if (!overlayShapes) return;
    const selectedOpeningStillVisible = overlayShapes.some(
      (shape) => shape.ownerKind === 'opening' && shape.ownerId === openingDragSession.openingId && shape.selected,
    );
    if (!selectedOpeningStillVisible) {
      setOpeningDragSession(null);
      setOpeningPreviewState(null);
    }
  }, [objectWorkbenchPlanOverlay, openingDragSession]);

  useEffect(() => {
    if (!objectWorkbenchDimensionEditor) return;
    const annotationId = objectWorkbenchDimensionEditor.annotation.id;
    const stillVisible = Boolean(
      objectWorkbenchPlanOverlay?.presetAnnotations.some((annotation) => annotation.id === annotationId) ||
        objectWorkbenchPlanOverlay?.customEdgeCandidates.some((annotation) => annotation.id === annotationId),
    );
    if (!stillVisible) closeObjectWorkbenchDimensionEditor();
  }, [closeObjectWorkbenchDimensionEditor, objectWorkbenchDimensionEditor, objectWorkbenchPlanOverlay]);

  useEffect(() => {
    const annotation = objectWorkbenchDimensionEditor?.annotation;
    const scroller = scrollerRef.current;
    const popover = dimensionPopoverRef.current;
    if (!annotation || !scroller || !popover) {
      setObjectWorkbenchDimensionPopoverPosition(null);
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
      setObjectWorkbenchDimensionPopoverPosition(null);
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
      setObjectWorkbenchDimensionPopoverPosition(null);
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
    setObjectWorkbenchDimensionPopoverPosition({ left, top });
  }, [objectWorkbenchDimensionEditor, viewportTransform.panX, viewportTransform.panY, zoom]);

  const objectWorkbenchDimensionPopoverStyle = useMemo(
    () =>
      objectWorkbenchDimensionPopoverPosition
        ? {
            left: `${objectWorkbenchDimensionPopoverPosition.left}px`,
            top: `${objectWorkbenchDimensionPopoverPosition.top}px`,
          }
        : undefined,
    [objectWorkbenchDimensionPopoverPosition],
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
      customPolygonLockedDistanceM:
        drawOutlineLockedDistanceDraft && Number.isFinite(Number.parseFloat(drawOutlineLockedDistanceDraft))
          ? Number.parseFloat(drawOutlineLockedDistanceDraft)
          : null,
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
    drawOutlineLockedDistanceDraft,
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

  useEffect(() => {
    if (view === 'plan' && hasGeometryReadyPlan) return;
    planPointResolverRef.current = null;
    deckDragPointResolverRef.current = null;
  }, [hasGeometryReadyPlan, view]);

  const planInteraction = useMemo<ModulePlanInteractionProps | undefined>(() => {
    if (view !== 'plan' || !hasGeometryReadyPlan) return undefined;
    return {
      available: canEditPlanDimensions,
      hoveredResizeFieldId: planHoveredResizeFieldId,
      activeResizeFieldId: planActiveResizeFieldId,
      onResizeFieldHover: (fieldId) => {
        if (!canEditPlanDimensions) return;
        setPlanHoveredResizeFieldId(fieldId);
      },
      onResizeFieldDragStart: (meta, event) => {
        if (!canEditPlanDimensions) return;
        handlePlanFieldDragStart(meta, event);
      },
      onPlanPointResolverChange: (resolver) => {
        planPointResolverRef.current = resolver;
      },
      onDeckDragPointResolverChange: (resolver) => {
        deckDragPointResolverRef.current = resolver;
      },
      onSvgMount: (node) => {
        footprintSvgRef.current = node;
      },
    };
  }, [canEditPlanDimensions, handlePlanFieldDragStart, hasGeometryReadyPlan, planActiveResizeFieldId, planHoveredResizeFieldId, view]);

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
        data-drawing-surface-source={drawingSurfaceGeometry?.source ?? 'missing'}
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
        data-draw-outline-preview-source={drawOutlinePreviewSource}
        data-draw-outline-distance-draft={drawOutlineTypingDistanceDraft}
        data-draw-outline-locked-distance-draft={drawOutlineLockedDistanceDraft ?? ''}
        data-draw-outline-length-locked={drawOutlineLockedDistanceDraft ? 'true' : 'false'}
        data-draw-outline-distance-hud-active={showDrawOutlineDistanceHud ? 'true' : 'false'}
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
        data-object-workbench-deck-drag-active={deckDragLocked ? 'true' : 'false'}
        data-house-first-deck-drag-active={deckDragLocked ? 'true' : 'false'}
        data-object-workbench-deck-drag-locked={deckDragLocked ? 'true' : 'false'}
        data-house-first-deck-drag-locked={deckDragLocked ? 'true' : 'false'}
        data-object-workbench-deck-drag-phase={deckInteractionViewState.phase}
        data-house-first-deck-drag-phase={deckInteractionViewState.phase}
        data-object-workbench-deck-placement-state={deckInteractionViewState.placementState}
        data-house-first-deck-placement-state={deckInteractionViewState.placementState}
        data-object-workbench-deck-affordance-state={deckInteractionViewState.affordanceState}
        data-house-first-deck-affordance-state={deckInteractionViewState.affordanceState}
        data-object-workbench-deck-reference-guide-state={deckInteractionViewState.referenceGuideState}
        data-house-first-deck-reference-guide-state={deckInteractionViewState.referenceGuideState}
        data-object-workbench-deck-release-outcome={deckInteractionViewState.releaseOutcome}
        data-house-first-deck-release-outcome={deckInteractionViewState.releaseOutcome}
        data-object-workbench-deck-release-placement={deckInteractionViewState.releasePlacement ?? 'none'}
        data-house-first-deck-release-placement={deckInteractionViewState.releasePlacement ?? 'none'}
        data-object-workbench-deck-settle-visual-state={deckInteractionViewState.settleVisualState ?? 'none'}
        data-house-first-deck-settle-visual-state={deckInteractionViewState.settleVisualState ?? 'none'}
        data-object-workbench-deck-settle-requires-canonical-match={requiresCanonicalDeckSettleMatch ? 'true' : 'false'}
        data-object-workbench-deck-settle-canonical-match={
          deckDragSettleState ? (settledDeckShapeMatchesPreview ? 'true' : 'false') : 'none'
        }
        data-object-workbench-deck-release-commit-source={
          deckDragSettleState?.commitSource ?? deckReleaseFeedbackState?.commitSource ?? 'none'
        }
        data-object-workbench-deck-settle-match-source={
          deckDragSettleState?.settleMatchSource ?? deckReleaseFeedbackState?.settleMatchSource ?? 'none'
        }
        data-object-workbench-deck-projection-settle-status={
          deckDragSettleState?.projectionSettleStatus ?? deckReleaseFeedbackState?.projectionSettleStatus ?? 'none'
        }
        data-deck-drag-source={deckDragSession?.dragSource ?? 'none'}
        data-deck-pointer-resolver-source={deckDragSession?.pointerResolverSource ?? 'none'}
        data-deck-drag-coordinate-space={deckDragSession?.dragCoordinateSpace ?? 'none'}
        data-deck-preview-source={deckPreviewState ? deckDragSession?.dragSource ?? 'none' : 'none'}
        data-deck-commit-source={deckDragSettleState?.commitSource ?? deckReleaseFeedbackState?.commitSource ?? 'none'}
        data-deck-render-frame-id={
          deckDragSettleState?.commitTransform.renderFrameId ?? deckReleaseFeedbackState?.commitTransform.renderFrameId ?? ''
        }
        data-deck-commit-frame-id={
          deckDragSettleState?.commitTransform.commitFrameId ?? deckReleaseFeedbackState?.commitTransform.commitFrameId ?? ''
        }
        data-deck-render-coordinate-space={
          deckDragSettleState?.commitTransform.renderCoordinateSpace ??
          deckReleaseFeedbackState?.commitTransform.renderCoordinateSpace ??
          'none'
        }
        data-deck-commit-coordinate-space={
          deckDragSettleState?.commitTransform.commitCoordinateSpace ??
          deckReleaseFeedbackState?.commitTransform.commitCoordinateSpace ??
          'none'
        }
        data-deck-commit-transform-source={
          deckDragSettleState?.commitTransform.transformSource ??
          deckReleaseFeedbackState?.commitTransform.transformSource ??
          'none'
        }
        data-deck-trace-render-coordinate-space={
          activeDeckCoordinateTrace?.transform.renderCoordinateSpace ?? 'none'
        }
        data-deck-trace-commit-coordinate-space={
          activeDeckCoordinateTrace?.transform.commitCoordinateSpace ?? 'none'
        }
        data-deck-trace-transform-source={
          activeDeckCoordinateTrace?.transform.transformSource ?? 'none'
        }
        data-deck-trace-preview-to-commit-delta-x={
          deckTracePreviewToCommitDelta ? formatHouseFootprintParamValue(deckTracePreviewToCommitDelta.x) : ''
        }
        data-deck-trace-preview-to-commit-delta-y={
          deckTracePreviewToCommitDelta ? formatHouseFootprintParamValue(deckTracePreviewToCommitDelta.y) : ''
        }
        data-deck-trace-release-to-rebuilt-delta-x={
          deckTraceReleaseToRebuiltDelta ? formatHouseFootprintParamValue(deckTraceReleaseToRebuiltDelta.x) : ''
        }
        data-deck-trace-release-to-rebuilt-delta-y={
          deckTraceReleaseToRebuiltDelta ? formatHouseFootprintParamValue(deckTraceReleaseToRebuiltDelta.y) : ''
        }
        data-deck-trace-status={deckTraceStatus}
        data-object-workbench-deck-snap-state={deckInteractionTelemetry.snapState}
        data-house-first-deck-snap-state={deckInteractionTelemetry.snapState}
        data-object-workbench-deck-attachment-mode={deckInteractionTelemetry.attachmentMode ?? 'floating'}
        data-house-first-deck-attachment-mode={deckInteractionTelemetry.attachmentMode ?? 'floating'}
        data-object-workbench-deck-secondary-host-edge-id={deckInteractionTelemetry.secondaryHostEdgeId ?? ''}
        data-house-first-deck-secondary-host-edge-id={deckInteractionTelemetry.secondaryHostEdgeId ?? ''}
        data-object-workbench-deck-corner-vertex-id={deckInteractionTelemetry.cornerVertexId ?? ''}
        data-house-first-deck-corner-vertex-id={deckInteractionTelemetry.cornerVertexId ?? ''}
        data-object-workbench-hovered-deck-id={hoveredDeckId ?? ''}
        data-house-first-hovered-deck-id={hoveredDeckId ?? ''}
        data-object-workbench-opening-drag-active={openingDragSession ? 'true' : 'false'}
        data-house-first-opening-drag-active={openingDragSession ? 'true' : 'false'}
        data-object-workbench-opening-drag-phase={openingInteractionViewState?.phase ?? 'idle'}
        data-house-first-opening-drag-phase={openingInteractionViewState?.phase ?? 'idle'}
        data-object-workbench-opening-placement-state={openingInteractionViewState?.placementState ?? 'none'}
        data-house-first-opening-placement-state={openingInteractionViewState?.placementState ?? 'none'}
        data-object-workbench-opening-affordance-state={openingInteractionViewState?.affordanceState ?? 'idle'}
        data-house-first-opening-affordance-state={openingInteractionViewState?.affordanceState ?? 'idle'}
        data-object-workbench-opening-reference-guide-state={openingInteractionViewState?.referenceGuideState ?? 'none'}
        data-house-first-opening-reference-guide-state={openingInteractionViewState?.referenceGuideState ?? 'none'}
        data-object-workbench-opening-release-outcome={openingInteractionViewState?.releaseOutcome ?? 'none'}
        data-house-first-opening-release-outcome={openingInteractionViewState?.releaseOutcome ?? 'none'}
        data-object-workbench-opening-release-placement={openingInteractionViewState?.releasePlacement ?? 'none'}
        data-house-first-opening-release-placement={openingInteractionViewState?.releasePlacement ?? 'none'}
        data-object-workbench-opening-highlight-target-id={openingInteractionTelemetry?.highlightTargetId ?? ''}
        data-house-first-opening-highlight-target-id={openingInteractionTelemetry?.highlightTargetId ?? ''}
        data-object-workbench-selected-deck-id={deckInteractionTelemetry.selectedDeckId ?? ''}
        data-house-first-selected-deck-id={deckInteractionTelemetry.selectedDeckId ?? ''}
        data-object-workbench-selected-deck-type={deckInteractionTelemetry.selectedDeckType}
        data-house-first-selected-deck-type={deckInteractionTelemetry.selectedDeckType}
        data-object-workbench-selected-deck-drag-eligible={deckInteractionTelemetry.dragEligible ? 'true' : 'false'}
        data-house-first-selected-deck-drag-eligible={deckInteractionTelemetry.dragEligible ? 'true' : 'false'}
        data-object-workbench-selected-deck-host-edge-resolvable={deckInteractionTelemetry.hostEdgeResolvable ? 'true' : 'false'}
        data-house-first-selected-deck-host-edge-resolvable={deckInteractionTelemetry.hostEdgeResolvable ? 'true' : 'false'}
        data-object-workbench-selected-deck-relationship-dims={
          deckInteractionTelemetry.relationshipDimensionsAvailable ? 'true' : 'false'
        }
        data-house-first-selected-deck-relationship-dims={
          deckInteractionTelemetry.relationshipDimensionsAvailable ? 'true' : 'false'
        }
        data-object-workbench-selected-deck-drag-reason={deckInteractionTelemetry.dragReason ?? ''}
        data-house-first-selected-deck-drag-reason={deckInteractionTelemetry.dragReason ?? ''}
        data-object-workbench-selected-deck-interaction-state={deckInteractionTelemetry.interactionState}
        data-house-first-selected-deck-interaction-state={deckInteractionTelemetry.interactionState}
        data-object-workbench-selected-opening-id={selectedOpeningShape?.ownerId ?? ''}
        data-house-first-selected-opening-id={selectedOpeningShape?.ownerId ?? ''}
        data-object-workbench-selected-opening-drag-eligible={
          selectedOpeningShape?.openingDragEligibility?.eligible ? 'true' : 'false'
        }
        data-house-first-selected-opening-drag-eligible={
          selectedOpeningShape?.openingDragEligibility?.eligible ? 'true' : 'false'
        }
        data-object-workbench-selected-opening-drag-reason={
          selectedOpeningShape?.openingDragEligibility?.reason ?? ''
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
        onClickCapture={handleScrollerClickCapture}
        onLostPointerCapture={handleScrollerLostPointerCapture}
        onPointerDownCapture={handleScrollerPointerDownCapture}
        onPointerMove={handleScrollerPointerMove}
        onPointerLeave={handleScrollerPointerLeave}
        onPointerDown={handleCanvasPanStart}
        onWheel={handleWheel}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div className={styles.canvasControls} onPointerDown={(event) => event.stopPropagation()}>
          <button type="button" className={styles.overlayButton} onClick={() => {
            if (deckDragLocked) return;
            handleZoomChange(-0.1);
          }}>
            -
          </button>
          <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
          <button type="button" className={styles.overlayButton} onClick={() => {
            if (deckDragLocked) return;
            handleZoomChange(0.1);
          }}>
            +
          </button>
          <button type="button" className={styles.overlayButton} onClick={() => {
            if (deckDragLocked) return;
            handleFitView();
          }}>
            Fit view
          </button>
        </div>

        {canRedrawDrawOutline ? (
          <div className={styles.drawRedrawBar} data-draw-outline-redraw-entry="true" onPointerDown={(event) => event.stopPropagation()}>
            <button type="button" className={styles.overlayButton} onClick={() => {
              if (deckDragLocked) return;
              handleDrawOutlineRedraw();
            }}>
              Redraw outline
            </button>
          </div>
        ) : null}

        {interactionError ? <p className={styles.error}>{interactionError}</p> : null}

        {deckInteractionHud.visible ? (
          <div
            className={`${styles.drawStatus} ${
              deckInteractionHud.tone === 'blocked'
                ? styles.interactionStatusBlocked
                : deckInteractionHud.tone === 'snapped'
                  ? styles.interactionStatusSnapped
                  : styles.interactionStatusReady
            }`}
            aria-label="Deck interaction hint"
          >
            <span className={styles.drawStatusText}>{deckInteractionHud.label}</span>
            {deckInteractionHud.detail ? (
              <span className={styles.drawStatusMeta}>{deckInteractionHud.detail}</span>
            ) : null}
          </div>
        ) : null}

        {showDrawOutlineDistanceHud ? (
          <div
            ref={drawPopoverRef}
            className={styles.drawDistanceHud}
            aria-label="Draw outline distance HUD"
            data-draw-outline-distance-hud="true"
            data-draw-distance-hud-anchor={drawPopoverPosition ? 'vertex' : 'default'}
            style={drawPopoverStyle}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <span className={styles.drawDistanceHudValue}>{drawOutlineTypingDistanceDraft}m</span>
            <span className={styles.drawDistanceHudMeta}>Enter to lock</span>
          </div>
        ) : null}

        {objectWorkbenchDimensionEditor ? (
          <div
            ref={dimensionPopoverRef}
            className={styles.dimensionPopover}
            aria-label="Edit plan dimension"
            style={objectWorkbenchDimensionPopoverStyle}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <label className={styles.popoverField}>
              <span className={styles.fieldLabel}>Dimension (m)</span>
              <input
                autoFocus
                className={styles.input}
                inputMode="decimal"
                value={objectWorkbenchDimensionEditor.value}
                onChange={(event) =>
                  setObjectWorkbenchDimensionEditor((current) =>
                    current
                      ? {
                          ...current,
                          value: event.target.value,
                        }
                      : current,
                  )
                }
                onBlur={() => {
                  if (!objectWorkbenchDimensionEditor) return;
                  void commitObjectWorkbenchDimensionEdit(objectWorkbenchDimensionEditor);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    closeObjectWorkbenchDimensionEditor();
                    return;
                  }
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  if (!objectWorkbenchDimensionEditor) return;
                  void commitObjectWorkbenchDimensionEdit(objectWorkbenchDimensionEditor);
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
                drawingSurfaceGeometry={drawingSurfaceGeometry}
                planModel={legacyPlanModel}
                sectionModel={legacySectionModel}
                presentation="model"
                displayMode={workbenchDisplayMode}
                visibility={visibility}
                currentPergolaId={activePergolaId}
                enableProjectionOnlyModelInteractions={enableProjectionOnlyModelInteractions}
                interactiveFields={showPlanViewport ? modelInteractiveFields : undefined}
                footprintEditor={showPlanViewport ? footprintEditor : undefined}
                planInteraction={showPlanViewport ? planInteraction : undefined}
                objectWorkbenchPlanOverlay={showPlanViewport ? objectWorkbenchPlanOverlay : null}
                objectWorkbenchPreviewOverlay={showPlanViewport ? objectWorkbenchPreviewOverlay : null}
                hoveredObjectWorkbenchDeckId={showPlanViewport ? hoveredDeckId : null}
                activeObjectWorkbenchCustomEdgeId={objectWorkbenchActiveCustomEdgeId}
                onObjectWorkbenchShapeSelect={showPlanViewport ? handleObjectWorkbenchShapeSelect : undefined}
                onObjectWorkbenchDeckHoverChange={showPlanViewport ? handleObjectWorkbenchDeckHoverChange : undefined}
                onPergolaSelect={showPlanViewport ? handlePergolaTargetSelect : undefined}
                onCanvasSelect={showPlanViewport ? handleWorkbenchCanvasSelect : undefined}
                onObjectWorkbenchShapeDragStart={showPlanViewport ? handleObjectWorkbenchShapeDragStart : undefined}
                onObjectWorkbenchCustomEdgeSelect={showPlanViewport ? handleObjectWorkbenchCustomEdgeSelect : undefined}
                onObjectWorkbenchDimensionActivate={showPlanViewport ? activateObjectWorkbenchDimensionEditor : undefined}
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
