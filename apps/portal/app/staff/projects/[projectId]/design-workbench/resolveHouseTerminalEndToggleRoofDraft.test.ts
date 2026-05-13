import { describe, expect, it } from 'vitest';
import type { HouseFormRoofIntentModel } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import { resolveHouseTerminalEndToggleRoofDraft } from './resolveHouseTerminalEndToggleRoofDraft';

function makeRoof(overrides: Partial<HouseFormRoofIntentModel> = {}): HouseFormRoofIntentModel {
  return {
    form: 'hipped',
    material: 'corrugated_iron',
    primaryPitchDeg: '15',
    primaryFallDirection: 'positive_y',
    ridgeAxis: 'x',
    openGableEndIds: [],
    appendage: {
      enabled: false,
      form: 'mono',
      hostEdge: 'rear',
      pitchDeg: '',
      dropMm: '450',
    },
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
        material: 'trapezoidal_5_rib',
        openGableEndIds: [],
        appendage: { enabled: true, form: 'mono', hostEdge: 'left', pitchDeg: '12', dropMm: '600' },
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

  describe('gable form (implicit "all-ends-open" migration)', () => {
    it("closes ONE end: converts form to 'hipped' and seeds openGableEndIds with every terminal except the one being closed", () => {
      // Regression: with `form: 'gable'` + `openGableEndIds: []` (the
      // workbench state that emerges from the geometry normalize
      // migration that treats gable as hipped+all-open), naively
      // filtering openGableEndIds is a no-op and the user sees no
      // change. The fix ports the migration into explicit state in one
      // commit: form becomes hipped, openGableEndIds becomes
      // all-terminals-minus-the-closed-one.
      const next = resolveHouseTerminalEndToggleRoofDraft({
        currentRoof: makeRoof({ form: 'gable', openGableEndIds: [] }),
        endId: 'house-gable-end-x-1',
        currentlyOpen: true,
        allTerminalEndIds: ['house-gable-end-x-1', 'house-gable-end-x-2'],
      });
      expect(next.form).toBe('hipped');
      expect(next.openGableEndIds).toEqual(['house-gable-end-x-2']);
    });

    it("opens an end on a gable form: still converts to 'hipped' explicitly so subsequent toggles operate on explicit state", () => {
      const next = resolveHouseTerminalEndToggleRoofDraft({
        currentRoof: makeRoof({ form: 'gable', openGableEndIds: [] }),
        endId: 'house-gable-end-x-1',
        currentlyOpen: false,
        allTerminalEndIds: ['house-gable-end-x-1', 'house-gable-end-x-2'],
      });
      expect(next.form).toBe('hipped');
      // All terminals are open (migration semantic), and the toggled
      // one is also added (set semantics dedupe).
      expect(new Set(next.openGableEndIds)).toEqual(
        new Set(['house-gable-end-x-1', 'house-gable-end-x-2']),
      );
    });

    it('preserves non-form fields when migrating gable → hipped', () => {
      const current = makeRoof({
        form: 'gable',
        ridgeAxis: 'x',
        primaryPitchDeg: '18',
        material: 'trapezoidal_5_rib',
        primaryFallDirection: 'negative_x',
      });
      const next = resolveHouseTerminalEndToggleRoofDraft({
        currentRoof: current,
        endId: 'house-gable-end-x-1',
        currentlyOpen: true,
        allTerminalEndIds: ['house-gable-end-x-1', 'house-gable-end-x-2'],
      });
      expect(next.ridgeAxis).toBe('x');
      expect(next.primaryPitchDeg).toBe('18');
      expect(next.material).toBe('trapezoidal_5_rib');
      expect(next.primaryFallDirection).toBe('negative_x');
    });

    it('handles the closing-the-only-open-end case on a gable form', () => {
      const next = resolveHouseTerminalEndToggleRoofDraft({
        currentRoof: makeRoof({ form: 'gable', openGableEndIds: [] }),
        endId: 'house-gable-end-x-1',
        currentlyOpen: true,
        allTerminalEndIds: ['house-gable-end-x-1'],
      });
      expect(next.form).toBe('hipped');
      expect(next.openGableEndIds).toEqual([]);
    });
  });

  it('ignores allTerminalEndIds on the hipped path (it only matters for the gable migration)', () => {
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
