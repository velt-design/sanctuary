import type {
  ObjectInteractionPreviewBodyState,
  ObjectInteractionPreviewOverlay,
  ObjectInteractionPreviewTargetState,
  ObjectInteractionViewState,
} from '@/lib/drawings/interactions/objectInteractionEngine';

export type ObjectInteractionHudModel = {
  visible: boolean;
  tone: 'ready' | 'snapped' | 'blocked';
  label: string | null;
  detail: string | null;
};

export function buildObjectInteractionHudModel(viewState: ObjectInteractionViewState | null): ObjectInteractionHudModel {
  if (!viewState || !viewState.statusLabel) {
    return {
      visible: false,
      tone: 'ready',
      label: null,
      detail: null,
    };
  }

  const visible =
    viewState.releaseOutcome !== 'none' ||
    viewState.placementState === 'blocked' ||
    (viewState.phase !== 'idle' && viewState.phase !== 'hover' && viewState.phase !== 'selected');

  return {
    visible,
    tone:
      viewState.releaseOutcome === 'failed' || viewState.placementState === 'blocked'
        ? 'blocked'
        : viewState.releasePlacement === 'snapped' || viewState.placementState === 'snapped'
          ? 'snapped'
          : 'ready',
    label: viewState.statusLabel,
    detail: viewState.statusDetail,
  };
}

export function resolveObjectInteractionPreviewTargetState(
  viewState: ObjectInteractionViewState | null,
): ObjectInteractionPreviewTargetState {
  if (viewState?.placementState === 'snapped') return 'snapped';
  if (viewState?.placementState === 'snap-available') return 'snap-available';
  return 'preview';
}

export function resolveObjectInteractionPreviewBodyState(
  viewState: ObjectInteractionViewState | null,
): ObjectInteractionPreviewBodyState {
  if (viewState?.affordanceState === 'grabbed') return 'grabbed';
  if (viewState?.affordanceState === 'snap-available') return 'snap-available';
  if (viewState?.affordanceState === 'snapped') return 'snapped';
  if (viewState?.affordanceState === 'blocked') return 'blocked';
  if (viewState?.affordanceState === 'settling') return 'settling';
  return 'floating';
}

export function buildObjectInteractionPreviewOverlay<TPoint extends { x: number; y: number }>(input: {
  ownerKind: ObjectInteractionPreviewOverlay<TPoint>['ownerKind'];
  ownerId: string;
  polygon: TPoint[];
  viewState: ObjectInteractionViewState | null;
  anchorPoint?: TPoint | null;
  lockedCornerPoint?: TPoint | null;
  endCatchPoint?: TPoint | null;
  referenceGuide?: ObjectInteractionPreviewOverlay<TPoint>['referenceGuide'];
  targetHighlights?: Array<{
        start: TPoint;
        end: TPoint;
        state?: ObjectInteractionPreviewTargetState;
      }>
    | null;
}): ObjectInteractionPreviewOverlay<TPoint> {
  return {
    ownerKind: input.ownerKind,
    ownerId: input.ownerId,
    polygon: input.polygon,
    bodyState: resolveObjectInteractionPreviewBodyState(input.viewState),
    anchorPoint: input.anchorPoint ?? null,
    lockedCornerPoint: input.lockedCornerPoint ?? null,
    endCatchPoint: input.endCatchPoint ?? null,
    referenceGuide:
      input.viewState?.referenceGuideState !== 'none'
        ? input.referenceGuide ?? null
        : null,
    targetHighlights: (input.targetHighlights ?? []).map((targetHighlight) => ({
      start: targetHighlight.start,
      end: targetHighlight.end,
      state: targetHighlight.state ?? resolveObjectInteractionPreviewTargetState(input.viewState),
    })),
  };
}
