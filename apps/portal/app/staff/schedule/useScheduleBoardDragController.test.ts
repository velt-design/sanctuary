import { describe, expect, it } from 'vitest';
import { boardEdgeScrollDelta, dragPointerFromEvent } from './useScheduleBoardDragController';

describe('Schedule Board drag controller geometry', () => {
  it('uses the current keyboard delta when the translated rectangle still describes the previous frame', () => {
    const initial = { left: 100, top: 200, width: 240, height: 120 };
    expect(dragPointerFromEvent({
      activatorEvent: {}, delta: { x: 0, y: 160 },
      active: { id: 'job', rect: { current: { initial, translated: initial } } }, over: null,
    } as any)).toEqual({ x: 220, y: 420 });
  });
  it('tracks the pointer from its activation point instead of the dragged card centre', () => {
    const point = dragPointerFromEvent({
      activatorEvent: { clientX: 118, clientY: 246 },
      delta: { x: 32, y: -16 },
      active: {
        id: 'job-a',
        rect: { current: { translated: { left: 400, top: 500, width: 240, height: 120 } } },
      },
      over: null,
    } as any);

    expect(point).toEqual({ x: 150, y: 230 });
  });

  it('uses proportional edge pressure with a bounded scroll step', () => {
    expect(boardEdgeScrollDelta(0, 0, 300)).toBe(-24);
    expect(boardEdgeScrollDelta(290, 0, 300)).toBeGreaterThan(0);
    expect(boardEdgeScrollDelta(150, 0, 300)).toBe(0);
  });
});
