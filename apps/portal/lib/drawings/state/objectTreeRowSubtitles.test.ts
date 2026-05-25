import { describe, expect, it } from 'vitest';
import type { DrawingWorkbenchRailObjectEntry } from './drawingWorkbenchRailModel';
import type { DrawingWorkbenchVisibilityState } from './drawingWorkbenchUiState';
import {
  emptyStateForFamily,
  familyVisibilityFor,
  primaryDescriptorFromMeta,
  stateHintForRow,
  subtitleForObjectTreeRow,
} from './objectTreeRowSubtitles';

function makeEntry(overrides: Partial<DrawingWorkbenchRailObjectEntry> = {}): DrawingWorkbenchRailObjectEntry {
  return {
    ref: { family: 'pergolas', objectId: 'pergola-1' },
    label: 'Pergola 1',
    status: 'ready',
    trustStatus: 'geometry_ready',
    trustLabel: 'Ready',
    statusLabel: 'Ready',
    meta: 'Mono | Rear edge',
    ...overrides,
  };
}

const VISIBLE_VISIBILITY: DrawingWorkbenchVisibilityState = {
  house: true,
  pergolas: true,
  decks: true,
  openings: true,
};

describe('primaryDescriptorFromMeta', () => {
  it('returns the first pipe-delimited segment trimmed', () => {
    expect(primaryDescriptorFromMeta('Mono | Rear edge')).toBe('Mono');
    expect(primaryDescriptorFromMeta('straight footprint | mono roof | 0 warnings')).toBe(
      'straight footprint',
    );
    expect(primaryDescriptorFromMeta('Attached | Preset rectangle')).toBe('Attached');
    expect(primaryDescriptorFromMeta('hinged door | Rear wall')).toBe('hinged door');
  });

  it('returns the original string when there is no pipe', () => {
    expect(primaryDescriptorFromMeta('Freestanding')).toBe('Freestanding');
  });

  it('returns empty string for null or empty meta', () => {
    expect(primaryDescriptorFromMeta(null)).toBe('');
    expect(primaryDescriptorFromMeta('')).toBe('');
  });
});

describe('stateHintForRow', () => {
  it('returns "selected" when the row is the active selection (highest priority)', () => {
    expect(
      stateHintForRow({
        entry: makeEntry({ trustStatus: 'approximate', trustLabel: 'Approximate' }),
        selected: true,
        familyVisible: false,
      }),
    ).toBe('selected');
  });

  it('returns "hidden in viewport" when family is hidden and row is not selected', () => {
    expect(
      stateHintForRow({
        entry: makeEntry(),
        selected: false,
        familyVisible: false,
      }),
    ).toBe('hidden in viewport');
  });

  it('returns the lowercase trust label when trust is not geometry_ready and row is visible/unselected', () => {
    expect(
      stateHintForRow({
        entry: makeEntry({ trustStatus: 'approximate', trustLabel: 'Approximate' }),
        selected: false,
        familyVisible: true,
      }),
    ).toBe('approximate');
    expect(
      stateHintForRow({
        entry: makeEntry({ trustStatus: 'invalid_geometry', trustLabel: 'Invalid' }),
        selected: false,
        familyVisible: true,
      }),
    ).toBe('invalid');
  });

  it('returns empty string when row is visible, unselected, and trust is geometry_ready', () => {
    expect(
      stateHintForRow({
        entry: makeEntry(),
        selected: false,
        familyVisible: true,
      }),
    ).toBe('');
  });
});

describe('subtitleForObjectTreeRow', () => {
  it('joins descriptor and hint with " · " when both present', () => {
    expect(
      subtitleForObjectTreeRow({
        entry: makeEntry({ meta: 'Mono | Rear edge' }),
        selected: true,
        familyVisible: true,
      }),
    ).toBe('Mono · selected');
  });

  it('renders just the descriptor when no hint applies (geometry ready, visible, unselected)', () => {
    expect(
      subtitleForObjectTreeRow({
        entry: makeEntry({ meta: 'Mono | Rear edge' }),
        selected: false,
        familyVisible: true,
      }),
    ).toBe('Mono');
  });

  it('renders just the hint when descriptor is empty', () => {
    expect(
      subtitleForObjectTreeRow({
        entry: makeEntry({ meta: null }),
        selected: true,
        familyVisible: true,
      }),
    ).toBe('selected');
  });

  it('renders empty string when neither descriptor nor hint applies', () => {
    expect(
      subtitleForObjectTreeRow({
        entry: makeEntry({ meta: null }),
        selected: false,
        familyVisible: true,
      }),
    ).toBe('');
  });

  it('composes the mockup-style "Gable roof · hidden in viewport" for house forms', () => {
    expect(
      subtitleForObjectTreeRow({
        entry: makeEntry({
          ref: { family: 'house_forms', objectId: 'house-1' },
          label: 'House Form 1',
          meta: 'straight footprint | gable roof | 0 warnings',
        }),
        selected: false,
        familyVisible: false,
      }),
    ).toBe('straight footprint · hidden in viewport');
  });

  it('shows "hidden in viewport" over trust when both could apply (visibility wins over trust)', () => {
    expect(
      subtitleForObjectTreeRow({
        entry: makeEntry({ trustStatus: 'approximate', trustLabel: 'Approximate' }),
        selected: false,
        familyVisible: false,
      }),
    ).toBe('Mono · hidden in viewport');
  });
});

describe('emptyStateForFamily', () => {
  it('returns a standardised message and helper hint per family', () => {
    expect(emptyStateForFamily('house_forms')).toEqual({
      message: 'No house forms',
      hint: 'Add structure from inspector',
    });
    expect(emptyStateForFamily('pergolas')).toEqual({
      message: 'No pergolas',
      hint: 'Drag and snap from the toolbar',
    });
    expect(emptyStateForFamily('decks')).toEqual({
      message: 'No decks',
      hint: 'Add from inspector',
    });
    expect(emptyStateForFamily('openings')).toEqual({
      message: 'No openings',
      hint: 'Add from inspector',
    });
  });
});

describe('familyVisibilityFor', () => {
  it('reads "house" key from visibility state when family is house_forms', () => {
    expect(familyVisibilityFor('house_forms', { ...VISIBLE_VISIBILITY, house: false })).toBe(false);
    expect(familyVisibilityFor('house_forms', VISIBLE_VISIBILITY)).toBe(true);
  });

  it('reads the matching family key for non-house families', () => {
    expect(familyVisibilityFor('pergolas', { ...VISIBLE_VISIBILITY, pergolas: false })).toBe(false);
    expect(familyVisibilityFor('decks', { ...VISIBLE_VISIBILITY, decks: false })).toBe(false);
    expect(familyVisibilityFor('openings', { ...VISIBLE_VISIBILITY, openings: false })).toBe(false);
  });
});
