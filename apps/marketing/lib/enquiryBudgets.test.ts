import { describe, expect, it } from 'vitest';
import { buildEnquiryBudgets } from './enquiryBudgets';

describe('buildEnquiryBudgets', () => {
  it('returns a lower-only base amount and keeps blinds ranged', () => {
    const budgets = buildEnquiryBudgets({
      enquiryType: 'residential',
      baseTrueCostIncGst: 19999,
      blindsQuoteIncGst: 6250,
    });

    // 19999 * 1.25 = 24998.75 -> rounds to 25000 ($250 residential step).
    expect(budgets.baseRange).toEqual({ lowIncGst: 25000, highIncGst: 25000 });
    // Blinds round-trip the quote multiplier (6250 / 1.25 * 1.25 = 6250),
    // so the baseline stays at 6250 regardless of the multiplier change.
    expect(budgets.blindsRange).toEqual({ lowIncGst: 6250, highIncGst: 7250 });
    expect(budgets.budgetBasis).toBe(
      'website ballpark: base uses 1.25x true cost lower-only, blinds use 1.25x true cost baseline->+15%, fascia assumption',
    );
  });

  it('keeps the base-only budget basis concise', () => {
    const budgets = buildEnquiryBudgets({
      enquiryType: 'commercial',
      baseTrueCostIncGst: 41234.56,
      blindsQuoteIncGst: null,
    });

    // 41234.56 * 1.25 = 51543.2 -> rounds to 51500 ($500 commercial step).
    expect(budgets.baseRange).toEqual({ lowIncGst: 51500, highIncGst: 51500 });
    expect(budgets.blindsRange).toBeNull();
    expect(budgets.budgetBasis).toBe('website ballpark: base uses 1.25x true cost lower-only, fascia assumption');
  });

  it('returns null budgets for unsupported enquiry types', () => {
    expect(
      buildEnquiryBudgets({
        enquiryType: 'professional',
        baseTrueCostIncGst: 10000,
        blindsQuoteIncGst: 2000,
      }),
    ).toEqual({
      baseRange: null,
      blindsRange: null,
      budgetBasis: null,
    });
  });
});
