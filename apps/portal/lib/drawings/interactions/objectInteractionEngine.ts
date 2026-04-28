export type ObjectInteractionPhase = 'idle' | 'hover' | 'selected' | 'drag-intent' | 'dragging' | 'settling';

export type ObjectInteractionActivePhase = Extract<ObjectInteractionPhase, 'drag-intent' | 'dragging' | 'settling'>;

export type ObjectInteractionPlacementState = 'none' | 'snap-available' | 'snapped' | 'floating' | 'blocked';

export type ObjectInteractionPreviewAnchor = {
  x: number;
  y: number;
};

export type ObjectInteractionViewState = {
  phase: ObjectInteractionPhase;
  placementState: ObjectInteractionPlacementState;
  statusLabel: string | null;
  statusDetail: string | null;
  canCommit: boolean;
  highlightTargetId: string | null;
  previewAnchor: ObjectInteractionPreviewAnchor | null;
};

export type ObjectInteractionSessionBase = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  phase: ObjectInteractionActivePhase;
};

export const OBJECT_DRAG_INTENT_THRESHOLD_PX = 5;

export function buildObjectInteractionViewState(
  state: Partial<ObjectInteractionViewState> & Pick<ObjectInteractionViewState, 'phase'>,
): ObjectInteractionViewState {
  return {
    phase: state.phase,
    placementState: state.placementState ?? 'none',
    statusLabel: state.statusLabel ?? null,
    statusDetail: state.statusDetail ?? null,
    canCommit: state.canCommit ?? false,
    highlightTargetId: state.highlightTargetId ?? null,
    previewAnchor: state.previewAnchor ?? null,
  };
}

export function createObjectInteractionSession<TSession extends Omit<ObjectInteractionSessionBase, 'phase'> & {
  phase?: ObjectInteractionActivePhase;
}>(session: TSession): TSession & ObjectInteractionSessionBase {
  return {
    ...session,
    phase: session.phase ?? 'drag-intent',
  };
}

export function setObjectInteractionPhase<TSession extends ObjectInteractionSessionBase>(
  session: TSession,
  phase: ObjectInteractionActivePhase,
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
  nextPhase: ObjectInteractionActivePhase;
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
