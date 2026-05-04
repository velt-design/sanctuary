import { useCallback, useRef } from 'react';
import {
  applyAnchoredModelSpaceZoom,
  clampModelSpaceZoom,
  normalizeWheelDeltaPixels,
  WHEEL_ZOOM_SENSITIVITY,
  type ModelSpacePanSession,
} from '@/lib/drawings/interactions/modelSpaceNavigationController';
import type { DrawingWorkbenchViewportTransform } from '@/lib/drawings/state/drawingWorkbenchUiState';

export type UsePanZoomInput = {
  transform: DrawingWorkbenchViewportTransform;
  onTransformChange: (next: DrawingWorkbenchViewportTransform) => void;
};

export type UsePanZoomOutput = {
  onWheel: (event: React.WheelEvent<Element>) => void;
  onPointerDown: (event: React.PointerEvent<Element>) => void;
  onPointerMove: (event: React.PointerEvent<Element>) => void;
  onPointerUp: (event: React.PointerEvent<Element>) => void;
  onContextMenu: (event: React.MouseEvent<Element>) => void;
};

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
  const nextZoom = clampModelSpaceZoom(
    input.transform.zoom * Math.exp(-zoomDelta * WHEEL_ZOOM_SENSITIVITY),
  );
  if (nextZoom === input.transform.zoom) return null;
  return applyAnchoredModelSpaceZoom({
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

export function resolvePannedTransform(input: {
  transform: DrawingWorkbenchViewportTransform;
  session: ModelSpacePanSession;
  clientX: number;
  clientY: number;
}): DrawingWorkbenchViewportTransform {
  return {
    ...input.transform,
    panX: input.session.startPanX + input.clientX - input.session.startClientX,
    panY: input.session.startPanY + input.clientY - input.session.startClientY,
  };
}

export function usePanZoom({ transform, onTransformChange }: UsePanZoomInput): UsePanZoomOutput {
  const sessionRef = useRef<ModelSpacePanSession | null>(null);
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const onWheel = useCallback(
    (event: React.WheelEvent<Element>) => {
      const next = resolveWheelZoomedTransform({
        transform: transformRef.current,
        deltaMode: event.deltaMode,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        anchor: { x: event.clientX, y: event.clientY },
      });
      if (!next) return;
      event.preventDefault();
      onTransformChange(next);
    },
    [onTransformChange],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<Element>) => {
      if (event.button !== 2) return;
      event.preventDefault();
      const target = event.currentTarget;
      if (target instanceof Element && typeof target.setPointerCapture === 'function') {
        try {
          target.setPointerCapture(event.pointerId);
        } catch {
          // pointer capture is best-effort; release-on-up still cleans up.
        }
      }
      sessionRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startPanX: transformRef.current.panX,
        startPanY: transformRef.current.panY,
      };
    },
    [],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<Element>) => {
      const session = sessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      const next = resolvePannedTransform({
        transform: transformRef.current,
        session,
        clientX: event.clientX,
        clientY: event.clientY,
      });
      onTransformChange(next);
    },
    [onTransformChange],
  );

  const onPointerUp = useCallback((event: React.PointerEvent<Element>) => {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    sessionRef.current = null;
    const target = event.currentTarget;
    if (target instanceof Element && typeof target.releasePointerCapture === 'function') {
      try {
        target.releasePointerCapture(event.pointerId);
      } catch {
        // ignore release errors after pointer is gone
      }
    }
  }, []);

  const onContextMenu = useCallback((event: React.MouseEvent<Element>) => {
    event.preventDefault();
  }, []);

  return { onWheel, onPointerDown, onPointerMove, onPointerUp, onContextMenu };
}
