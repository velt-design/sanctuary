import { describe, expect, it } from 'vitest';
import {
  createDrawingWorkbenchUiState,
  normalizeDrawingWorkbenchUiState,
} from './drawingWorkbenchUiState';

describe('drawingWorkbenchUiState', () => {
  it('strips legacy diagnostics rail tab overrides from initial ui state', () => {
    const ui = createDrawingWorkbenchUiState({
      activeRailTab: 'diagnostics',
      activeObjectRef: { family: 'decks', objectId: 'deck-1' },
    });

    expect(ui.activeObjectRef).toEqual({ family: 'decks', objectId: 'deck-1' });
    expect('activeRailTab' in ui).toBe(false);
    expect('activeObjectFamily' in ui).toBe(false);
  });

  it('strips legacy rail tab state without translating it to object selection', () => {
    const ui = normalizeDrawingWorkbenchUiState(
      {
        activeRailTab: 'pergolas',
      },
      {
        pergolaIds: ['pergola-1'],
      },
    );

    expect(ui.activeObjectRef).toEqual({ family: 'house_forms', objectId: null });
    expect('activeRailTab' in ui).toBe(false);
  });

  it('strips retired route-selection overrides instead of translating them', () => {
    const ui = normalizeDrawingWorkbenchUiState(
      {
        workbenchMode: 'pergolas',
        activeHouseSelection: { kind: 'deck', targetId: 'deck-1' },
        activeObjectFamily: 'openings',
      },
      {
        deckIds: ['deck-1'],
        openingIds: ['opening-1'],
        pergolaIds: ['pergola-1'],
      },
    );

    expect(ui.activeObjectRef).toEqual({ family: 'house_forms', objectId: null });
    expect(ui.selection).toEqual({ kind: 'none', targetId: null });
    expect('activeRailTab' in ui).toBe(false);
    expect('workbenchMode' in ui).toBe(false);
    expect('activeHouseSelection' in ui).toBe(false);
    expect('activeObjectFamily' in ui).toBe(false);
  });

  it('strips retired model viewport mode instead of translating it', () => {
    const initial = createDrawingWorkbenchUiState({
      viewportMode: 'model',
    });
    const normalized = normalizeDrawingWorkbenchUiState({
      viewportMode: 'model',
    }, {});

    expect(initial.viewportMode).toBe('sheet');
    expect(normalized.viewportMode).toBe('sheet');
  });

  it('strips retired activeView state instead of carrying plan-only view state', () => {
    const initial = createDrawingWorkbenchUiState({
      activeView: 'some-removed-tab',
    });
    const normalized = normalizeDrawingWorkbenchUiState({
      activeView: 'some-removed-tab',
    }, {});

    expect('activeView' in initial).toBe(false);
    expect('activeView' in normalized).toBe(false);
  });

  it('strips retired hover and drag interaction state', () => {
    const initial = createDrawingWorkbenchUiState({
      hover: { kind: 'house_edge', targetId: 'house-main' },
      drag: { kind: 'house_edge', targetId: 'house-main' },
    });
    const normalized = normalizeDrawingWorkbenchUiState(
      {
        hover: { kind: 'pergola', targetId: 'pergola-1' },
        drag: { kind: 'house_edge', targetId: 'house-main' },
      },
      {
        pergolaIds: ['pergola-1'],
      },
    );

    expect('hover' in initial).toBe(false);
    expect('drag' in initial).toBe(false);
    expect('hover' in normalized).toBe(false);
    expect('drag' in normalized).toBe(false);
  });
});
