export type BoardDragPoint = {
  x: number;
  y: number;
};

export type BoardDragRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type BoardDragLane = {
  id: string;
  itemIds: string[];
  rect: BoardDragRect | null;
  itemRects: Record<string, BoardDragRect | null | undefined>;
};

export type BoardDropTarget =
  | {
      valid: true;
      kind: 'lane';
      laneId: string;
      insertionIndex: number;
      placement: 'before' | 'after' | 'end';
      overId: string | null;
    }
  | {
      valid: true;
      kind: 'unscheduled';
      overId: 'unscheduled';
    }
  | {
      valid: false;
      kind: 'none';
      overId: string | null;
    };

type ResolveBoardDropInput = {
  activeId: string;
  sourceLaneId: string | null;
  overId: string | null;
  point: BoardDragPoint | null;
  lanes: BoardDragLane[];
  unscheduledRect?: BoardDragRect | null;
};

function right(rect: BoardDragRect): number {
  return rect.left + rect.width;
}

function bottom(rect: BoardDragRect): number {
  return rect.top + rect.height;
}

function containsPoint(rect: BoardDragRect, point: BoardDragPoint): boolean {
  return point.x >= rect.left && point.x <= right(rect) && point.y >= rect.top && point.y <= bottom(rect);
}

function verticalMidpoint(rect: BoardDragRect): number {
  return rect.top + rect.height / 2;
}

function laneForOverId(lanes: BoardDragLane[], overId: string | null): BoardDragLane | null {
  if (!overId) return null;
  const lanePrefix = 'lane:';
  if (overId.startsWith(lanePrefix)) {
    const laneId = overId.slice(lanePrefix.length);
    return lanes.find((lane) => lane.id === laneId) ?? null;
  }
  return lanes.find((lane) => lane.itemIds.includes(overId)) ?? null;
}

function laneForPoint(lanes: BoardDragLane[], point: BoardDragPoint | null): BoardDragLane | null {
  if (!point) return null;
  return lanes.find((lane) => lane.rect && containsPoint(lane.rect, point)) ?? null;
}

function insertionForLane(input: {
  activeId: string;
  lane: BoardDragLane;
  overId: string | null;
  point: BoardDragPoint | null;
}): { insertionIndex: number; placement: 'before' | 'after' | 'end'; overId: string | null } {
  const itemIds = input.lane.itemIds.filter((id) => id !== input.activeId);
  if (!itemIds.length) return { insertionIndex: 0, placement: 'end', overId: `lane:${input.lane.id}` };

  if (input.point) {
    for (let index = 0; index < itemIds.length; index += 1) {
      const id = itemIds[index];
      const rect = input.lane.itemRects[id];
      if (!rect) continue;
      if (input.point.y < verticalMidpoint(rect)) {
        return { insertionIndex: index, placement: 'before', overId: id };
      }
    }
    return { insertionIndex: itemIds.length, placement: 'end', overId: `lane:${input.lane.id}` };
  }

  if (input.overId && itemIds.includes(input.overId)) {
    return { insertionIndex: itemIds.indexOf(input.overId), placement: 'before', overId: input.overId };
  }

  return { insertionIndex: itemIds.length, placement: 'end', overId: `lane:${input.lane.id}` };
}

export function resolveBoardDropTarget(input: ResolveBoardDropInput): BoardDropTarget {
  const overId = input.overId;

  if (input.point && input.unscheduledRect && containsPoint(input.unscheduledRect, input.point)) {
    return { valid: true, kind: 'unscheduled', overId: 'unscheduled' };
  }
  if (!input.point && overId === 'unscheduled') {
    return { valid: true, kind: 'unscheduled', overId: 'unscheduled' };
  }

  const pointLane = laneForPoint(input.lanes, input.point);
  const fallbackLane = laneForOverId(input.lanes, overId);
  const lane = pointLane ?? fallbackLane;
  if (!lane) return { valid: false, kind: 'none', overId };

  const insertion = insertionForLane({
    activeId: input.activeId,
    lane,
    overId: pointLane ? null : overId,
    point: input.point,
  });

  return {
    valid: true,
    kind: 'lane',
    laneId: lane.id,
    insertionIndex: insertion.insertionIndex,
    placement: insertion.placement,
    overId: insertion.overId,
  };
}
