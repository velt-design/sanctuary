import { describe, expect, it } from 'vitest';
import { summarizeQuoteVersionInvoices } from './invoiceSchedule';
import type { DepositInvoiceSummary } from './types';

function invoice(overrides: Partial<DepositInvoiceSummary>): DepositInvoiceSummary {
  return {
    id: 'inv_1', projectId: 'proj_1', quoteId: 'qt_1', quoteVersionId: 'qv_current', quoteRef: 'Q-1', quoteVersionNumber: 2,
    invoiceRef: 'INV-1', status: 'OPEN', paymentTermId: 'payment-1', paymentTermLabel: 'Initial payment', paymentTermPosition: 1,
    paymentTermCount: 2, paymentTermCalculation: 'percentage', paymentTermPercentage: 50, issueDate: '2026-08-10', dueDate: '2026-08-17',
    reference: null, customerName: null, projectName: null, projectAddress: null, depositPercent: 50, totalIncGstCents: 5000,
    totalExGstCents: 4348, gstCents: 652, createdAt: '2026-08-10T00:00:00Z', sentAt: null, paidAt: null, paidBy: null,
    paymentReference: null, paymentMethod: null, paymentNote: null, voidedAt: null, voidedBy: null, voidReason: null,
    lastDeliveryStatus: 'NOT_SENT', lastDeliveryError: null, lastDeliveryAttemptAt: null, nextRetryAt: null, finalFailure: false, recipients: [],
    ...overrides,
  };
}

describe('summarizeQuoteVersionInvoices', () => {
  it('excludes historical quote versions and void invoices from current schedule totals', () => {
    const summary = summarizeQuoteVersionInvoices([
      invoice({ id: 'inv_current_open', totalIncGstCents: 5000 }),
      invoice({ id: 'inv_current_paid', status: 'PAID', totalIncGstCents: 3000 }),
      invoice({ id: 'inv_historical', quoteVersionId: 'qv_old', totalIncGstCents: 7000 }),
      invoice({ id: 'inv_void', status: 'VOID', totalIncGstCents: 2000 }),
    ], 'qv_current');

    expect(summary.invoicedIncGstCents).toBe(8000);
    expect(summary.paidIncGstCents).toBe(3000);
    expect(summary.outstandingIncGstCents).toBe(5000);
    expect(summary.active.map((item) => item.id)).toEqual(['inv_current_open', 'inv_current_paid']);
  });
});
