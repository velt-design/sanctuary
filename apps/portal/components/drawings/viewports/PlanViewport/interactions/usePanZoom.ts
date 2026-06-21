import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
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
  /**
   * Ref for the transformed `<g>`. usePanZoom writes its `transform`
   * attribute IMPERATIVELY on every pan/zoom frame (no React re-render) and
   * syncs it from the committed transform via a layout effect. The `<g>`
   * must NOT also set `transform` through JSX or React would clobber the
   * imperative value on unrelated re-renders.
   */
  groupRef: RefObject<SVGGElement | null>;
  /**
   * The LIVE transform (updated imperatively each frame). Pointer->world
   * mapping must read this — not the committed React prop — so a click
   * immediately after a wheel-zoom (before the debounced commit) still maps
   * the cursor to the correct world coordinate.
   */
  getLiveTransform: () => DrawingWorkbenchViewportTransform;
  onPointerDown: (event: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove: (event: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp: (event: React.PointerEvent<SVGSVGElement>) => void;
  onContextMenu: (event: React.MouseEvent<SVGSVGElement>) => void;
};

function transformAttr(transform: DrawingWorkbenchViewportTransform): string {
  return `translate(${transform.panX} ${transform.panY}) scale(${transform.zoom})`;
}

// A fast wheel burst commits to React/store ONCE, this long after the last
// tick — so a 30-tick zoom is one re-render, not thirty.
const WHEEL_COMMIT_DEBOUNCE_MS = 120;

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
  // The LIVE transform — updated imperatively on every pan/zoom frame with NO
  // React re-render. The committed prop syncs into it via the layout effect.
  const liveTransformRef = useRef(transform);
  const groupRef = useRef<SVGGElement | null>(null);
  const onTransformChangeRef = useRef(onTransformChange);
  onTransformChangeRef.current = onTransformChange;
  const wheelCleanupRef = useRef<(() => void) | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wheelCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Write a transform to the rendered group imperatively — the per-frame hot
  // path. No setState, so no React reconciliation of the SVG subtree.
  const applyLiveTransform = useCallback(
    (next: DrawingWorkbenchViewportTransform) => {
      liveTransformRef.current = next;
      groupRef.current?.setAttribute('transform', transformAttr(next));
    },
    [],
  );

  // Sync the committed transform (prop) -> live ref + rendered group. Runs
  // only when the committed value actually changes (gesture commit, fit-view,
  // programmatic) — so it never fights mid-gesture imperative writes — and
  // before paint, so there is no flash on mount or commit.
  useLayoutEffect(() => {
    applyLiveTransform(transform);
  }, [transform, applyLiveTransform]);

  // Drop any pending wheel-commit on unmount.
  useEffect(
    () => () => {
      if (wheelCommitTimerRef.current) clearTimeout(wheelCommitTimerRef.current);
    },
    [],
  );

  const getLiveTransform = useCallback(() => liveTransformRef.current, []);

  const commitLiveTransform = useCallback(() => {
    onTransformChangeRef.current(liveTransformRef.current);
  }, []);

  const wheelRef = useCallback(
    (node: SVGSVGElement | null) => {
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
          transform: liveTransformRef.current,
          deltaMode: event.deltaMode,
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          anchor,
        });
        if (!next) return;
        event.preventDefault();
        // Zoom instantly (imperative), debounce the React/store commit.
        applyLiveTransform(next);
        if (wheelCommitTimerRef.current) clearTimeout(wheelCommitTimerRef.current);
        wheelCommitTimerRef.current = setTimeout(
          commitLiveTransform,
          WHEEL_COMMIT_DEBOUNCE_MS,
        );
      };
      node.addEventListener('wheel', handler, { passive: false });
      wheelCleanupRef.current = () => node.removeEventListener('wheel', handler);
    },
    [applyLiveTransform, commitLiveTransform],
  );

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
      startPanX: liveTransformRef.current.panX,
      startPanY: liveTransformRef.current.panY,
    };
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const session = sessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      const svg = svgRef.current ?? event.currentTarget;
      const current = clientPointToSvg(svg, event.clientX, event.clientY);
      if (!current) return;
      // Pan imperatively; the single React/store commit happens on pointer-up.
      applyLiveTransform({
        ...liveTransformRef.current,
        panX: session.startPanX + current.x - session.startSvgX,
        panY: session.startPanY + current.y - session.startSvgY,
      });
    },
    [applyLiveTransform],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
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
      commitLiveTransform();
    },
    [commitLiveTransform],
  );

  const onContextMenu = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    event.preventDefault();
  }, []);

  return {
    wheelRef,
    groupRef,
    getLiveTransform,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onContextMenu,
  };
}
