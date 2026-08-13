import { describe, expect, it } from 'vitest';
import type { DepositInvoiceSummary } from './types';
import { projectInvoiceSchedule } from './paymentScheduleProjection';

function invoice(overrides: Partial<DepositInvoiceSummary>): DepositInvoiceSummary {
  return {
    id: 'inv-current', projectId: 'proj-1', quoteId: 'quote-1', quoteVersionId: 'qv-current',
    quoteRef: 'Q-0132', quoteVersionNumber: 4, invoiceRef: 'INV-0030', status: 'OPEN',
    paymentTermId: 'initial', paymentTermLabel: 'Initial payment', paymentTermPosition: 1,
    paymentTermCount: 2, paymentTermCalculation: 'percentage', paymentTermPercentage: 50,
    issueDate: '2026-08-10', dueDate: '2026-08-17', reference: null, customerName: 'Doreen',
    projectName: 'Doreen Hunkin', projectAddress: null, depositPercent: 50,
    totalIncGstCents: 839100, totalExGstCents: 729652, gstCents: 109448,
    createdAt: '2026-08-10T00:00:00Z', sentAt: null, paidAt: null, paidBy: null,
    paymentReference: null, paymentMethod: null, paymentNote: null, voidedAt: null,
    voidedBy: null, voidReason: null, lastDeliveryStatus: 'NOT_SENT', lastDeliveryError: null,
    lastDeliveryAttemptAt: null, nextRetryAt: null, finalFailure: false, recipients: [], ...overrides,
  };
}

describe('projectInvoiceSchedule', () => {
  it('counts paid invoices from superseded quotes as job credit', () => {
    const schedule = projectInvoiceSchedule({
      acceptedQuoteVersionId: 'qv-current', acceptedQuoteRef: 'Q-0132', acceptedQuoteVersionNumber: 4,
      acceptedQuoteTotalIncGstCents: 1678200,
      quoteTerms: [
        { id: 'initial', label: 'Initial payment', amountIncGstCents: 839100 },
        { id: 'final', label: 'Final payment', amountIncGstCents: 839100 },
      ],
      planItems: [], invoices: [invoice({})],
      paymentEntries: [{
        id: 'pmt-old', entryType: 'PAYMENT', amountIncGstCents: 703550,
        occurredAt: '2026-08-10T00:00:00Z', paymentMethod: 'bank transfer', reference: 'INV-0021',
        note: null, reason: null, sourceInvoiceId: 'inv-old', sourceInvoiceRef: 'INV-0021', reversed: false,
      }],
      allocations: [], includePaymentEntries: true,
    });
    expect(schedule.paidIncGstCents).toBe(703550);
    expect(schedule.outstandingIncGstCents).toBe(839100);
    expect(schedule.remainingToInvoiceIncGstCents).toBe(135550);
    expect(schedule.unallocatedCreditIncGstCents).toBe(703550);
    expect(schedule.paymentEntries?.[0]?.unallocatedIncGstCents).toBe(703550);
  });

  it('applies manually allocated credit to a current payment stage', () => {
    const schedule = projectInvoiceSchedule({
      acceptedQuoteVersionId: 'qv-current', acceptedQuoteRef: 'Q-1', acceptedQuoteVersionNumber: 2,
      acceptedQuoteTotalIncGstCents: 100000,
      quoteTerms: [{ id: 'deposit', label: 'Deposit', amountIncGstCents: 50000 }, { id: 'final', label: 'Final', amountIncGstCents: 50000 }],
      planItems: [], invoices: [],
      paymentEntries: [{ id: 'pmt-1', entryType: 'PAYMENT', amountIncGstCents: 30000, occurredAt: '2026-08-10', paymentMethod: null, reference: null, note: null, reason: null, sourceInvoiceId: null, sourceInvoiceRef: null, reversed: false }],
      allocations: [{ id: 'allocation-1', paymentEntryId: 'pmt-1', quoteVersionId: 'qv-current', paymentTermId: 'deposit', amountIncGstCents: 30000 }],
      includePaymentEntries: true,
    });
    expect(schedule.terms[0]?.allocatedPaidIncGstCents).toBe(30000);
    expect(schedule.terms[0]?.remainingAmountIncGstCents).toBe(20000);
    expect(schedule.unallocatedCreditIncGstCents).toBe(0);
  });

  it('replaces untouched default stages with a planned split of the remaining balance', () => {
    const schedule = projectInvoiceSchedule({
      acceptedQuoteVersionId: 'qv-current', acceptedQuoteRef: 'Q-1', acceptedQuoteVersionNumber: 2,
      acceptedQuoteTotalIncGstCents: 100000,
      quoteTerms: [{ id: 'deposit', label: 'Deposit', amountIncGstCents: 50000 }, { id: 'final', label: 'Final', amountIncGstCents: 50000 }],
      planItems: [
        { id: 'plan-1', paymentTermId: 'instalment-1', label: 'Progress one', position: 1, itemCount: 2, amountIncGstCents: 40000 },
        { id: 'plan-2', paymentTermId: 'instalment-2', label: 'Instalment 2', position: 2, itemCount: 2, amountIncGstCents: 40000 },
      ],
      invoices: [],
      paymentEntries: [{ id: 'pmt-1', entryType: 'PAYMENT', amountIncGstCents: 20000, occurredAt: '2026-08-10', paymentMethod: null, reference: null, note: null, reason: null, sourceInvoiceId: null, sourceInvoiceRef: null, reversed: false }],
      allocations: [], includePaymentEntries: true,
    });
    expect(schedule.terms.map((term) => term.paymentTermId)).toEqual(['instalment-1', 'instalment-2']);
    expect(schedule.terms.reduce((sum, term) => sum + term.amountIncGstCents, 0)).toBe(80000);
    expect(schedule.remainingToInvoiceIncGstCents).toBe(80000);
  });

  it('adds accepted add-ons to the job total while keeping their stages independent', () => {
    const schedule = projectInvoiceSchedule({
      acceptedQuotes: [
        {
          quoteVersionId: 'qv-base', quoteRef: 'Q-100', quoteVersionNumber: 2,
          commercialScopeKind: 'base', totalIncGstCents: 100000,
          terms: [{ id: 'final', label: 'Final', amountIncGstCents: 100000 }],
        },
        {
          quoteVersionId: 'qv-addon', quoteRef: 'Q-101', quoteVersionNumber: 1,
          commercialScopeKind: 'add_on', totalIncGstCents: 25000,
          terms: [{ id: 'final', label: 'Add-on payment', amountIncGstCents: 25000 }],
        },
      ],
      acceptedQuoteVersionId: 'qv-base', acceptedQuoteRef: 'Q-100', acceptedQuoteVersionNumber: 2,
      acceptedQuoteTotalIncGstCents: 100000, quoteTerms: [], planItems: [], invoices: [],
      paymentEntries: [], allocations: [], includePaymentEntries: false,
    });

    expect(schedule.acceptedQuoteTotalIncGstCents).toBe(125000);
    expect(schedule.terms.map((term) => [term.quoteVersionId, term.paymentTermId])).toEqual([
      ['qv-base', 'final'], ['qv-addon', 'final'],
    ]);
    expect(schedule.acceptedQuotes?.[1]).toMatchObject({
      commercialScopeKind: 'add_on', remainingToInvoiceIncGstCents: 25000,
    });
  });

  it('reconciles consent fees up front and odd-cent percentage stages exactly', () => {
    const schedule = projectInvoiceSchedule({
      acceptedQuoteVersionId: 'qv-consent', acceptedQuoteRef: 'Q-200', acceptedQuoteVersionNumber: 1,
      acceptedQuoteTotalIncGstCents: 2_000_001,
      quoteTerms: [
        { id: 'fees', label: 'Consent and engineering', amountIncGstCents: 500_000 },
        { id: 'construction', label: 'Construction', amountIncGstCents: 750_001 },
        { id: 'final', label: 'Final', amountIncGstCents: 750_000 },
      ],
      planItems: [], invoices: [], paymentEntries: [], allocations: [], includePaymentEntries: false,
    });
    expect(schedule.terms.reduce((sum, term) => sum + term.amountIncGstCents, 0)).toBe(2_000_001);
    expect(schedule.remainingToInvoiceIncGstCents).toBe(2_000_001);
  });

  it('keeps add-on and historical manually reconciled credit in one job balance', () => {
    const schedule = projectInvoiceSchedule({
      acceptedQuotes: [
        { quoteVersionId: 'qv-base', quoteRef: 'Q-100', quoteVersionNumber: 2, commercialScopeKind: 'base', totalIncGstCents: 100_000, terms: [{ id: 'all', label: 'Base', amountIncGstCents: 100_000 }] },
        { quoteVersionId: 'qv-addon', quoteRef: 'Q-101', quoteVersionNumber: 1, commercialScopeKind: 'add_on', totalIncGstCents: 25_000, terms: [{ id: 'all', label: 'Add-on', amountIncGstCents: 25_000 }] },
      ],
      acceptedQuoteVersionId: 'qv-base', acceptedQuoteRef: 'Q-100', acceptedQuoteVersionNumber: 2,
      acceptedQuoteTotalIncGstCents: 100_000, quoteTerms: [], planItems: [],
      invoices: [invoice({ quoteVersionId: 'qv-old', totalIncGstCents: 20_000 })],
      paymentEntries: [{ id: 'pmt-old', entryType: 'PAYMENT', amountIncGstCents: 30_000, occurredAt: '2026-08-10', paymentMethod: null, reference: null, note: null, reason: null, sourceInvoiceId: null, sourceInvoiceRef: null, reversed: false }],
      allocations: [], includePaymentEntries: true,
    });
    expect(schedule.acceptedQuoteTotalIncGstCents).toBe(125_000);
    expect(schedule.remainingToInvoiceIncGstCents).toBe(75_000);
    expect(schedule.unallocatedCreditIncGstCents).toBe(30_000);
  });

  it('preserves historical money and invoices when there is no current accepted scope', () => {
    const schedule = projectInvoiceSchedule({
      acceptedQuoteVersionId: null, acceptedQuoteRef: null, acceptedQuoteVersionNumber: null,
      acceptedQuoteTotalIncGstCents: 0, quoteTerms: [], planItems: [],
      invoices: [invoice({ quoteVersionId: 'qv-historical', totalIncGstCents: 40_000 })],
      paymentEntries: [{
        id: 'pmt-historical', entryType: 'PAYMENT', amountIncGstCents: 60_000,
        occurredAt: '2026-08-10', paymentMethod: null, reference: null, note: null, reason: null,
        sourceInvoiceId: null, sourceInvoiceRef: null, reversed: false,
      }],
      allocations: [], includePaymentEntries: true,
    });

    expect(schedule.acceptedQuoteVersionId).toBeNull();
    expect(schedule.paidIncGstCents).toBe(60_000);
    expect(schedule.outstandingIncGstCents).toBe(40_000);
    expect(schedule.overCommittedIncGstCents).toBe(100_000);
    expect(schedule.paymentEntries).toHaveLength(1);
  });

  it('surfaces an over-committed contract instead of hiding the variance at zero remaining', () => {
    const schedule = projectInvoiceSchedule({
      acceptedQuoteVersionId: 'qv-current', acceptedQuoteRef: 'Q-1', acceptedQuoteVersionNumber: 1,
      acceptedQuoteTotalIncGstCents: 100_000,
      quoteTerms: [{ id: 'all', label: 'All', amountIncGstCents: 100_000 }],
      planItems: [], invoices: [invoice({ totalIncGstCents: 80_000 })],
      paymentEntries: [{
        id: 'pmt-1', entryType: 'PAYMENT', amountIncGstCents: 30_000,
        occurredAt: '2026-08-10', paymentMethod: null, reference: null, note: null, reason: null,
        sourceInvoiceId: null, sourceInvoiceRef: null, reversed: false,
      }], allocations: [], includePaymentEntries: false,
    });

    expect(schedule.remainingToInvoiceIncGstCents).toBe(0);
    expect(schedule.overCommittedIncGstCents).toBe(10_000);
  });
});
