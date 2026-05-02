import type { DrawingWorkbenchViewportTransform } from '@/lib/drawings/state/drawingWorkbenchUiState';

export type ModelSpaceRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ModelSpaceGesture =
  | 'idle'
  | 'mouse-pan'
  | 'wheel-pan'
  | 'wheel-zoom'
  | 'pinch-zoom'
  | 'trackpad-pinch'
  | 'draw-click-candidate';

export type ModelSpacePinchSource = 'none' | 'touch-pointer' | 'wheel' | 'webkit-gesture';

export type ModelSpaceNavigationState = {
  transform: DrawingWorkbenchViewportTransform;
  zoom: number;
  gesture: ModelSpaceGesture;
  pinchSource: ModelSpacePinchSource;
  deckDragLocked: boolean;
};

export type ModelSpaceViewportMeasurements = {
  scrollerWidth: number;
  scrollerHeight: number;
  focusRect?: ModelSpaceRect | null;
  svgRect?: ModelSpaceRect | null;
  frameRect?: ModelSpaceRect | null;
};

export type ModelSpaceNavigationResult = {
  transform: DrawingWorkbenchViewportTransform | null;
  gesture?: ModelSpaceGesture;
  pinchSource?: ModelSpacePinchSource;
  noOpReason?: 'deck_drag_locked' | 'missing_measurements' | 'unchanged_zoom' | 'empty_wheel_delta';
};

export type ModelSpacePanSession = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPanX: number;
  startPanY: number;
};

export type ModelSpacePinchSession = {
  firstPointerId: number;
  secondPointerId: number;
  startMidpointX: number;
  startMidpointY: number;
  startDistance: number;
  startZoom: number;
  startPanX: number;
  startPanY: number;
};

export type ModelSpaceWebKitGestureSession = {
  startAnchorX: number;
  startAnchorY: number;
  startZoom: number;
  startPanX: number;
  startPanY: number;
};

export type ModelSpaceTouchPointerSnapshot = {
  pointerId: number;
  clientX: number;
  clientY: number;
};

export const MIN_MODEL_ZOOM = 0.01;
export const MAX_MODEL_ZOOM = 4;
export const FIT_VIEW_MARGIN_PX = 24;
export const WHEEL_LINE_DELTA_PX = 16;
export const WHEEL_PAGE_DELTA_PX = 240;
export const WHEEL_ZOOM_SENSITIVITY = 0.0036;
export const WHEEL_GESTURE_IDLE_MS = 600;

export function clampModelSpaceZoom(value: number): number {
  return Math.min(Math.max(value, MIN_MODEL_ZOOM), MAX_MODEL_ZOOM);
}

export function normalizeWheelDeltaPixels(input: {
  deltaMode: number;
  deltaX: number;
  deltaY: number;
}): {
  deltaX: number;
  deltaY: number;
} {
  const multiplier = input.deltaMode === 1 ? WHEEL_LINE_DELTA_PX : input.deltaMode === 2 ? WHEEL_PAGE_DELTA_PX : 1;
  return {
    deltaX: input.deltaX * multiplier,
    deltaY: input.deltaY * multiplier,
  };
}

export function applyAnchoredModelSpaceZoom(input: {
  currentTransform: DrawingWorkbenchViewportTransform;
  nextZoom: number;
  startZoom: number;
  startPanX: number;
  startPanY: number;
  startAnchorX: number;
  startAnchorY: number;
  currentAnchorX: number;
  currentAnchorY: number;
}): DrawingWorkbenchViewportTransform {
  const nextZoom = clampModelSpaceZoom(input.nextZoom);
  const safeStartZoom = Math.max(input.startZoom, 0.001);
  const contentAnchorX = (input.startAnchorX - input.startPanX) / safeStartZoom;
  const contentAnchorY = (input.startAnchorY - input.startPanY) / safeStartZoom;
  return {
    ...input.currentTransform,
    zoom: nextZoom,
    panX: input.currentAnchorX - contentAnchorX * nextZoom,
    panY: input.currentAnchorY - contentAnchorY * nextZoom,
  };
}

export function resolveModelSpaceZoomButton(input: {
  state: ModelSpaceNavigationState;
  delta: number;
}): ModelSpaceNavigationResult {
  if (input.state.deckDragLocked) return { transform: null, noOpReason: 'deck_drag_locked' };
  const nextZoom = clampModelSpaceZoom(input.state.zoom + input.delta);
  return {
    transform: {
      ...input.state.transform,
      zoom: nextZoom,
    },
  };
}

export function resolveModelSpaceWheelZoom(input: {
  state: ModelSpaceNavigationState;
  deltaMode: number;
  deltaX: number;
  deltaY: number;
  anchor: { x: number; y: number };
}): ModelSpaceNavigationResult {
  if (input.state.deckDragLocked) return { transform: null, noOpReason: 'deck_drag_locked' };
  const delta = normalizeWheelDeltaPixels(input);
  if (delta.deltaX === 0 && delta.deltaY === 0) return { transform: null, noOpReason: 'empty_wheel_delta' };
  const zoomDelta = Math.abs(delta.deltaY) >= Math.abs(delta.deltaX) ? delta.deltaY : delta.deltaX;
  const nextZoom = clampModelSpaceZoom(input.state.zoom * Math.exp(-zoomDelta * WHEEL_ZOOM_SENSITIVITY));
  if (nextZoom === input.state.zoom) return { transform: null, noOpReason: 'unchanged_zoom' };
  return {
    gesture: 'wheel-zoom',
    pinchSource: 'wheel',
    transform: applyAnchoredModelSpaceZoom({
      currentTransform: input.state.transform,
      nextZoom,
      startZoom: input.state.zoom,
      startPanX: input.state.transform.panX,
      startPanY: input.state.transform.panY,
      startAnchorX: input.anchor.x,
      startAnchorY: input.anchor.y,
      currentAnchorX: input.anchor.x,
      currentAnchorY: input.anchor.y,
    }),
  };
}

export function resolveModelSpacePanMove(input: {
  state: ModelSpaceNavigationState;
  session: ModelSpacePanSession;
  clientX: number;
  clientY: number;
}): ModelSpaceNavigationResult {
  if (input.state.deckDragLocked) return { transform: null, noOpReason: 'deck_drag_locked' };
  return {
    transform: {
      ...input.state.transform,
      panX: input.session.startPanX + input.clientX - input.session.startClientX,
      panY: input.session.startPanY + input.clientY - input.session.startClientY,
    },
  };
}

export function resolveTouchMidpoint(
  first: ModelSpaceTouchPointerSnapshot,
  second: ModelSpaceTouchPointerSnapshot,
): { x: number; y: number } {
  return {
    x: (first.clientX + second.clientX) / 2,
    y: (first.clientY + second.clientY) / 2,
  };
}

export function resolveTouchDistance(
  first: ModelSpaceTouchPointerSnapshot,
  second: ModelSpaceTouchPointerSnapshot,
): number {
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

export function resolveTouchPointerPair(
  pointers: Map<number, ModelSpaceTouchPointerSnapshot>,
): [ModelSpaceTouchPointerSnapshot, ModelSpaceTouchPointerSnapshot] | null {
  if (pointers.size !== 2) return null;
  const pair = Array.from(pointers.values());
  const first = pair[0];
  const second = pair[1];
  return first && second ? [first, second] : null;
}

export function createModelSpacePinchSession(input: {
  first: ModelSpaceTouchPointerSnapshot;
  second: ModelSpaceTouchPointerSnapshot;
  anchor: { x: number; y: number };
  state: ModelSpaceNavigationState;
}): ModelSpacePinchSession | null {
  const distance = resolveTouchDistance(input.first, input.second);
  if (distance <= 0) return null;
  return {
    firstPointerId: input.first.pointerId,
    secondPointerId: input.second.pointerId,
    startMidpointX: input.anchor.x,
    startMidpointY: input.anchor.y,
    startDistance: distance,
    startZoom: input.state.zoom,
    startPanX: input.state.transform.panX,
    startPanY: input.state.transform.panY,
  };
}

export function resolveModelSpacePinchMove(input: {
  state: ModelSpaceNavigationState;
  session: ModelSpacePinchSession;
  first: ModelSpaceTouchPointerSnapshot;
  second: ModelSpaceTouchPointerSnapshot;
  currentAnchor: { x: number; y: number };
}): ModelSpaceNavigationResult {
  if (input.state.deckDragLocked) return { transform: null, noOpReason: 'deck_drag_locked' };
  const distance = resolveTouchDistance(input.first, input.second);
  if (distance <= 0) return { transform: null, noOpReason: 'missing_measurements' };
  return {
    gesture: 'pinch-zoom',
    pinchSource: 'touch-pointer',
    transform: applyAnchoredModelSpaceZoom({
      currentTransform: input.state.transform,
      nextZoom: input.session.startZoom * (distance / Math.max(input.session.startDistance, 0.001)),
      startZoom: input.session.startZoom,
      startPanX: input.session.startPanX,
      startPanY: input.session.startPanY,
      startAnchorX: input.session.startMidpointX,
      startAnchorY: input.session.startMidpointY,
      currentAnchorX: input.currentAnchor.x,
      currentAnchorY: input.currentAnchor.y,
    }),
  };
}

export function createModelSpaceWebKitGestureSession(input: {
  anchor: { x: number; y: number };
  state: ModelSpaceNavigationState;
}): ModelSpaceWebKitGestureSession {
  return {
    startAnchorX: input.anchor.x,
    startAnchorY: input.anchor.y,
    startZoom: input.state.zoom,
    startPanX: input.state.transform.panX,
    startPanY: input.state.transform.panY,
  };
}

export function resolveModelSpaceWebKitGestureChange(input: {
  state: ModelSpaceNavigationState;
  session: ModelSpaceWebKitGestureSession;
  scale: number;
}): ModelSpaceNavigationResult {
  if (input.state.deckDragLocked) return { transform: null, noOpReason: 'deck_drag_locked' };
  if (!Number.isFinite(input.scale) || input.scale <= 0) return { transform: null, noOpReason: 'missing_measurements' };
  return {
    gesture: 'trackpad-pinch',
    pinchSource: 'webkit-gesture',
    transform: applyAnchoredModelSpaceZoom({
      currentTransform: input.state.transform,
      nextZoom: input.session.startZoom * input.scale,
      startZoom: input.session.startZoom,
      startPanX: input.session.startPanX,
      startPanY: input.session.startPanY,
      startAnchorX: input.session.startAnchorX,
      startAnchorY: input.session.startAnchorY,
      currentAnchorX: input.session.startAnchorX,
      currentAnchorY: input.session.startAnchorY,
    }),
  };
}

export function resolveModelSpaceFitView(input: {
  state: ModelSpaceNavigationState;
  measurements: ModelSpaceViewportMeasurements;
}): ModelSpaceNavigationResult {
  if (input.state.deckDragLocked) return { transform: null, noOpReason: 'deck_drag_locked' };
  const { scrollerWidth, scrollerHeight } = input.measurements;
  if (scrollerWidth <= 0 || scrollerHeight <= 0) {
    return { transform: null, noOpReason: 'missing_measurements' };
  }
  const targetRect = input.measurements.focusRect ?? input.measurements.svgRect ?? input.measurements.frameRect ?? null;
  if (!targetRect) return { transform: null, noOpReason: 'missing_measurements' };

  const availableWidth = Math.max(1, scrollerWidth - FIT_VIEW_MARGIN_PX * 2);
  const availableHeight = Math.max(1, scrollerHeight - FIT_VIEW_MARGIN_PX * 2);
  const nextZoom = clampModelSpaceZoom(Math.min(availableWidth / targetRect.width, availableHeight / targetRect.height));
  return {
    transform: {
      ...input.state.transform,
      zoom: nextZoom,
      panX: scrollerWidth / 2 - (targetRect.x + targetRect.width / 2) * nextZoom,
      panY: scrollerHeight / 2 - (targetRect.y + targetRect.height / 2) * nextZoom,
    },
  };
}
