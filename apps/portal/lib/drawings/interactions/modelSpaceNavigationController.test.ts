import { describe, expect, it } from 'vitest';
import type { DrawingWorkbenchViewportTransform } from '@/lib/drawings/state/drawingWorkbenchUiState';
import {
  MAX_MODEL_ZOOM,
  MIN_MODEL_ZOOM,
  applyAnchoredModelSpaceZoom,
  createModelSpacePinchSession,
  createModelSpaceWebKitGestureSession,
  resolveModelSpaceFitView,
  resolveModelSpacePanMove,
  resolveModelSpacePinchMove,
  resolveModelSpaceWebKitGestureChange,
  resolveModelSpaceWheelZoom,
  resolveModelSpaceZoomButton,
  type ModelSpaceNavigationState,
} from './modelSpaceNavigationController';

function makeState(input?: {
  transform?: Partial<DrawingWorkbenchViewportTransform>;
  deckDragLocked?: boolean;
}): ModelSpaceNavigationState {
  const transform = {
    zoom: input?.transform?.zoom ?? 1,
    panX: input?.transform?.panX ?? 10,
    panY: input?.transform?.panY ?? 20,
  };
  return {
    transform,
    zoom: transform.zoom,
    gesture: 'idle',
    pinchSource: 'none',
    deckDragLocked: input?.deckDragLocked ?? false,
  };
}

function contentPointFor(transform: DrawingWorkbenchViewportTransform, anchor: { x: number; y: number }): { x: number; y: number } {
  return {
    x: (anchor.x - transform.panX) / transform.zoom,
    y: (anchor.y - transform.panY) / transform.zoom,
  };
}

function screenPointFor(transform: DrawingWorkbenchViewportTransform, point: { x: number; y: number }): { x: number; y: number } {
  return {
    x: point.x * transform.zoom + transform.panX,
    y: point.y * transform.zoom + transform.panY,
  };
}

describe('modelSpaceNavigationController', () => {
  it('keeps the cursor anchor stable for wheel zoom', () => {
    const state = makeState({ transform: { zoom: 1, panX: 40, panY: 30 } });
    const anchor = { x: 300, y: 240 };
    const contentAnchor = contentPointFor(state.transform, anchor);

    const result = resolveModelSpaceWheelZoom({
      state,
      deltaMode: 0,
      deltaX: 0,
      deltaY: -120,
      anchor,
    });

    expect(result.gesture).toBe('wheel-zoom');
    expect(result.pinchSource).toBe('wheel');
    expect(result.transform).not.toBeNull();
    const nextScreen = screenPointFor(result.transform!, contentAnchor);
    expect(nextScreen.x).toBeCloseTo(anchor.x, 6);
    expect(nextScreen.y).toBeCloseTo(anchor.y, 6);
    expect(result.transform!.zoom).toBeGreaterThan(state.zoom);
  });

  it('clamps zoom button changes to existing limits', () => {
    const maxed = resolveModelSpaceZoomButton({
      state: makeState({ transform: { zoom: MAX_MODEL_ZOOM - 0.01 } }),
      delta: 1,
    });
    const mined = resolveModelSpaceZoomButton({
      state: makeState({ transform: { zoom: MIN_MODEL_ZOOM + 0.001 } }),
      delta: -1,
    });

    expect(maxed.transform?.zoom).toBe(MAX_MODEL_ZOOM);
    expect(mined.transform?.zoom).toBe(MIN_MODEL_ZOOM);
  });

  it('translates mouse pan by pointer delta', () => {
    const result = resolveModelSpacePanMove({
      state: makeState({ transform: { zoom: 1, panX: 3, panY: 4 } }),
      session: {
        pointerId: 12,
        startClientX: 10,
        startClientY: 20,
        startPanX: 3,
        startPanY: 4,
      },
      clientX: 15,
      clientY: 17,
    });

    expect(result.transform).toMatchObject({ panX: 8, panY: 1 });
  });

  it('changes touch pinch zoom while preserving the midpoint anchor', () => {
    const state = makeState({ transform: { zoom: 1, panX: 0, panY: 0 } });
    const session = createModelSpacePinchSession({
      first: { pointerId: 1, clientX: 0, clientY: 0 },
      second: { pointerId: 2, clientX: 100, clientY: 0 },
      anchor: { x: 50, y: 0 },
      state,
    });
    expect(session).not.toBeNull();
    const contentAnchor = contentPointFor(state.transform, { x: 50, y: 0 });

    const result = resolveModelSpacePinchMove({
      state,
      session: session!,
      first: { pointerId: 1, clientX: 0, clientY: 0 },
      second: { pointerId: 2, clientX: 200, clientY: 0 },
      currentAnchor: { x: 100, y: 0 },
    });

    expect(result.transform?.zoom).toBeCloseTo(2, 6);
    const nextScreen = screenPointFor(result.transform!, contentAnchor);
    expect(nextScreen.x).toBeCloseTo(100, 6);
    expect(nextScreen.y).toBeCloseTo(0, 6);
  });

  it('uses the same anchored zoom path for WebKit gesture scale', () => {
    const state = makeState({ transform: { zoom: 1, panX: 20, panY: 10 } });
    const anchor = { x: 100, y: 80 };
    const contentAnchor = contentPointFor(state.transform, anchor);
    const session = createModelSpaceWebKitGestureSession({ anchor, state });

    const result = resolveModelSpaceWebKitGestureChange({
      state,
      session,
      scale: 1.5,
    });

    expect(result.gesture).toBe('trackpad-pinch');
    expect(result.pinchSource).toBe('webkit-gesture');
    expect(result.transform?.zoom).toBeCloseTo(1.5, 6);
    const nextScreen = screenPointFor(result.transform!, contentAnchor);
    expect(nextScreen.x).toBeCloseTo(anchor.x, 6);
    expect(nextScreen.y).toBeCloseTo(anchor.y, 6);
  });

  it('computes fit-view transforms from focus, svg, and frame fallback bounds', () => {
    const state = makeState({ transform: { zoom: 1, panX: 0, panY: 0 } });
    const focus = resolveModelSpaceFitView({
      state,
      measurements: {
        scrollerWidth: 1000,
        scrollerHeight: 800,
        focusRect: { x: 100, y: 50, width: 400, height: 200 },
        svgRect: { x: 0, y: 0, width: 800, height: 600 },
      },
    });
    const svg = resolveModelSpaceFitView({
      state,
      measurements: {
        scrollerWidth: 1000,
        scrollerHeight: 800,
        svgRect: { x: 0, y: 0, width: 800, height: 600 },
      },
    });
    const frame = resolveModelSpaceFitView({
      state,
      measurements: {
        scrollerWidth: 1000,
        scrollerHeight: 800,
        frameRect: { x: 0, y: 0, width: 500, height: 500 },
      },
    });

    expect(focus.transform?.zoom).toBeCloseTo((1000 - 48) / 400, 6);
    expect(focus.transform?.panX).toBeCloseTo(500 - 300 * focus.transform!.zoom, 6);
    expect(svg.transform?.zoom).toBeCloseTo((1000 - 48) / 800, 6);
    expect(frame.transform?.zoom).toBeCloseTo((800 - 48) / 500, 6);
  });

  it('returns no-op for navigation gestures while deck dragging is locked', () => {
    const state = makeState({ deckDragLocked: true });

    expect(resolveModelSpaceZoomButton({ state, delta: 0.25 }).noOpReason).toBe('deck_drag_locked');
    expect(
      resolveModelSpaceWheelZoom({
        state,
        deltaMode: 0,
        deltaX: 0,
        deltaY: -120,
        anchor: { x: 50, y: 50 },
      }).noOpReason,
    ).toBe('deck_drag_locked');
    expect(
      resolveModelSpacePanMove({
        state,
        session: {
          pointerId: 1,
          startClientX: 0,
          startClientY: 0,
          startPanX: 0,
          startPanY: 0,
        },
        clientX: 10,
        clientY: 10,
      }).noOpReason,
    ).toBe('deck_drag_locked');
    expect(
      resolveModelSpaceFitView({
        state,
        measurements: {
          scrollerWidth: 1000,
          scrollerHeight: 800,
          frameRect: { x: 0, y: 0, width: 500, height: 500 },
        },
      }).noOpReason,
    ).toBe('deck_drag_locked');
  });

  it('keeps direct anchored zoom math reusable for component gesture wrappers', () => {
    const transform = { zoom: 1, panX: 0, panY: 0 };
    const next = applyAnchoredModelSpaceZoom({
      currentTransform: transform,
      nextZoom: 2,
      startZoom: 1,
      startPanX: 0,
      startPanY: 0,
      startAnchorX: 50,
      startAnchorY: 40,
      currentAnchorX: 80,
      currentAnchorY: 70,
    });

    expect(next).toMatchObject({ zoom: 2, panX: -20, panY: -10 });
  });
});
