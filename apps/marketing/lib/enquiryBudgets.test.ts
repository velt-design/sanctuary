import { describe, expect, it } from 'vitest';
import { buildEnquiryBudgets } from './enquiryBudgets';

describe('buildEnquiryBudgets', () => {
  it('returns a lower-only base amount and keeps blinds ranged', () => {
    const budgets = buildEnquiryBudgets({
      enquiryType: 'residential',
      baseTrueCostIncGst: 19999,
      blindsQuoteIncGst: 6250,
    });

    expect(budgets.baseRange).toEqual({ lowIncGst: 25000, highIncGst: 25000 });
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
