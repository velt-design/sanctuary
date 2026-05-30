import { describe, expect, it } from 'vitest';
import type { DrawingWorkbenchUiState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import { buildPergolaSelectionUiState } from './pergolaSelectionState';

function ui(overrides: Partial<DrawingWorkbenchUiState> = {}): DrawingWorkbenchUiState {
  return {
    activeView: 'plan',
    activeModuleIndex: 3,
    activePergolaId: null,
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
  it('selects a pergola by id without changing the compatibility module index', () => {
    const selected = buildPergolaSelectionUiState({
      current: ui(),
      pergolaId: 'pergola-2',
    });
    expect(selected.activeModuleIndex).toBe(3);
    expect(selected.activePergolaId).toBe('pergola-2');
    expect(selected.activeRailTab).toBe('pergolas');
    expect(selected.activeObjectRef).toEqual({ family: 'pergolas', objectId: 'pergola-2' });

    const missing = buildPergolaSelectionUiState({
      current: ui(),
      pergolaId: 'missing',
    });
    expect(missing.activeModuleIndex).toBe(3);
    expect(missing.activePergolaId).toBe('missing');
    expect(missing.activeObjectRef).toEqual({ family: 'pergolas', objectId: 'missing' });
  });
});
