export type CommitResult = { ok: boolean; error?: string };

export type DrawOutlineTarget =
  | { kind: 'footprint'; deckId: null }
  | { kind: 'deck'; deckId: string };

export type DeckInteractionTelemetry = {
  selectedDeckId: string | null;
  housePolygonSource: 'custom_saved' | 'preset_derived' | null;
  selectedDeckType: 'none' | 'preset_snapped' | 'preset_free' | 'custom_outline' | 'preset_unresolved';
  dragEligible: boolean;
  dragReason: string | null;
  hostEdgeResolvable: boolean;
  relationshipDimensionsAvailable: boolean;
  snapState: 'idle' | 'free' | 'snapped';
  snapMessage: string | null;
};
