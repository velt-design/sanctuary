import { describe, expect, it } from 'vitest';

import type { ImpactDiff } from './diff';
import {
  buildPriceImpactPresentation,
  formatImpactMoney,
  formatImpactNumber,
} from './priceImpactPresentation';

function makeDiff(overrides: Partial<ImpactDiff['delta']> = {}): ImpactDiff {
  return {
    delta: {
      total_ex: 80,
      total_inc: 92,
      materials_ex: 10,
      install_ex: -50,
      overhead_ex: 20,
      crew_hours: -2,
      install_days: 1,
      ...overrides,
    },
    materialsDrivers: [],
    installDrivers: [],
  };
}

describe('priceImpactPresentation', () => {
  it('ranks cost categories by absolute change without changing their values', () => {
    expect(buildPriceImpactPresentation(makeDiff()).categories).toEqual([
      { id: 'install', label: 'Install', value: -50 },
      { id: 'overhead', label: 'Overhead', value: 20 },
      { id: 'materials', label: 'Materials', value: 10 },
    ]);
  });

  it('omits zero, missing, and non-finite category deltas', () => {
    const presentation = buildPriceImpactPresentation(
      makeDiff({ materials_ex: 0, install_ex: undefined, overhead_ex: Number.NaN }),
    );
    expect(presentation.categories).toEqual([]);
  });

  it('formats signed cost and operational values consistently', () => {
    expect(formatImpactMoney(1234.5)).toBe('+$1234.50');
    expect(formatImpactMoney(-12)).toBe('-$12.00');
    expect(formatImpactMoney(0)).toBe('$0.00');
    expect(formatImpactMoney(undefined)).toBe('—');
    expect(formatImpactNumber(-2, 'h')).toBe('-2 h');
    expect(formatImpactNumber(0, 'd')).toBe('0 d');
  });
});
