type DeckInteractionSelectedType =
  | 'none'
  | 'preset_snapped'
  | 'preset_floating'
  | 'custom_outline'
  | 'preset_unresolved';

export type DeckInteractionCapability = {
  selectedDeckType: DeckInteractionSelectedType;
  dragEligible: boolean;
  dragReason: string | null;
  hostEdgeResolvable: boolean;
  relationshipDimensionsAvailable: boolean;
  selectionBadgeLabel: string;
};

type DeckInteractionCapabilityDeck = {
  shape: 'preset' | 'custom';
  presetRect?: unknown | null;
  isAttached: boolean;
};

export function resolveDeckInteractionCapability(input: {
  deck: DeckInteractionCapabilityDeck;
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
    selectedDeckType: input.deck.isAttached ? 'preset_snapped' : 'preset_floating',
    dragEligible: true,
    dragReason: 'Drag the selected deck body to move it freely. Release near a house edge to snap it back, or click dimensions to edit.',
    hostEdgeResolvable: true,
    relationshipDimensionsAvailable: true,
    selectionBadgeLabel: 'Drag deck',
  };
}
