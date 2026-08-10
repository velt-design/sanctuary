import { describe, expect, it } from 'vitest';
import {
  buildDefaultQuotePaymentSchedule,
  evaluateQuotePaymentSchedule,
  requireValidQuotePaymentSchedule,
} from './paymentSchedule';

describe('quote payment schedules', () => {
  it('defaults ordinary and engineering-only quotes to 50/50', () => {
    for (const approvalRequirement of ['neither', 'engineering_required'] as const) {
      const terms = buildDefaultQuotePaymentSchedule({ quoteTotalIncGstCents: 1_000_001, approvalRequirement });
      expect(terms.map((term) => term.percentageOfRemainder)).toEqual([50, 50]);
      expect(terms.map((term) => term.resolvedAmountIncGstCents)).toEqual([500_001, 500_000]);
    }
  });

  it('puts consent and engineering up front then splits the remainder 50/50', () => {
    const terms = buildDefaultQuotePaymentSchedule({
      quoteTotalIncGstCents: 2_000_001,
      approvalRequirement: 'full_building_consent',
      approvalIncGstCents: 500_000,
    });

    expect(terms.map((term) => [term.calculationType, term.resolvedAmountIncGstCents])).toEqual([
      ['fixed', 500_000],
      ['percentage', 750_001],
      ['percentage', 750_000],
    ]);
  });

  it('supports custom fixed and percentage rows while requiring exact allocation', () => {
    const valid = requireValidQuotePaymentSchedule([
      {
        id: 'a', label: 'Fees', calculationType: 'fixed', fixedAmountIncGstCents: 100_000,
        percentageOfRemainder: null, resolvedAmountIncGstCents: 0,
      },
      {
        id: 'b', label: 'Start', calculationType: 'percentage', fixedAmountIncGstCents: null,
        percentageOfRemainder: 40, resolvedAmountIncGstCents: 0,
      },
      {
        id: 'c', label: 'Finish', calculationType: 'percentage', fixedAmountIncGstCents: null,
        percentageOfRemainder: 60, resolvedAmountIncGstCents: 0,
      },
    ], 1_000_000);
    expect(valid.map((term) => term.resolvedAmountIncGstCents)).toEqual([100_000, 360_000, 540_000]);

    const invalid = evaluateQuotePaymentSchedule([
      { ...valid[1]!, percentageOfRemainder: 30 },
      { ...valid[2]!, percentageOfRemainder: 60 },
    ], 1_000_000);
    expect(invalid.errors).toContain('Percentage payment terms must total exactly 100%.');
  });
});
