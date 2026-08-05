import { describe, expect, it } from 'vitest';
import { shouldPreferNonContinuousStock } from './stockSelectionRanking';

describe('non-continuous stock selection ranking', () => {
  const fourMetre = { totalCost: 991.6179, wasteM: 14.69, barsUsed: 13, costPerM: 19.069575 };
  const sixMetre = { totalCost: 801.1045, wasteM: 4.69, barsUsed: 7, costPerM: 19.0739167 };

  it('prefers the lowest complete purchase under the corrected policy', () => {
    expect(shouldPreferNonContinuousStock(sixMetre, fourMetre, 'total_purchase_cost')).toBe(true);
  });

  it('preserves the historical cost-per-metre-first policy', () => {
    expect(shouldPreferNonContinuousStock(sixMetre, fourMetre, 'cost_per_m')).toBe(false);
  });

  it('uses waste, bars and cost per metre as ordered corrected-policy tie-breakers', () => {
    const baseline = { totalCost: 100, wasteM: 2, barsUsed: 3, costPerM: 20 };
    expect(shouldPreferNonContinuousStock({ ...baseline, wasteM: 1 }, baseline, 'total_purchase_cost')).toBe(true);
    expect(shouldPreferNonContinuousStock({ ...baseline, barsUsed: 2 }, baseline, 'total_purchase_cost')).toBe(true);
    expect(shouldPreferNonContinuousStock({ ...baseline, costPerM: 19 }, baseline, 'total_purchase_cost')).toBe(true);
  });
});
