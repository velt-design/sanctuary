import { describe, expect, it } from 'vitest';
import {
  beginDrag,
  cancelDrag,
  commitDrag,
  exceedsDragThreshold,
  updateDrag,
} from './dragLifecycle';

describe('beginDrag', () => {
  it('creates an active session anchored to the start point with zero delta', () => {
    const session = beginDrag({
      pointerId: 7,
      point: { x: 100, y: 200 },
      context: { kind: 'deck-1' },
    });

    expect(session.status).toBe('active');
    expect(session.pointerId).toBe(7);
    expect(session.startPoint).toEqual({ x: 100, y: 200 });
    expect(session.currentPoint).toEqual({ x: 100, y: 200 });
    expect(session.delta).toEqual({ x: 0, y: 0 });
    expect(session.context).toEqual({ kind: 'deck-1' });
  });

  it('clones start and current points so caller mutations do not leak in', () => {
    const point = { x: 50, y: 50 };
    const session = beginDrag({ pointerId: 1, point, context: null });
    point.x = 999;
    expect(session.startPoint).toEqual({ x: 50, y: 50 });
    expect(session.currentPoint).toEqual({ x: 50, y: 50 });
  });
});

describe('updateDrag', () => {
  it('updates currentPoint and recomputes delta from startPoint', () => {
    const session = beginDrag({ pointerId: 1, point: { x: 100, y: 200 }, context: null });
    const next = updateDrag(session, { x: 250, y: 280 });

    expect(next.currentPoint).toEqual({ x: 250, y: 280 });
    expect(next.delta).toEqual({ x: 150, y: 80 });
    expect(next.startPoint).toEqual(session.startPoint);
    expect(next.pointerId).toBe(1);
  });

  it('does not mutate the previous session', () => {
    const session = beginDrag({ pointerId: 1, point: { x: 0, y: 0 }, context: null });
    const updated = updateDrag(session, { x: 10, y: 20 });
    expect(session.currentPoint).toEqual({ x: 0, y: 0 });
    expect(session.delta).toEqual({ x: 0, y: 0 });
    expect(updated).not.toBe(session);
  });

  it('preserves context across updates', () => {
    const session = beginDrag({ pointerId: 1, point: { x: 0, y: 0 }, context: { foo: 'bar' } });
    const next = updateDrag(session, { x: 1, y: 1 });
    expect(next.context).toBe(session.context);
  });
});

describe('commitDrag and cancelDrag', () => {
  it('commitDrag returns a committed outcome containing the final session', () => {
    const session = beginDrag({ pointerId: 1, point: { x: 0, y: 0 }, context: null });
    const updated = updateDrag(session, { x: 5, y: 0 });
    const outcome = commitDrag(updated);

    expect(outcome.status).toBe('committed');
    expect(outcome.session).toBe(updated);
  });

  it('cancelDrag returns a cancelled outcome containing the final session', () => {
    const session = beginDrag({ pointerId: 1, point: { x: 0, y: 0 }, context: null });
    const outcome = cancelDrag(session);

    expect(outcome.status).toBe('cancelled');
    expect(outcome.session).toBe(session);
  });
});

describe('drag thresholds', () => {
  it('exceedsDragThreshold compares distance against threshold', () => {
    const session = beginDrag({ pointerId: 1, point: { x: 0, y: 0 }, context: null });
    expect(exceedsDragThreshold(updateDrag(session, { x: 3, y: 4 }), 4.99)).toBe(true);
    expect(exceedsDragThreshold(updateDrag(session, { x: 3, y: 4 }), 5.01)).toBe(false);
    expect(exceedsDragThreshold(session, 0)).toBe(true);
  });
});
