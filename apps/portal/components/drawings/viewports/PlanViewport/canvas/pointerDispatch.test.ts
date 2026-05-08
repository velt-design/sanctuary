import { describe, expect, it } from 'vitest';
import type { GeometryTopProjectionShape } from '@sp/geometry';
import { buildPointerDispatchAction } from './pointerDispatch';

const DECK_SHAPE: GeometryTopProjectionShape = {
  id: 'deck-1-shape',
  sourceObjectId: 'deck-1',
  sourceId: 'deck-1',
  sourceType: 'house_surface_solid',
  family: 'house',
  kind: 'deck',
  polygon: [],
  zOrder: 0,
  zMin: null,
  zMax: null,
};

describe('buildPointerDispatchAction', () => {
  describe('null point (cursor unresolvable)', () => {
    it('skips down events with null point regardless of shape', () => {
      // Regression: before fix, a null point + null shape fell through to
      // a (0, 0) fallback payload that corrupted MoveTool sessions
      // (delta = (0,0) - realStart). The contract is "drop the event,
      // never invent."
      expect(
        buildPointerDispatchAction({
          kind: 'down',
          point: null,
          shape: null,
          button: 0,
          pointerId: 1,
        }),
      ).toEqual({ type: 'skip', reason: 'null_point' });

      expect(
        buildPointerDispatchAction({
          kind: 'down',
          point: null,
          shape: DECK_SHAPE,
          button: 0,
          pointerId: 1,
        }),
      ).toEqual({ type: 'skip', reason: 'null_point' });
    });

    it('skips move events with null point', () => {
      expect(
        buildPointerDispatchAction({
          kind: 'move',
          point: null,
          shape: null,
          button: 0,
          pointerId: 1,
        }),
      ).toEqual({ type: 'skip', reason: 'null_point' });
    });

    it('skips up events with null point', () => {
      expect(
        buildPointerDispatchAction({
          kind: 'up',
          point: null,
          shape: null,
          button: 0,
          pointerId: 1,
        }),
      ).toEqual({ type: 'skip', reason: 'null_point' });
    });
  });

  describe('valid point (down events)', () => {
    it('dispatches with capture=true on down with a shape', () => {
      const action = buildPointerDispatchAction({
        kind: 'down',
        point: { x: 1.5, y: 2.0 },
        shape: DECK_SHAPE,
        button: 0,
        pointerId: 7,
      });
      expect(action.type).toBe('dispatch');
      if (action.type !== 'dispatch') return;
      expect(action.kind).toBe('down');
      expect(action.capture).toBe(true);
      expect(action.payload).toEqual({
        shape: DECK_SHAPE,
        point: { x: 1500, y: 2000 },
        button: 0,
        pointerId: 7,
      });
    });

    it('dispatches with capture=true on down without a shape (empty area click)', () => {
      const action = buildPointerDispatchAction({
        kind: 'down',
        point: { x: -3.2, y: 4.7 },
        shape: null,
        button: 0,
        pointerId: 1,
      });
      expect(action.type).toBe('dispatch');
      if (action.type !== 'dispatch') return;
      expect(action.capture).toBe(true);
    });

    it('preserves the (0, 0) world coord as a valid point (NOT a sentinel)', () => {
      // (0, 0) world coord is a real position (project origin). The bug we
      // fixed was treating clientX=0,clientY=0 as bogus at the cancel
      // handler; the dispatch helper should not second-guess valid (0, 0)
      // world coords.
      const action = buildPointerDispatchAction({
        kind: 'down',
        point: { x: 0, y: 0 },
        shape: DECK_SHAPE,
        button: 0,
        pointerId: 1,
      });
      expect(action.type).toBe('dispatch');
      if (action.type !== 'dispatch') return;
      expect(action.payload.point).toEqual({ x: 0, y: 0 });
    });
  });

  describe('valid point (move/up events)', () => {
    it('dispatches without capture on move', () => {
      const action = buildPointerDispatchAction({
        kind: 'move',
        point: { x: 5.0, y: 3.0 },
        shape: null,
        button: 0,
        pointerId: 1,
      });
      expect(action.type).toBe('dispatch');
      if (action.type !== 'dispatch') return;
      expect(action.kind).toBe('move');
      expect(action.capture).toBe(false);
      expect(action.payload.point).toEqual({ x: 5000, y: 3000 });
    });

    it('dispatches without capture on up', () => {
      const action = buildPointerDispatchAction({
        kind: 'up',
        point: { x: 1.0, y: 1.0 },
        shape: null,
        button: 0,
        pointerId: 1,
      });
      expect(action.type).toBe('dispatch');
      if (action.type !== 'dispatch') return;
      expect(action.kind).toBe('up');
      expect(action.capture).toBe(false);
    });
  });

  describe('payload shape', () => {
    it('scales meter point to mm payload', () => {
      const action = buildPointerDispatchAction({
        kind: 'down',
        point: { x: 12.345, y: -67.89 },
        shape: null,
        button: 0,
        pointerId: 1,
      });
      if (action.type !== 'dispatch') throw new Error('expected dispatch');
      expect(action.payload.point.x).toBeCloseTo(12345, 3);
      expect(action.payload.point.y).toBeCloseTo(-67890, 3);
    });

    it('preserves button + pointerId verbatim', () => {
      const action = buildPointerDispatchAction({
        kind: 'down',
        point: { x: 1, y: 1 },
        shape: null,
        button: 2,
        pointerId: 42,
      });
      if (action.type !== 'dispatch') throw new Error('expected dispatch');
      expect(action.payload.button).toBe(2);
      expect(action.payload.pointerId).toBe(42);
    });
  });

  describe('regression: deck-runaway scenario', () => {
    it('a normal drag (down + move + up) emits exactly one capture and three dispatches', () => {
      const start = buildPointerDispatchAction({
        kind: 'down',
        point: { x: 24.669, y: -12.959 },
        shape: DECK_SHAPE,
        button: 0,
        pointerId: 1,
      });
      const move = buildPointerDispatchAction({
        kind: 'move',
        point: { x: 25.0, y: -13.0 },
        shape: null,
        button: 0,
        pointerId: 1,
      });
      const end = buildPointerDispatchAction({
        kind: 'up',
        point: { x: 25.169, y: -13.059 },
        shape: null,
        button: 0,
        pointerId: 1,
      });

      const captures = [start, move, end].filter(
        (a) => a.type === 'dispatch' && a.capture,
      );
      const dispatches = [start, move, end].filter((a) => a.type === 'dispatch');

      expect(captures).toHaveLength(1);
      expect(dispatches).toHaveLength(3);
      // Capture is on the down event specifically.
      expect(start.type === 'dispatch' && start.capture).toBe(true);
      expect(move.type === 'dispatch' && move.capture).toBe(false);
      expect(end.type === 'dispatch' && end.capture).toBe(false);
    });
  });
});
