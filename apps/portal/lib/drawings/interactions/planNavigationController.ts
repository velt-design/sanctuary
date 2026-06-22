import type { DrawingWorkbenchViewportTransform } from '@/lib/drawings/state/drawingWorkbenchUiState';

const MIN_PLAN_ZOOM = 0.01;
const MAX_PLAN_ZOOM = 4;
const WHEEL_LINE_DELTA_PX = 16;
const WHEEL_PAGE_DELTA_PX = 240;
export const WHEEL_ZOOM_SENSITIVITY = 0.0036;

export function clampPlanZoom(value: number): number {
  return Math.min(Math.max(value, MIN_PLAN_ZOOM), MAX_PLAN_ZOOM);
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

export function applyAnchoredPlanZoom(input: {
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
  const nextZoom = clampPlanZoom(input.nextZoom);
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
