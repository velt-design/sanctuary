export type PlanPoint = { x: number; y: number };

export type DragSession<TContext> = {
  status: 'active';
  pointerId: number;
  startPoint: PlanPoint;
  currentPoint: PlanPoint;
  delta: PlanPoint;
  context: TContext;
};

export type DragOutcome<TContext> =
  | { status: 'committed'; session: DragSession<TContext> }
  | { status: 'cancelled'; session: DragSession<TContext> };

export function beginDrag<TContext>(input: {
  pointerId: number;
  point: PlanPoint;
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
  point: PlanPoint,
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

export function dragDistance<TContext>(session: DragSession<TContext>): number {
  return Math.hypot(session.delta.x, session.delta.y);
}

export function exceedsDragThreshold<TContext>(
  session: DragSession<TContext>,
  thresholdMm: number,
): boolean {
  return dragDistance(session) >= thresholdMm;
}
