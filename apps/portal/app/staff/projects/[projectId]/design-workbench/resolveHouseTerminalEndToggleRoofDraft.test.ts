import { describe, expect, it } from 'vitest';
import type { HouseFormRoofIntentModel } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import { resolveHouseTerminalEndToggleRoofDraft } from './resolveHouseTerminalEndToggleRoofDraft';

function makeRoof(overrides: Partial<HouseFormRoofIntentModel> = {}): HouseFormRoofIntentModel {
  return {
    form: 'hipped',
    primaryPitchDeg: '15',
    primaryFallDirection: 'positive_y',
    ridgeAxis: 'x',
    openGableEndIds: [],
    ...overrides,
  };
}

describe('resolveHouseTerminalEndToggleRoofDraft', () => {
  describe('hipped form (explicit state)', () => {
    it('adds endId to openGableEndIds when opening a previously closed end', () => {
      const next = resolveHouseTerminalEndToggleRoofDraft({
        currentRoof: makeRoof({ form: 'hipped', openGableEndIds: [] }),
        endId: 'house-gable-end-x-1',
        currentlyOpen: false,
        allTerminalEndIds: ['house-gable-end-x-1', 'house-gable-end-x-2'],
      });
      expect(next.form).toBe('hipped');
      expect(next.openGableEndIds).toEqual(['house-gable-end-x-1']);
    });

    it('removes endId from openGableEndIds when closing an open end', () => {
      const next = resolveHouseTerminalEndToggleRoofDraft({
        currentRoof: makeRoof({
          form: 'hipped',
          openGableEndIds: ['house-gable-end-x-1', 'house-gable-end-x-2'],
        }),
        endId: 'house-gable-end-x-1',
        currentlyOpen: true,
        allTerminalEndIds: ['house-gable-end-x-1', 'house-gable-end-x-2'],
      });
      expect(next.form).toBe('hipped');
      expect(next.openGableEndIds).toEqual(['house-gable-end-x-2']);
    });

    it('preserves all other roof intent fields when toggling', () => {
      const current = makeRoof({
        form: 'hipped',
        ridgeAxis: 'y',
        primaryPitchDeg: '22',
        openGableEndIds: [],
      });
      const next = resolveHouseTerminalEndToggleRoofDraft({
        currentRoof: current,
        endId: 'house-gable-end-y-1',
        currentlyOpen: false,
        allTerminalEndIds: ['house-gable-end-y-1', 'house-gable-end-y-2'],
      });
      expect(next).toEqual({
        ...current,
        openGableEndIds: ['house-gable-end-y-1'],
      });
    });
  });

  // Milestone 13 session C: `'gable'` was retired from the
  // `HouseRoofForm` union; the gable->hipped migration moved to the
  // workbench draft normalize boundary (`normalizeHouseFormRoofIntent`).
  // Earlier slice-2 tests verifying this helper's gable-handling branch
  // are gone -- the branch was retired in commit landing session C.

  it('ignores allTerminalEndIds on the hipped path (kept as a parameter for API stability; only the hipped flow uses it now)', () => {
    const next = resolveHouseTerminalEndToggleRoofDraft({
      currentRoof: makeRoof({ form: 'hipped', openGableEndIds: ['x-1'] }),
      endId: 'x-1',
      currentlyOpen: true,
      // Bogus extra ids — should NOT leak into openGableEndIds because
      // the hipped path uses the explicit openGableEndIds as the
      // authoritative source.
      allTerminalEndIds: ['x-1', 'x-2', 'y-1', 'y-2', 'phantom-id'],
    });
    expect(next.openGableEndIds).toEqual([]);
  });
});
