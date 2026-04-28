import { describe, expect, it } from 'vitest';
import {
  OBJECT_DRAG_INTENT_THRESHOLD_PX,
  buildObjectInteractionViewState,
  createObjectInteractionSession,
  resolveObjectInteractionMove,
  setObjectInteractionPhase,
} from './objectInteractionEngine';

describe('objectInteractionEngine', () => {
  it('starts drag sessions in drag-intent by default', () => {
    const session = createObjectInteractionSession({
      pointerId: 7,
      startClientX: 10,
      startClientY: 20,
      objectId: 'deck-1',
    });

    expect(session.phase).toBe('drag-intent');
  });

  it('normalizes shared interaction view state defaults', () => {
    const state = buildObjectInteractionViewState({
      phase: 'selected',
      statusLabel: 'Drag deck',
    });

    expect(state).toMatchObject({
      phase: 'selected',
      placementState: 'none',
      statusLabel: 'Drag deck',
      statusDetail: null,
      canCommit: false,
      highlightTargetId: null,
      previewAnchor: null,
      releaseOutcome: 'none',
      releasePlacement: null,
      settleVisualState: null,
    });
  });

  it('keeps the session in drag-intent until the threshold is crossed', () => {
    const session = createObjectInteractionSession({
      pointerId: 9,
      startClientX: 10,
      startClientY: 20,
      objectId: 'deck-1',
    });

    const update = resolveObjectInteractionMove({
      session,
      clientX: 12,
      clientY: 22,
    });

    expect(update.distancePx).toBeLessThan(OBJECT_DRAG_INTENT_THRESHOLD_PX);
    expect(update.crossedDragThreshold).toBe(false);
    expect(update.nextPhase).toBe('drag-intent');
  });

  it('promotes the session to dragging once the threshold is crossed', () => {
    const session = createObjectInteractionSession({
      pointerId: 11,
      startClientX: 10,
      startClientY: 20,
      objectId: 'deck-1',
    });

    const update = resolveObjectInteractionMove({
      session,
      clientX: 10 + OBJECT_DRAG_INTENT_THRESHOLD_PX,
      clientY: 20,
    });

    expect(update.crossedDragThreshold).toBe(true);
    expect(update.nextPhase).toBe('dragging');
  });

  it('preserves dragging sessions once they have been promoted', () => {
    const draggingSession = setObjectInteractionPhase(
      createObjectInteractionSession({
        pointerId: 13,
        startClientX: 10,
        startClientY: 20,
        objectId: 'deck-1',
      }),
      'dragging',
    );

    const update = resolveObjectInteractionMove({
      session: draggingSession,
      clientX: 11,
      clientY: 21,
    });

    expect(update.crossedDragThreshold).toBe(true);
    expect(update.nextPhase).toBe('dragging');
  });
});
