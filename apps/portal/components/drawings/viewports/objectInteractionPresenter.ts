import type { ObjectInteractionViewState } from '@/lib/drawings/interactions/objectInteractionEngine';

export type PreviewHostEdgeState = 'preview' | 'snap-available' | 'snapped';

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

export function resolvePreviewHostEdgeState(viewState: ObjectInteractionViewState | null): PreviewHostEdgeState {
  if (viewState?.placementState === 'snapped') return 'snapped';
  if (viewState?.placementState === 'snap-available') return 'snap-available';
  return 'preview';
}
