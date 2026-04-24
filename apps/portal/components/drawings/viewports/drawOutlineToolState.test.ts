import { describe, expect, it } from 'vitest';
import {
  cancelDrawOutlineTool,
  confirmDrawOutlineSegment,
  deriveDrawOutlineViewModel,
  hoverDrawOutlinePoint,
  isDrawOutlineActive,
  prepareDrawOutlineClose,
  selectDrawOutlinePoint,
  setDrawOutlineAngleDraft,
  setDrawOutlineDistanceDraft,
  startDrawOutlineTool,
  undoDrawOutline,
  type DrawOutlineToolState,
} from './drawOutlineToolState';

function activeState(state: DrawOutlineToolState) {
  if (!isDrawOutlineActive(state)) throw new Error('Expected active draw outline state.');
  return state;
}

function makeClosedTriangleState(): DrawOutlineToolState {
  let state = startDrawOutlineTool().state;
  state = selectDrawOutlinePoint(state, { alongM: 0, depthM: 0 }).state;
  state = selectDrawOutlinePoint(state, { alongM: 3, depthM: 0 }).state;
  state = confirmDrawOutlineSegment(state).state;
  state = selectDrawOutlinePoint(state, { alongM: 3, depthM: 2 }).state;
  state = confirmDrawOutlineSegment(state).state;
  return state;
}

describe('drawOutlineToolState', () => {
  it('starts and cancels the draw outline tool', () => {
    const started = startDrawOutlineTool();
    expect(started.error).toBeNull();
    expect(deriveDrawOutlineViewModel(started.state, false)).toMatchObject({
      isActive: true,
      diagnosticState: 'first-point',
      confirmedPointCount: 0,
      angleMode: 'relative',
    });

    const cancelled = cancelDrawOutlineTool();
    expect(cancelled.error).toBeNull();
    expect(deriveDrawOutlineViewModel(cancelled.state, false)).toMatchObject({
      isActive: false,
      diagnosticState: 'inactive',
      confirmedPointCount: 0,
      angleMode: 'none',
    });
  });

  it('moves from first point to placing after the first selected point', () => {
    const state = selectDrawOutlinePoint(startDrawOutlineTool().state, { alongM: 1, depthM: 2 }).state;
    expect(activeState(state).points).toEqual([{ alongM: 1, depthM: 2 }]);
    expect(deriveDrawOutlineViewModel(state, false)).toMatchObject({
      diagnosticState: 'placing',
      confirmedPointCount: 1,
      angleMode: 'absolute',
      previewPointKind: null,
    });
  });

  it('creates a pending segment with distance and angle drafts from a second selected point', () => {
    let state = startDrawOutlineTool().state;
    state = selectDrawOutlinePoint(state, { alongM: 0, depthM: 0 }).state;
    const selected = selectDrawOutlinePoint(state, { alongM: 3, depthM: 0 });

    expect(selected.error).toBeNull();
    expect(activeState(selected.state)).toMatchObject({
      distanceDraft: '3',
      angleDraft: '0',
      angleMode: 'absolute',
    });
    expect(deriveDrawOutlineViewModel(selected.state, false)).toMatchObject({
      diagnosticState: 'pending-segment',
      previewPointKind: 'pending',
      hasPendingPoint: true,
    });
  });

  it('confirms a pending segment into the point list', () => {
    let state = startDrawOutlineTool().state;
    state = selectDrawOutlinePoint(state, { alongM: 0, depthM: 0 }).state;
    state = selectDrawOutlinePoint(state, { alongM: 3, depthM: 0 }).state;
    const confirmed = confirmDrawOutlineSegment(state);

    expect(confirmed.error).toBeNull();
    expect(activeState(confirmed.state).points).toEqual([
      { alongM: 0, depthM: 0 },
      { alongM: 3, depthM: 0 },
    ]);
    expect(deriveDrawOutlineViewModel(confirmed.state, false)).toMatchObject({
      diagnosticState: 'placing',
      previewPointKind: null,
      hasPendingPoint: false,
      angleMode: 'relative',
    });
  });

  it('creates a typed pending segment from distance and angle drafts', () => {
    let state = startDrawOutlineTool().state;
    state = selectDrawOutlinePoint(state, { alongM: 0, depthM: 0 }).state;
    state = setDrawOutlineDistanceDraft(state, '2').state;
    state = setDrawOutlineAngleDraft(state, '90').state;

    expect(deriveDrawOutlineViewModel(state, false)).toMatchObject({
      diagnosticState: 'pending-segment',
      pendingPoint: { alongM: 0, depthM: 2 },
      previewPointKind: 'pending',
      hasPendingPoint: true,
    });
  });

  it('undo clears pending draft before removing confirmed points', () => {
    let state = startDrawOutlineTool().state;
    state = selectDrawOutlinePoint(state, { alongM: 0, depthM: 0 }).state;
    state = setDrawOutlineDistanceDraft(state, '2').state;
    state = setDrawOutlineAngleDraft(state, '0').state;

    state = undoDrawOutline(state).state;
    expect(activeState(state)).toMatchObject({
      points: [{ alongM: 0, depthM: 0 }],
      distanceDraft: '',
      angleDraft: '',
    });
    expect(deriveDrawOutlineViewModel(state, false).diagnosticState).toBe('placing');

    state = undoDrawOutline(state).state;
    expect(activeState(state).points).toEqual([]);
    expect(deriveDrawOutlineViewModel(state, false).diagnosticState).toBe('first-point');
  });

  it('derives close-ready and close-hovered states after three confirmed points', () => {
    let state = makeClosedTriangleState();
    expect(deriveDrawOutlineViewModel(state, false)).toMatchObject({
      diagnosticState: 'close-ready',
      confirmedPointCount: 3,
      closeReady: true,
      closeHovered: false,
    });

    state = hoverDrawOutlinePoint(state, { alongM: 0.05, depthM: 0.05 }).state;
    expect(deriveDrawOutlineViewModel(state, false)).toMatchObject({
      diagnosticState: 'close-hovered',
      previewPointKind: 'hover',
      closeHovered: true,
    });
  });

  it('returns the existing validation error when closing with too few points', () => {
    const result = prepareDrawOutlineClose(startDrawOutlineTool().state);
    expect(result).toMatchObject({
      ok: false,
      error: 'Add at least 3 points before closing the outline.',
      validationIssue: {
        code: 'too-few-points',
        message: 'Add at least 3 points before closing the outline.',
        pointCount: 0,
        minPointCount: 3,
      },
    });
  });

  it('prepares serializable polygon points for a valid close', () => {
    const result = prepareDrawOutlineClose(makeClosedTriangleState());
    expect(result).toMatchObject({
      ok: true,
      polygon: [
        { alongM: '0', depthM: '0' },
        { alongM: '3', depthM: '0' },
        { alongM: '3', depthM: '2' },
      ],
    });
  });

  it('derives the error diagnostic state from active draw state plus interaction error', () => {
    const state = selectDrawOutlinePoint(startDrawOutlineTool().state, { alongM: 0, depthM: 0 }).state;
    expect(deriveDrawOutlineViewModel(state, true)).toMatchObject({
      diagnosticState: 'error',
      confirmedPointCount: 1,
    });
  });
});
