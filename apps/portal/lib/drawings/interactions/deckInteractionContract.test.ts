import { describe, expect, it } from 'vitest';
import {
  resolveDeckInteractionCapability,
} from './deckInteractionContract';

const baseDeck = {
  id: 'deck-1',
  name: 'Deck 1',
  kind: 'deck',
  shape: 'preset',
  presetType: 'rect_attached',
  presetRect: { widthM: '4', depthM: '3', centerOffsetM: '0', detachedGapM: null },
  floatingRect: null,
  outline: [],
  elevationMode: 'aligned_to_threshold',
  levelOffsetMm: 0,
  hostEdgeId: 'rear',
  isAttached: true,
  surfaceMaterial: 'timber_decking',
  validation: { status: 'valid', message: null },
} as any;

describe('deckInteractionContract', () => {
  it('derives snapped preset deck capability from one shared source', () => {
    const capability = resolveDeckInteractionCapability({
      deck: baseDeck,
      dragInteractionAvailable: true,
    });

    expect(capability.selectedDeckType).toBe('preset_snapped');
    expect(capability.dragEligible).toBe(true);
    expect(capability.selectionBadgeLabel).toBe('Drag deck');
  });

  it('marks unresolved preset decks as blocked', () => {
    const capability = resolveDeckInteractionCapability({
      deck: { ...baseDeck, hostEdgeId: null },
      dragInteractionAvailable: false,
    });

    expect(capability.selectedDeckType).toBe('preset_unresolved');
    expect(capability.dragEligible).toBe(false);
    expect(capability.selectionBadgeLabel).toBe('Blocked');
  });

});
