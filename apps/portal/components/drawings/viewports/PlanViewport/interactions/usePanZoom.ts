import {
  applyAnchoredPlanZoom,
  clampPlanZoom,
  normalizeWheelDeltaPixels,
  WHEEL_ZOOM_SENSITIVITY,
} from '@/lib/drawings/interactions/planNavigationController';
import type { DrawingWorkbenchViewportTransform } from '@/lib/drawings/state/drawingWorkbenchUiState';

export function resolveWheelZoomedTransform(input: {
  transform: DrawingWorkbenchViewportTransform;
  deltaMode: number;
  deltaX: number;
  deltaY: number;
  anchor: { x: number; y: number };
}): DrawingWorkbenchViewportTransform | null {
  const delta = normalizeWheelDeltaPixels({
    deltaMode: input.deltaMode,
    deltaX: input.deltaX,
    deltaY: input.deltaY,
  });
  if (delta.deltaX === 0 && delta.deltaY === 0) return null;
  const zoomDelta =
    Math.abs(delta.deltaY) >= Math.abs(delta.deltaX) ? delta.deltaY : delta.deltaX;
  const nextZoom = clampPlanZoom(
    input.transform.zoom * Math.exp(-zoomDelta * WHEEL_ZOOM_SENSITIVITY),
  );
  if (nextZoom === input.transform.zoom) return null;
  return applyAnchoredPlanZoom({
    currentTransform: input.transform,
    nextZoom,
    startZoom: input.transform.zoom,
    startPanX: input.transform.panX,
    startPanY: input.transform.panY,
    startAnchorX: input.anchor.x,
    startAnchorY: input.anchor.y,
    currentAnchorX: input.anchor.x,
    currentAnchorY: input.anchor.y,
  });
}
