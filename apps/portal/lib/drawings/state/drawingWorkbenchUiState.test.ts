import { describe, expect, it } from 'vitest';
import {
  createDrawingWorkbenchUiState,
  normalizeDrawingWorkbenchUiState,
} from './drawingWorkbenchUiState';

describe('drawingWorkbenchUiState', () => {
  it('creates default additive object-first state', () => {
    const state = createDrawingWorkbenchUiState();

    expect(state.activeObjectFamily).toBe('house_forms');
    expect(state.activeObjectRef).toEqual({ family: 'house_forms', objectId: null });
  });

  it('normalizes object-first selection independently from legacy workbench mode state', () => {
    const normalized = normalizeDrawingWorkbenchUiState(
      createDrawingWorkbenchUiState({
        workbenchMode: 'house',
        activeHouseSelection: { kind: 'deck', targetId: 'deck-a' },
        activeObjectFamily: 'decks',
        activeObjectRef: { family: 'pergolas', objectId: 'missing-pergola' },
      }),
      {
        moduleCount: 1,
        deckIds: ['deck-a'],
        pergolaIds: ['pergola-1'],
      },
    );

    expect(normalized.activeHouseSelection).toEqual({ kind: 'deck', targetId: 'deck-a' });
    expect(normalized.activeObjectFamily).toBe('decks');
    expect(normalized.activeObjectRef).toEqual({ family: 'pergolas', objectId: null });
  });

  it('clears invalid object ids without changing a valid requested family', () => {
    const normalized = normalizeDrawingWorkbenchUiState(
      createDrawingWorkbenchUiState({
        activeObjectFamily: 'openings',
        activeObjectRef: { family: 'house_forms', objectId: 'missing-form' },
      }),
      {
        moduleCount: 1,
        houseFormIds: ['form-a'],
        openingIds: ['opening-1'],
      },
    );

    expect(normalized.activeObjectFamily).toBe('openings');
    expect(normalized.activeObjectRef).toEqual({ family: 'house_forms', objectId: null });
  });

  it('preserves legacy pergola normalization semantics', () => {
    const normalized = normalizeDrawingWorkbenchUiState(
      createDrawingWorkbenchUiState({
        workbenchMode: 'pergolas',
        activePergolaId: 'missing',
        activeHouseSelection: { kind: 'roof', targetId: 'roof-1' },
      }),
      {
        moduleCount: 2,
        pergolaIds: ['pergola-1', 'pergola-2'],
      },
    );

    expect(normalized.workbenchMode).toBe('pergolas');
    expect(normalized.activePergolaId).toBe('pergola-1');
    expect(normalized.activeHouseSelection).toEqual({ kind: 'house', targetId: null });
  });

  it('preserves legacy deck and opening selection clearing semantics', () => {
    const normalizedDeck = normalizeDrawingWorkbenchUiState(
      createDrawingWorkbenchUiState({
        workbenchMode: 'house',
        activeHouseSelection: { kind: 'deck', targetId: 'missing-deck' },
      }),
      {
        moduleCount: 1,
        deckIds: ['deck-a'],
      },
    );

    const normalizedOpening = normalizeDrawingWorkbenchUiState(
      createDrawingWorkbenchUiState({
        workbenchMode: 'house',
        activeHouseSelection: { kind: 'opening', targetId: 'missing-opening' },
      }),
      {
        moduleCount: 1,
        openingIds: ['opening-1'],
      },
    );

    expect(normalizedDeck.activeHouseSelection).toEqual({ kind: 'house', targetId: null });
    expect(normalizedOpening.activeHouseSelection).toEqual({ kind: 'house', targetId: null });
  });
});
