import type { Point2 } from '@sp/geometry';

export type DragSession<TContext> = {
  status: 'active';
  pointerId: number;
  startPoint: Point2;
  currentPoint: Point2;
  delta: Point2;
  context: TContext;
};

type DragOutcome<TContext> =
  | { status: 'committed'; session: DragSession<TContext> }
  | { status: 'cancelled'; session: DragSession<TContext> };

export function beginDrag<TContext>(input: {
  pointerId: number;
  point: Point2;
  context: TContext;
}): DragSession<TContext> {
  return {
    status: 'active',
    pointerId: input.pointerId,
    startPoint: { ...input.point },
    currentPoint: { ...input.point },
    delta: { x: 0, y: 0 },
    context: input.context,
  };
}

export function updateDrag<TContext>(
  session: DragSession<TContext>,
  point: Point2,
): DragSession<TContext> {
  return {
    ...session,
    currentPoint: { ...point },
    delta: { x: point.x - session.startPoint.x, y: point.y - session.startPoint.y },
  };
}

export function commitDrag<TContext>(session: DragSession<TContext>): DragOutcome<TContext> {
  return { status: 'committed', session };
}

export function cancelDrag<TContext>(session: DragSession<TContext>): DragOutcome<TContext> {
  return { status: 'cancelled', session };
}

function dragDistance<TContext>(session: DragSession<TContext>): number {
  return Math.hypot(session.delta.x, session.delta.y);
}

export function exceedsDragThreshold<TContext>(
  session: DragSession<TContext>,
  thresholdMm: number,
): boolean {
  return dragDistance(session) >= thresholdMm;
}
