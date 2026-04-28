export type ObjectInteractionPhase = 'idle' | 'hover' | 'selected' | 'drag-intent' | 'dragging' | 'settling';

export type ObjectInteractionActivePhase = Extract<ObjectInteractionPhase, 'drag-intent' | 'dragging' | 'settling'>;

export type ObjectInteractionPlacementState = 'none' | 'snap-available' | 'snapped' | 'floating' | 'blocked';
export type ObjectInteractionReleaseOutcome = 'none' | 'pending' | 'committed' | 'failed';
export type ObjectInteractionReleasePlacement = 'snapped' | 'floating';
export type ObjectInteractionSettleVisualState = 'holding-preview' | 'reconciling' | 'complete' | 'failed';
export type ObjectInteractionAffordanceState =
  | 'idle'
  | 'hover'
  | 'grabbed'
  | 'floating'
  | 'snap-available'
  | 'snapped'
  | 'blocked'
  | 'settling';
export type ObjectInteractionReferenceGuideState = 'none' | 'witness' | 'snap-lane';
export type ObjectInteractionPreviewBodyState =
  | 'grabbed'
  | 'floating'
  | 'snap-available'
  | 'snapped'
  | 'blocked'
  | 'settling';
export type ObjectInteractionPreviewTargetState = 'preview' | 'snap-available' | 'snapped';

export type ObjectInteractionPreviewAnchor = {
  x: number;
  y: number;
};

export type ObjectInteractionPreviewOwnerKind = 'deck' | 'opening';

export type ObjectInteractionPreviewReferenceGuide<TPoint extends ObjectInteractionPreviewAnchor> = {
  start: TPoint;
  end: TPoint;
  state: Exclude<ObjectInteractionReferenceGuideState, 'none'>;
};

export type ObjectInteractionPreviewTargetHighlight<TPoint extends ObjectInteractionPreviewAnchor> = {
  start: TPoint;
  end: TPoint;
  state: ObjectInteractionPreviewTargetState;
};

export type ObjectInteractionPreviewOverlay<TPoint extends ObjectInteractionPreviewAnchor> = {
  ownerKind: ObjectInteractionPreviewOwnerKind;
  ownerId: string;
  polygon: TPoint[];
  bodyState: ObjectInteractionPreviewBodyState;
  anchorPoint: TPoint | null;
  referenceGuide: ObjectInteractionPreviewReferenceGuide<TPoint> | null;
  targetHighlight: ObjectInteractionPreviewTargetHighlight<TPoint> | null;
};

export type ObjectInteractionViewState = {
  phase: ObjectInteractionPhase;
  placementState: ObjectInteractionPlacementState;
  statusLabel: string | null;
  statusDetail: string | null;
  canCommit: boolean;
  highlightTargetId: string | null;
  previewAnchor: ObjectInteractionPreviewAnchor | null;
  releaseOutcome: ObjectInteractionReleaseOutcome;
  releasePlacement: ObjectInteractionReleasePlacement | null;
  settleVisualState: ObjectInteractionSettleVisualState | null;
  affordanceState: ObjectInteractionAffordanceState;
  referenceGuideState: ObjectInteractionReferenceGuideState;
};

export type ObjectInteractionTelemetry<TObjectKind extends string = string> = {
  objectKind: TObjectKind;
  selectedObjectId: string | null;
  hoveredObjectId: string | null;
  phase: ObjectInteractionPhase;
  placementState: ObjectInteractionPlacementState;
  releaseOutcome: ObjectInteractionReleaseOutcome;
  releasePlacement: ObjectInteractionReleasePlacement | null;
  settleVisualState: ObjectInteractionSettleVisualState | null;
  statusLabel: string | null;
  statusDetail: string | null;
  canCommit: boolean;
  highlightTargetId: string | null;
  previewAnchor: ObjectInteractionPreviewAnchor | null;
  affordanceState: ObjectInteractionAffordanceState;
  referenceGuideState: ObjectInteractionReferenceGuideState;
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
    releaseOutcome: state.releaseOutcome ?? 'none',
    releasePlacement: state.releasePlacement ?? null,
    settleVisualState: state.settleVisualState ?? null,
    affordanceState: state.affordanceState ?? 'idle',
    referenceGuideState: state.referenceGuideState ?? 'none',
  };
}

export function buildObjectInteractionTelemetry<TObjectKind extends string>(input: {
  objectKind: TObjectKind;
  selectedObjectId?: string | null;
  hoveredObjectId?: string | null;
  viewState: ObjectInteractionViewState;
}): ObjectInteractionTelemetry<TObjectKind> {
  return {
    objectKind: input.objectKind,
    selectedObjectId: input.selectedObjectId ?? null,
    hoveredObjectId: input.hoveredObjectId ?? null,
    phase: input.viewState.phase,
    placementState: input.viewState.placementState,
    releaseOutcome: input.viewState.releaseOutcome,
    releasePlacement: input.viewState.releasePlacement,
    settleVisualState: input.viewState.settleVisualState,
    statusLabel: input.viewState.statusLabel,
    statusDetail: input.viewState.statusDetail,
    canCommit: input.viewState.canCommit,
    highlightTargetId: input.viewState.highlightTargetId,
    previewAnchor: input.viewState.previewAnchor,
    affordanceState: input.viewState.affordanceState,
    referenceGuideState: input.viewState.referenceGuideState,
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
