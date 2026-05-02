import { describe, expect, it } from 'vitest';
import { setDrawOutlineDistanceDraft } from '@/components/drawings/viewports/drawOutlineToolState';
import {
  armDrawOutlineDistanceLockController,
  cancelDrawOutlineController,
  closeDrawOutlineController,
  hoverDrawOutlineCanvasPoint,
  endDrawOutlinePointerSession,
  moveDrawOutlinePointerSession,
  selectDrawOutlineCanvasPoint,
  startDrawOutlineController,
  startDrawOutlinePointerSession,
  undoDrawOutlineController,
  type DrawOutlinePointerSession,
} from './drawOutlineToolController';

function makePoint(alongM: number, depthM: number) {
  return {
    alongM: String(alongM),
    depthM: String(depthM),
    numericAlongM: alongM,
    numericDepthM: depthM,
  };
}

function makeTriangleState() {
  let state = startDrawOutlineController().state;
  state = selectDrawOutlineCanvasPoint({ state, rawPoint: makePoint(0, 0) }).transition!.state;
  state = selectDrawOutlineCanvasPoint({ state, rawPoint: makePoint(3, 0) }).transition!.state;
  state = selectDrawOutlineCanvasPoint({ state, rawPoint: makePoint(3, 2) }).transition!.state;
  return state;
}

function makePointerSession(input?: Partial<DrawOutlinePointerSession>): DrawOutlinePointerSession {
  return {
    pointerId: input?.pointerId ?? 7,
    startClientX: input?.startClientX ?? 10,
    startClientY: input?.startClientY ?? 20,
    startPanX: input?.startPanX ?? 3,
    startPanY: input?.startPanY ?? 4,
    startPoint: input?.startPoint ?? makePoint(1, 2),
    hasPanned: input?.hasPanned ?? false,
  };
}

describe('drawOutlineToolController', () => {
  it('starts, selects, hovers, undoes, and cancels through controller results', () => {
    let state = startDrawOutlineController().state;
    const selected = selectDrawOutlineCanvasPoint({
      state,
      rawPoint: makePoint(1, 2),
    });
    expect(selected.landingPoint).toEqual(makePoint(1, 2));
    expect(selected.transition?.state).toMatchObject({
      kind: 'active',
      points: [{ alongM: 1, depthM: 2 }],
    });

    state = selected.transition!.state;
    const hovered = hoverDrawOutlineCanvasPoint({
      state,
      rawPoint: makePoint(3, 2),
    });
    expect(hovered.landingPoint).toEqual(makePoint(3, 2));
    expect(hovered.transition.state).toMatchObject({
      kind: 'active',
      hoverPoint: {
        point: { alongM: 3, depthM: 2 },
      },
    });

    expect(undoDrawOutlineController(hovered.transition.state).state).toMatchObject({
      kind: 'active',
      points: [],
    });
    expect(cancelDrawOutlineController()).toEqual({
      state: { kind: 'inactive' },
      error: null,
    });
  });

  it('arms distance locks and resolves pointer sessions with locked previews', () => {
    let state = startDrawOutlineController().state;
    state = selectDrawOutlineCanvasPoint({ state, rawPoint: makePoint(0, 0) }).transition!.state;
    state = setDrawOutlineDistanceDraft(state, '2').state;
    state = armDrawOutlineDistanceLockController(state).state;

    const pointer = startDrawOutlinePointerSession({
      state,
      rawPoint: makePoint(0, 5),
      shiftKey: true,
      pointerId: 7,
      clientX: 10,
      clientY: 20,
      startPanX: 3,
      startPanY: 4,
    });

    expect(pointer.landingPoint).toEqual(makePoint(0, 2));
    expect(pointer.session).toMatchObject({
      pointerId: 7,
      startClientX: 10,
      startClientY: 20,
      startPanX: 3,
      startPanY: 4,
      startPoint: makePoint(0, 2),
      hasPanned: false,
    });
  });

  it('returns the existing invalid close copy', () => {
    const result = closeDrawOutlineController({
      state: startDrawOutlineController().state,
      mode: 'house_footprint',
    });

    expect(result).toMatchObject({
      ok: false,
      error: 'Add at least 3 points before closing the outline.',
    });
  });

  it('returns footprint and deck custom polygon commit intents for valid closes', () => {
    expect(closeDrawOutlineController({ state: makeTriangleState(), mode: 'house_footprint' })).toMatchObject({
      ok: true,
      commitIntent: {
        kind: 'footprint_edit',
        edit: {
          type: 'custom_polygon',
          polygon: [
            { alongM: '0', depthM: '0' },
            { alongM: '3', depthM: '0' },
            { alongM: '3', depthM: '2' },
          ],
        },
      },
    });

    expect(closeDrawOutlineController({ state: makeTriangleState(), mode: 'deck_custom_outline' })).toMatchObject({
      ok: true,
      commitIntent: {
        kind: 'custom_polygon_commit',
        polygon: [
          { alongM: '0', depthM: '0' },
          { alongM: '3', depthM: '0' },
          { alongM: '3', depthM: '2' },
        ],
      },
    });
  });

  it('keeps pointer move under pan threshold as a click candidate', () => {
    const session = makePointerSession();
    const result = moveDrawOutlinePointerSession({
      session,
      state: startDrawOutlineController().state,
      pointerId: session.pointerId,
      clientX: session.startClientX + 2,
      clientY: session.startClientY + 1,
      panThresholdPx: 5,
    });

    expect(result).toEqual({
      kind: 'noop',
      gesture: 'click-candidate',
      session,
    });
  });

  it('switches pointer move beyond pan threshold into pan and clears hover', () => {
    let state = startDrawOutlineController().state;
    state = selectDrawOutlineCanvasPoint({ state, rawPoint: makePoint(1, 2) }).transition!.state;
    state = hoverDrawOutlineCanvasPoint({ state, rawPoint: makePoint(3, 2) }).transition.state;
    const session = makePointerSession();

    const result = moveDrawOutlinePointerSession({
      session,
      state,
      pointerId: session.pointerId,
      clientX: session.startClientX + 10,
      clientY: session.startClientY,
      panThresholdPx: 5,
    });

    expect(result.kind).toBe('session_update');
    expect(result.gesture).toBe('pan');
    expect(result.session).toMatchObject({ hasPanned: true });
    expect(result.kind === 'session_update' ? result.transition.state : null).toMatchObject({
      kind: 'active',
      hoverPoint: null,
    });
  });

  it('selects the session start point on pointerup when no pan occurred', () => {
    const session = makePointerSession({ startPoint: makePoint(4, 5) });
    expect(
      endDrawOutlinePointerSession({
        session,
        pointerId: session.pointerId,
        eventType: 'pointerup',
      }),
    ).toEqual({
      kind: 'select_point',
      session: null,
      point: makePoint(4, 5),
    });
  });

  it('clears the pointer session without selecting after pan or pointercancel', () => {
    const panned = makePointerSession({ hasPanned: true });
    expect(
      endDrawOutlinePointerSession({
        session: panned,
        pointerId: panned.pointerId,
        eventType: 'pointerup',
      }),
    ).toEqual({ kind: 'cancel', session: null });

    const clickCandidate = makePointerSession({ hasPanned: false });
    expect(
      endDrawOutlinePointerSession({
        session: clickCandidate,
        pointerId: clickCandidate.pointerId,
        eventType: 'pointercancel',
      }),
    ).toEqual({ kind: 'cancel', session: null });
  });
});
