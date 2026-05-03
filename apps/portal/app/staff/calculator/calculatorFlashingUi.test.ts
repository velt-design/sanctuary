import { describe, expect, it } from 'vitest';
import type { CalculatorFlashingsState, CalculatorModuleInputs } from '@/lib/types/calculator';
import { makeDefaultModule } from './calculatorInputs';
import {
  buildFlashingDefaultsForModule,
  calculateFlashingTotalLength,
  calculateFlashingTotalsByBand,
  isDuplicatePrimaryFlashingRow,
  selectVisibleFlashingBands,
} from './calculatorFlashingUi';

function makeModule(overrides?: Partial<CalculatorModuleInputs>): CalculatorModuleInputs {
  return {
    ...makeDefaultModule(),
    ...overrides,
    flashings: overrides?.flashings ?? { rows: [] },
    overrides: { ...makeDefaultModule().overrides, ...(overrides?.overrides ?? {}) },
  };
}

function row(overrides: Partial<CalculatorFlashingsState['rows'][number]>): CalculatorFlashingsState['rows'][number] {
  return {
    id: 'row-1',
    kind: 'extra',
    band: '201-300',
    lengthM: '1',
    purpose: 'CUSTOM',
    ...overrides,
  };
}

describe('calculator flashing UI helpers', () => {
  it('builds pitched and inverted pitched defaults', () => {
    expect(buildFlashingDefaultsForModule(makeModule())).toEqual([
      { key: 'pitched_primary', label: 'Primary flashing', defaultBand: '201-300', lengthM: 6 },
    ]);

    expect(buildFlashingDefaultsForModule(makeModule({ invertedEnabled: true }))).toEqual([
      { key: 'pitched_primary', label: 'Primary flashing', defaultBand: '201-300', lengthM: 6 },
      { key: 'pitched_secondary', label: 'Secondary flashing', defaultBand: '201-300', lengthM: 6 },
    ]);
  });

  it('builds gable and hip defaults', () => {
    expect(buildFlashingDefaultsForModule(makeModule({ pergolaStyle: 'gable' }))).toEqual([
      { key: 'gable_ridge', label: 'Ridge flashing', defaultBand: '301-400', lengthM: 6 },
    ]);

    expect(buildFlashingDefaultsForModule(makeModule({ pergolaStyle: 'hip' }), { ledger_length_m: 4.2 })).toEqual([
      { key: 'hip_ledger', label: 'Hip ledger flashing', defaultBand: '201-300', lengthM: 4.2 },
    ]);
  });

  it('derives timber edge lengths from pitch and projection fallback', () => {
    const defaults = buildFlashingDefaultsForModule(
      makeModule({
        roofMaterial: 'timber',
        projectionM: '3',
        roofPitchDeg: '0',
      }),
    );

    expect(defaults).toEqual([
      { key: 'pitched_primary', label: 'Primary flashing', defaultBand: '201-300', lengthM: 6 },
      { key: 'timber_edge_left', label: 'Timber edge rafter flashing (left)', defaultBand: '0-200', lengthM: 3.1 },
      { key: 'timber_edge_right', label: 'Timber edge rafter flashing (right)', defaultBand: '0-200', lengthM: 3.1 },
    ]);
  });

  it('derives timber edge lengths from supplied rafter length', () => {
    const defaults = buildFlashingDefaultsForModule(makeModule({ roofMaterial: 'timber' }), {
      rafter_length_m: 2.5,
    });

    expect(defaults).toEqual([
      { key: 'pitched_primary', label: 'Primary flashing', defaultBand: '201-300', lengthM: 6 },
      { key: 'timber_edge_left', label: 'Timber edge rafter flashing (left)', defaultBand: '0-200', lengthM: 2.6 },
      { key: 'timber_edge_right', label: 'Timber edge rafter flashing (right)', defaultBand: '0-200', lengthM: 2.6 },
    ]);
  });

  it('calculates totals by band and ignores invalid, negative, and zero lengths', () => {
    const totals = calculateFlashingTotalsByBand([
      row({ id: 'a', band: '0-200', lengthM: '2.5' }),
      row({ id: 'b', band: '201-300', lengthM: '1.25' }),
      row({ id: 'c', band: '301-400', lengthM: '0' }),
      row({ id: 'd', band: '301-400', lengthM: '-1' }),
      row({ id: 'e', band: '301-400', lengthM: 'bad' }),
    ]);

    expect(totals).toEqual({ '0-200': 2.5, '201-300': 1.25, '301-400': 0 });
    expect(calculateFlashingTotalLength(totals)).toBe(3.75);
  });

  it('selects visible bands from totals and show-all state', () => {
    const totals = { '0-200': 2.5, '201-300': 0, '301-400': 1 };

    expect(selectVisibleFlashingBands(totals, false)).toEqual(['0-200', '301-400']);
    expect(selectVisibleFlashingBands(totals, true)).toEqual(['0-200', '201-300', '301-400']);
  });

  it('detects duplicate primary flashing rows by band and length tolerance', () => {
    const primary = row({ id: 'primary', kind: 'primary', band: '201-300', lengthM: '6' });

    expect(isDuplicatePrimaryFlashingRow(row({ id: 'match', band: '201-300', lengthM: '6.005' }), primary)).toBe(true);
    expect(isDuplicatePrimaryFlashingRow(row({ id: 'far', band: '201-300', lengthM: '6.02' }), primary)).toBe(false);
    expect(isDuplicatePrimaryFlashingRow(row({ id: 'band', band: '0-200', lengthM: '6' }), primary)).toBe(false);
    expect(isDuplicatePrimaryFlashingRow(row({ id: 'zero', band: '201-300', lengthM: '0' }), primary)).toBe(false);
    expect(isDuplicatePrimaryFlashingRow(primary, primary)).toBe(false);
  });
});
