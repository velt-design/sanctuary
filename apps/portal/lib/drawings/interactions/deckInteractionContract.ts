import { resolveDeckPlacementMode, type HouseModel } from '@/lib/drawings/state/houseFirstWorkbenchModel';
import type {
  ObjectInteractionAffordanceState,
  ObjectInteractionPhase,
  ObjectInteractionPlacementState,
  ObjectInteractionPreviewAnchor,
  ObjectInteractionReferenceGuideState,
  ObjectInteractionReleaseOutcome,
  ObjectInteractionReleasePlacement,
  ObjectInteractionSettleVisualState,
} from './objectInteractionEngine';

export type DeckInteractionSelectedType =
  | 'none'
  | 'preset_snapped'
  | 'preset_floating'
  | 'custom_outline'
  | 'preset_unresolved';

export type DeckInteractionState =
  | 'idle'
  | 'selected'
  | 'drag-intent'
  | 'dragging'
  | 'snap-available'
  | 'snapped'
  | 'floating'
  | 'blocked'
  | 'commit';

export type DeckInteractionCapability = {
  selectedDeckType: DeckInteractionSelectedType;
  dragEligible: boolean;
  dragReason: string | null;
  hostEdgeResolvable: boolean;
  relationshipDimensionsAvailable: boolean;
  selectionBadgeLabel: string;
};

export type DeckInteractionHint = {
  state: DeckInteractionState;
  label: string;
  detail: string | null;
};

export type DeckInteractionTelemetry = {
  selectedDeckId: string | null;
  hoveredDeckId: string | null;
  housePolygonSource: 'custom_saved' | 'preset_derived' | null;
  selectedDeckType: DeckInteractionSelectedType;
  dragEligible: boolean;
  dragReason: string | null;
  hostEdgeResolvable: boolean;
  relationshipDimensionsAvailable: boolean;
  phase: ObjectInteractionPhase;
  placementState: ObjectInteractionPlacementState;
  releaseOutcome: ObjectInteractionReleaseOutcome;
  releasePlacement: ObjectInteractionReleasePlacement | null;
  settleVisualState: ObjectInteractionSettleVisualState | null;
  snapState: 'idle' | 'floating' | 'snap-available' | 'snapped' | 'blocked';
  snapMessage: string | null;
  interactionState: DeckInteractionState;
  interactionLabel: string | null;
  canCommit: boolean;
  highlightTargetId: string | null;
  previewAnchor: ObjectInteractionPreviewAnchor | null;
  affordanceState: ObjectInteractionAffordanceState;
  referenceGuideState: ObjectInteractionReferenceGuideState;
};

export function resolveDeckSelectedTypeFromShape(input: {
  custom: boolean;
  interactionPlacement: 'snapped' | 'floating' | null;
}): DeckInteractionSelectedType {
  if (input.custom) return 'custom_outline';
  if (input.interactionPlacement === 'snapped') return 'preset_snapped';
  if (input.interactionPlacement === 'floating') return 'preset_floating';
  return 'preset_unresolved';
}

export function resolveDeckInteractionCapability(input: {
  deck: HouseModel['decks'][number];
  dragInteractionAvailable: boolean;
}): DeckInteractionCapability {
  const hostEdgeResolvable = input.dragInteractionAvailable;

  if (input.deck.shape === 'custom') {
    return {
      selectedDeckType: 'custom_outline',
      dragEligible: hostEdgeResolvable,
      dragReason: hostEdgeResolvable
        ? 'Drag the selected custom deck body to translate it relative to the house, or click relationship dimensions and outline edges to edit.'
        : 'This custom deck needs a resolvable house reference edge before translation and relationship dims are available.',
      hostEdgeResolvable,
      relationshipDimensionsAvailable: hostEdgeResolvable,
      selectionBadgeLabel: hostEdgeResolvable ? 'Drag deck' : 'Blocked',
    };
  }

  if (!hostEdgeResolvable || !input.deck.presetRect) {
    return {
      selectedDeckType: 'preset_unresolved',
      dragEligible: false,
      dragReason: 'This preset deck needs a resolvable house reference edge before drag and relationship dims are available.',
      hostEdgeResolvable,
      relationshipDimensionsAvailable: false,
      selectionBadgeLabel: 'Blocked',
    };
  }

  return {
    selectedDeckType: resolveDeckPlacementMode(input.deck.isAttached) === 'snapped' ? 'preset_snapped' : 'preset_floating',
    dragEligible: true,
    dragReason: 'Drag the selected deck body to move it freely. Release near a house edge to snap it back, or click dimensions to edit.',
    hostEdgeResolvable: true,
    relationshipDimensionsAvailable: true,
    selectionBadgeLabel: 'Drag deck',
  };
}

export function buildDeckInteractionCapabilityFromSelection(input: {
  custom: boolean;
  interactionPlacement: 'snapped' | 'floating' | null;
  dragEligible: boolean;
  dragReason: string | null;
  hostEdgeResolvable: boolean;
  relationshipDimensionsAvailable: boolean;
}): DeckInteractionCapability {
  return {
    selectedDeckType: resolveDeckSelectedTypeFromShape({
      custom: input.custom,
      interactionPlacement: input.interactionPlacement,
    }),
    dragEligible: input.dragEligible,
    dragReason: input.dragReason,
    hostEdgeResolvable: input.hostEdgeResolvable,
    relationshipDimensionsAvailable: input.relationshipDimensionsAvailable,
    selectionBadgeLabel: input.dragEligible ? 'Drag deck' : 'Blocked',
  };
}

export function resolveDeckInteractionHint(input: {
  capability: DeckInteractionCapability | null;
  phase: ObjectInteractionPhase;
  previewState:
    | {
        placement: 'snapped' | 'floating';
        releasePlacement: 'snapped' | 'floating';
      }
    | null;
}): DeckInteractionHint | null {
  const capability = input.capability;
  if (!capability) return null;

  if (!capability.dragEligible) {
    return {
      state: 'blocked',
      label: 'Blocked',
      detail: capability.dragReason,
    };
  }

  if (input.phase === 'settling') {
    return {
      state: 'commit',
      label: 'Applying deck position',
      detail: 'Local preview is held while the draft settles.',
    };
  }

  if (input.phase === 'drag-intent') {
    return {
      state: 'drag-intent',
      label: 'Deck grabbed',
      detail: 'Move a little more to start dragging.',
    };
  }

  if (input.previewState) {
    if (input.previewState.releasePlacement === 'snapped') {
      if (input.previewState.placement === 'snapped') {
        return {
          state: 'snapped',
          label: 'Snapped',
          detail: 'Release to keep the deck attached to the host edge.',
        };
      }
      return {
        state: 'snap-available',
        label: 'Snap on release',
        detail: 'Release near the house edge to attach the deck.',
      };
    }

    return {
      state: 'floating',
      label: 'Floating',
      detail: 'Release to keep the current witness offset.',
    };
  }

  if (input.phase === 'dragging') {
    return {
      state: 'dragging',
      label: 'Dragging deck',
      detail: capability.dragReason,
    };
  }

  return {
    state: 'selected',
    label: capability.selectionBadgeLabel,
    detail: capability.dragReason,
  };
}
