import { describe, expect, it } from 'vitest';
import { setDrawOutlineDistanceDraft } from '@/components/drawings/viewports/drawOutlineToolState';
import {
  armDrawOutlineDistanceLockController,
  cancelDrawOutlineController,
  closeDrawOutlineController,
  hoverDrawOutlineCanvasPoint,
  selectDrawOutlineCanvasPoint,
  startDrawOutlineController,
  startDrawOutlinePointerSession,
  undoDrawOutlineController,
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
});
