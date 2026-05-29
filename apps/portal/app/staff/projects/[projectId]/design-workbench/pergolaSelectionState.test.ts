import { describe, expect, it } from 'vitest';
import type { DrawingWorkbenchUiState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import { buildPergolaSelectionUiState, resolvePergolaModuleIndex } from './pergolaSelectionState';

function moduleEntry(pergolaId: string) {
  return {
    drawingModule: {
      input: { pergolaId },
    },
  };
}

function ui(overrides: Partial<DrawingWorkbenchUiState> = {}): DrawingWorkbenchUiState {
  return {
    activeView: 'plan',
    activeModuleIndex: 3,
    activeRailTab: 'house_forms',
    activeObjectFamily: 'house_forms',
    activeObjectRef: { family: 'house_forms', objectId: 'house-main' },
    selection: { kind: 'none', targetId: null },
    hover: { kind: 'none', targetId: null },
    drag: { kind: 'none', targetId: null },
    viewportMode: 'model',
    visibility: { house: true, pergolas: true, decks: true, openings: true },
    viewportTransform: { zoom: 1, panX: 0, panY: 0 },
    ...overrides,
  };
}

describe('pergolaSelectionState', () => {
  it('resolves a module-backed pergola id to its solved module index', () => {
    expect(
      resolvePergolaModuleIndex({
        modules: [moduleEntry('pergola-1'), moduleEntry('pergola-2')],
        pergolaId: 'pergola-2',
      }),
    ).toBe(1);
  });

  it('resolves a transient object-first pergola id from the runtime solved entries', () => {
    expect(
      resolvePergolaModuleIndex({
        modules: [moduleEntry('pergola-1'), moduleEntry('pergola-2'), moduleEntry('pergola-3')],
        pergolaId: 'pergola-3',
      }),
    ).toBe(2);
  });

  it('does not fall back to module 0 for a missing pergola id', () => {
    expect(
      resolvePergolaModuleIndex({
        modules: [moduleEntry('pergola-1')],
        pergolaId: 'missing',
      }),
    ).toBeNull();
  });

  it('selects a pergola and only changes activeModuleIndex when a solved entry exists', () => {
    const selected = buildPergolaSelectionUiState({
      current: ui(),
      modules: [moduleEntry('pergola-1'), moduleEntry('pergola-2')],
      pergolaId: 'pergola-2',
    });
    expect(selected.activeModuleIndex).toBe(1);
    expect(selected.activeRailTab).toBe('pergolas');
    expect(selected.activeObjectRef).toEqual({ family: 'pergolas', objectId: 'pergola-2' });

    const missing = buildPergolaSelectionUiState({
      current: ui(),
      modules: [moduleEntry('pergola-1')],
      pergolaId: 'missing',
    });
    expect(missing.activeModuleIndex).toBe(3);
    expect(missing.activeObjectRef).toEqual({ family: 'pergolas', objectId: 'missing' });
  });
});
