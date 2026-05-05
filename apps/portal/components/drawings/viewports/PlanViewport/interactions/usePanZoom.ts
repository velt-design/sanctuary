import { useCallback, useRef } from 'react';
import {
  applyAnchoredModelSpaceZoom,
  clampModelSpaceZoom,
  normalizeWheelDeltaPixels,
  WHEEL_ZOOM_SENSITIVITY,
  type ModelSpacePanSession,
} from '@/lib/drawings/interactions/modelSpaceNavigationController';
import type { DrawingWorkbenchViewportTransform } from '@/lib/drawings/state/drawingWorkbenchUiState';
import { clientPointToSvg } from './pointerToPlan';

export type UsePanZoomInput = {
  transform: DrawingWorkbenchViewportTransform;
  onTransformChange: (next: DrawingWorkbenchViewportTransform) => void;
};

export type UsePanZoomOutput = {
  wheelRef: (node: SVGSVGElement | null) => void;
  onPointerDown: (event: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove: (event: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp: (event: React.PointerEvent<SVGSVGElement>) => void;
  onContextMenu: (event: React.MouseEvent<SVGSVGElement>) => void;
};

type PlanPanSession = {
  pointerId: number;
  startSvgX: number;
  startSvgY: number;
  startPanX: number;
  startPanY: number;
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
  const sessionRef = useRef<PlanPanSession | null>(null);
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const onTransformChangeRef = useRef(onTransformChange);
  onTransformChangeRef.current = onTransformChange;
  const wheelCleanupRef = useRef<(() => void) | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const wheelRef = useCallback((node: SVGSVGElement | null) => {
    if (wheelCleanupRef.current) {
      wheelCleanupRef.current();
      wheelCleanupRef.current = null;
    }
    svgRef.current = node;
    if (!node) return;
    const handler = (event: WheelEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const anchor = clientPointToSvg(svg, event.clientX, event.clientY);
      if (!anchor) return;
      const next = resolveWheelZoomedTransform({
        transform: transformRef.current,
        deltaMode: event.deltaMode,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        anchor,
      });
      if (!next) return;
      event.preventDefault();
      onTransformChangeRef.current(next);
    };
    node.addEventListener('wheel', handler, { passive: false });
    wheelCleanupRef.current = () => node.removeEventListener('wheel', handler);
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 2) return;
    event.preventDefault();
    const svg = svgRef.current ?? event.currentTarget;
    const start = clientPointToSvg(svg, event.clientX, event.clientY);
    if (!start) return;
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // pointer capture is best-effort; release-on-up still cleans up.
      }
    }
    sessionRef.current = {
      pointerId: event.pointerId,
      startSvgX: start.x,
      startSvgY: start.y,
      startPanX: transformRef.current.panX,
      startPanY: transformRef.current.panY,
    };
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const svg = svgRef.current ?? event.currentTarget;
    const current = clientPointToSvg(svg, event.clientX, event.clientY);
    if (!current) return;
    onTransformChangeRef.current({
      ...transformRef.current,
      panX: session.startPanX + current.x - session.startSvgX,
      panY: session.startPanY + current.y - session.startSvgY,
    });
  }, []);

  const onPointerUp = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    sessionRef.current = null;
    if (typeof event.currentTarget.releasePointerCapture === 'function') {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // ignore release errors after pointer is gone
      }
    }
  }, []);

  const onContextMenu = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    event.preventDefault();
  }, []);

  return { wheelRef, onPointerDown, onPointerMove, onPointerUp, onContextMenu };
}
