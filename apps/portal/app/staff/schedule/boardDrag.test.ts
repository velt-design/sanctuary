import { describe, expect, it } from 'vitest';
import { resolveBoardDropTarget, type BoardDragLane, type BoardDragRect } from './boardDrag';

function rect(left: number, top: number, width = 240, height = 48): BoardDragRect {
  return { left, top, width, height };
}

function lane(id: string, itemIds: string[], top = 100): BoardDragLane {
  const itemRects: BoardDragLane['itemRects'] = {};
  itemIds.forEach((itemId, index) => {
    itemRects[itemId] = rect(100, top + index * 56);
  });
  return {
    id,
    itemIds,
    rect: rect(80, top - 20, 280, Math.max(120, itemIds.length * 56 + 40)),
    itemRects,
  };
}

describe('resolveBoardDropTarget', () => {
  it('resolves an unscheduled job dropped into an empty lane to index 0', () => {
    const target = resolveBoardDropTarget({
      activeId: 'job-a',
      sourceLaneId: null,
      overId: 'lane:crew-a',
      point: { x: 120, y: 120 },
      lanes: [lane('crew-a', [])],
    });

    expect(target).toMatchObject({
      valid: true,
      kind: 'lane',
      laneId: 'crew-a',
      insertionIndex: 0,
      placement: 'end',
    });
  });

  it('resolves a drop above a card before that card', () => {
    const target = resolveBoardDropTarget({
      activeId: 'job-a',
      sourceLaneId: null,
      overId: 'job-b',
      point: { x: 120, y: 108 },
      lanes: [lane('crew-a', ['job-b', 'job-c'])],
    });

    expect(target).toMatchObject({
      valid: true,
      kind: 'lane',
      laneId: 'crew-a',
      insertionIndex: 0,
      placement: 'before',
      overId: 'job-b',
    });
  });

  it('resolves a drop below a card midpoint after that card', () => {
    const target = resolveBoardDropTarget({
      activeId: 'job-a',
      sourceLaneId: null,
      overId: 'job-b',
      point: { x: 120, y: 132 },
      lanes: [lane('crew-a', ['job-b', 'job-c'])],
    });

    expect(target).toMatchObject({
      valid: true,
      kind: 'lane',
      laneId: 'crew-a',
      insertionIndex: 1,
      placement: 'before',
      overId: 'job-c',
    });
  });

  it('adjusts same-lane reorder index after removing the active item', () => {
    const target = resolveBoardDropTarget({
      activeId: 'job-a',
      sourceLaneId: 'crew-a',
      overId: 'job-c',
      point: { x: 120, y: 245 },
      lanes: [lane('crew-a', ['job-a', 'job-b', 'job-c', 'job-d'])],
    });

    expect(target).toMatchObject({
      valid: true,
      kind: 'lane',
      laneId: 'crew-a',
      insertionIndex: 2,
      overId: 'job-d',
    });
  });

  it('resolves cross-lane move into only the target lane', () => {
    const target = resolveBoardDropTarget({
      activeId: 'job-a',
      sourceLaneId: 'crew-a',
      overId: 'job-c',
      point: { x: 420, y: 132 },
      lanes: [
        lane('crew-a', ['job-a', 'job-b']),
        {
          id: 'crew-b',
          itemIds: ['job-c', 'job-d'],
          rect: rect(390, 80, 280, 200),
          itemRects: {
            'job-c': rect(410, 100),
            'job-d': rect(410, 156),
          },
        },
      ],
    });

    expect(target).toMatchObject({
      valid: true,
      kind: 'lane',
      laneId: 'crew-b',
      insertionIndex: 1,
    });
  });

  it('does not jump to the current job when pointer is lower in a long lane', () => {
    const itemIds = ['current-job', ...Array.from({ length: 20 }, (_, index) => `job-${index + 1}`)];
    const target = resolveBoardDropTarget({
      activeId: 'unscheduled-job',
      sourceLaneId: null,
      overId: 'current-job',
      point: { x: 120, y: 100 + 12 * 56 + 40 },
      lanes: [lane('crew-a', itemIds)],
    });

    expect(target).toMatchObject({
      valid: true,
      kind: 'lane',
      laneId: 'crew-a',
      insertionIndex: 13,
    });
    expect(target.kind === 'lane' ? target.overId : null).not.toBe('current-job');
  });

  it('ignores a stale overId from another lane when pointer is inside a different lane', () => {
    const target = resolveBoardDropTarget({
      activeId: 'job-a',
      sourceLaneId: 'crew-a',
      overId: 'job-b',
      point: { x: 420, y: 132 },
      lanes: [
        lane('crew-a', ['job-a', 'job-b']),
        {
          id: 'crew-b',
          itemIds: ['job-c', 'job-d'],
          rect: rect(390, 80, 280, 200),
          itemRects: {
            'job-c': rect(410, 100),
            'job-d': rect(410, 156),
          },
        },
      ],
    });

    expect(target).toMatchObject({
      valid: true,
      kind: 'lane',
      laneId: 'crew-b',
      insertionIndex: 1,
    });
  });
});
