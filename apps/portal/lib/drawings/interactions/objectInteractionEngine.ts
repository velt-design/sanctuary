export type ObjectInteractionPhase = 'idle' | 'drag-intent' | 'dragging' | 'settling';

export type ObjectInteractionSessionBase = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  phase: Exclude<ObjectInteractionPhase, 'idle'>;
};

export const OBJECT_DRAG_INTENT_THRESHOLD_PX = 5;

export function createObjectInteractionSession<TSession extends Omit<ObjectInteractionSessionBase, 'phase'> & {
  phase?: Exclude<ObjectInteractionPhase, 'idle'>;
}>(session: TSession): TSession & ObjectInteractionSessionBase {
  return {
    ...session,
    phase: session.phase ?? 'drag-intent',
  };
}

export function setObjectInteractionPhase<TSession extends ObjectInteractionSessionBase>(
  session: TSession,
  phase: Exclude<ObjectInteractionPhase, 'idle'>,
): TSession {
  return {
    ...session,
    phase,
  };
}

export function resolveObjectInteractionMove<TSession extends ObjectInteractionSessionBase>(input: {
  session: TSession;
  clientX: number;
  clientY: number;
  thresholdPx?: number;
}): {
  distancePx: number;
  crossedDragThreshold: boolean;
  nextPhase: Exclude<ObjectInteractionPhase, 'idle'>;
} {
  const thresholdPx = input.thresholdPx ?? OBJECT_DRAG_INTENT_THRESHOLD_PX;
  const distancePx = Math.hypot(input.clientX - input.session.startClientX, input.clientY - input.session.startClientY);
  const crossedDragThreshold = input.session.phase !== 'drag-intent' || distancePx >= thresholdPx;

  return {
    distancePx,
    crossedDragThreshold,
    nextPhase: crossedDragThreshold ? 'dragging' : 'drag-intent',
  };
}
