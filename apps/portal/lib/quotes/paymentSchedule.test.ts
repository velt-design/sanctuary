import { describe, expect, it } from 'vitest';
import {
  buildDefaultQuotePaymentSchedule,
  evaluateQuotePaymentSchedule,
  normalizeStoredQuotePaymentSchedule,
  requireValidQuotePaymentSchedule,
  applyPaymentScheduleToTerms,
} from './paymentSchedule';

describe('quote payment schedules', () => {
  it('writes customer amounts from the resolved schedule including the allocated rounding cent', () => {
    const terms = buildDefaultQuotePaymentSchedule({ quoteTotalIncGstCents: 1_455_359 });
    const authored = 'Access is arranged by the customer.\nLead times will be confirmed once the deposit is received.';
    const text = applyPaymentScheduleToTerms(authored, terms);
    expect(text).toBe('Access is arranged by the customer.\nPayment schedule (incl. GST): Initial payment: $7,276.80; Final payment: $7,276.79.\nLead times will be confirmed once the deposit is received.');
    expect(terms.map((term) => term.resolvedAmountIncGstCents)).toEqual([727680, 727679]);
    expect(text).not.toContain('balance after fixed payments');
    expect(applyPaymentScheduleToTerms(text, terms)).toBe(text);
  });

  it('uses the same exact amount wording for fixed and mixed schedules', () => {
    const mixed = buildDefaultQuotePaymentSchedule({
      quoteTotalIncGstCents: 2_000_001, approvalRequirement: 'full_building_consent', approvalIncGstCents: 500_000,
    });
    expect(applyPaymentScheduleToTerms(null, mixed)).toBe('Payment schedule (incl. GST): Consent and engineering: $5,000.00; Construction payment: $7,500.01; Final payment: $7,500.00.');
    const fixed = requireValidQuotePaymentSchedule([
      { id: 'one', label: 'On delivery', calculationType: 'fixed', fixedAmountIncGstCents: 123_456, percentageOfRemainder: null, resolvedAmountIncGstCents: 0 },
    ], 123_456);
    expect(applyPaymentScheduleToTerms(null, fixed)).toBe('Payment schedule (incl. GST): On delivery: $1,234.56.');
  });

  it('preserves a manually written payment schedule instead of replacing its agreement', () => {
    const authored = 'Payment schedule: Final payment after the agreed site inspection.\nAccess remains by appointment.';
    expect(applyPaymentScheduleToTerms(authored, buildDefaultQuotePaymentSchedule({ quoteTotalIncGstCents: 100_001 }))).toBe(authored);
  });

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

  it('uses legacy 50/50 only when stored terms are genuinely absent', () => {
    expect(normalizeStoredQuotePaymentSchedule(null, 100_001, 50)
      .map((term) => term.resolvedAmountIncGstCents)).toEqual([50_001, 50_000]);
  });

  it('fails visibly instead of silently replacing malformed stored terms', () => {
    expect(() => normalizeStoredQuotePaymentSchedule({ invalid: true }, 100_000, 50))
      .toThrow('Stored quote payment schedule is malformed');
    expect(() => normalizeStoredQuotePaymentSchedule([], 100_000, 50))
      .toThrow('Stored quote payment schedule is invalid');
  });
});
