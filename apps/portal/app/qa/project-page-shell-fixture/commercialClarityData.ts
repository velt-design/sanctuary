import type { EstimateMeta } from '@/lib/estimates/types';
import type { QuoteVersion } from '@/lib/quotes/types';
import type { DepositInvoiceSummary, ProjectInvoiceSchedule } from '@/lib/invoices/types';

export const projectId = 'proj_fixture_shell';
const estimate: EstimateMeta = {
  id: 'est_clarity_1', projectId, createdAt: '2026-08-11T01:00:00Z', status: 'draft', summary: {},
  versionLabel: 'V1', isActiveDraft: false, hasSentQuote: true, jobPackEligible: true,
  jobPackGeneratedAt: null, jobPackQuoteVersionId: null,
};
export const estimates: EstimateMeta[] = [
  { ...estimate, id: 'est_clarity_3', createdAt: '2026-08-11T03:00:00Z', isActiveDraft: true, hasSentQuote: false },
  { ...estimate, id: 'est_clarity_2', createdAt: '2026-08-11T02:00:00Z' },
  estimate,
];
const quote: QuoteVersion = {
  id: 'qv_clarity_1', quoteId: 'qt_clarity', projectId, quoteRef: 'Q-CLARITY', versionNumber: 1,
  status: 'SENT', depositPercent: 50, sourceEstimateVersionId: 'est_clarity_1', sourceEstimateVersionLabel: 'V1',
  createdAt: '2026-08-11T01:30:00Z', updatedAt: '2026-08-11T01:30:00Z', sentAt: '2026-08-11T01:30:00Z',
  commercialRevision: 1, isCurrentDraft: false, deliveryPreparedAt: null, expiresAt: '2026-09-10',
  totals: { totalIncGstCents: 2665687, totalExGstCents: 2317989, gstCents: 347698 }, pricingSource: 'calculator_live',
};
export const quotes: QuoteVersion[] = [
  { ...quote, id: 'qv_clarity_3', versionNumber: 3, status: 'ACCEPTED', sourceEstimateVersionId: 'est_clarity_2', acceptedAt: '2026-08-15T01:00:00Z' },
  { ...quote, id: 'qv_clarity_2', versionNumber: 2, status: 'DRAFT', sentAt: null, expiresAt: null },
  quote,
];
export const invoice: DepositInvoiceSummary = {
  id: 'inv_clarity', projectId, quoteId: quote.quoteId, quoteVersionId: 'qv_clarity_3', quoteRef: quote.quoteRef,
  quoteVersionNumber: 3, invoiceRef: 'INV-CLARITY', status: 'PAID', invoiceKind: 'QUOTE_LINKED',
  paymentTermId: 'deposit', paymentTermLabel: 'Initial payment', paymentTermPosition: 1, paymentTermCount: 2,
  paymentTermCalculation: 'percentage', paymentTermPercentage: 50, depositPercent: 50,
  totalIncGstCents: 1332844, totalExGstCents: 1158995, gstCents: 173849,
  issueDate: '2026-08-15', dueDate: '2026-08-22', createdAt: '2026-08-15T01:00:00Z',
  sentAt: '2026-08-15T01:00:00Z', paidAt: '2026-08-16T01:00:00Z', paidBy: 'Fixture staff',
  reference: 'Fixture payment', customerName: 'Fixture customer', projectName: 'Fixture project', projectAddress: 'Fixture site',
  paymentReference: 'Fixture bank receipt', paymentMethod: 'bank transfer', paymentNote: null,
  voidedAt: null, voidedBy: null, voidReason: null, lastDeliveryStatus: 'SENT', lastDeliveryError: null,
  lastDeliveryAttemptAt: '2026-08-15T01:00:00Z', nextRetryAt: null, finalFailure: false, recipients: ['customer@example.invalid'],
};
export const schedule: ProjectInvoiceSchedule = {
  acceptedQuoteVersionId: 'qv_clarity_3', acceptedQuoteRef: 'Q-CLARITY', acceptedQuoteVersionNumber: 3,
  acceptedQuoteTotalIncGstCents: 2665687, paidIncGstCents: 1332844, invoicedIncGstCents: 1332844,
  outstandingIncGstCents: 0, remainingToInvoiceIncGstCents: 1332843, overCommittedIncGstCents: 0,
  unallocatedCreditIncGstCents: 0, paymentEntries: [],
  terms: [
    { quoteVersionId: 'qv_clarity_3', quoteRef: quote.quoteRef, quoteVersionNumber: 3,
      paymentTermId: 'deposit', label: 'Initial payment', position: 1, termCount: 2,
      amountIncGstCents: 1332844, allocatedPaidIncGstCents: 1332844, remainingAmountIncGstCents: 0, source: 'quote', invoice },
    { quoteVersionId: 'qv_clarity_3', quoteRef: quote.quoteRef, quoteVersionNumber: 3,
      paymentTermId: 'final', label: 'Final payment', position: 2, termCount: 2,
      amountIncGstCents: 1332843, allocatedPaidIncGstCents: 0, remainingAmountIncGstCents: 1332843, source: 'quote', invoice: null },
  ],
};
