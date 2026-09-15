import { expect, it } from 'vitest';
import { mapIssuedInvoiceToXeroDraft } from './invoiceDraftMapping';
import { invoiceEvidence, inspect } from './invoicePaymentAssessment';
import type { InvoicePaymentContext } from '../invoices/invoicePaymentRepository';
const id = '11111111-1111-4111-8111-111111111111';
const paymentId = '22222222-2222-4222-8222-222222222222';
const expected = mapIssuedInvoiceToXeroDraft({ invoiceId: id, invoiceRef: 'INV-TEST', status: 'OPEN', kind: 'QUOTE_LINKED', issueDate: '2026-09-14', dueDate: '2026-09-21',
  quoteRef: 'Q-TEST', paymentTermLabel: 'Final', totalIncGstCents: 11500, totalExGstCents: 10000, gstCents: 1500, content: null },
{ tenantId: id, contactId: id, accountCode: '200', taxType: 'OUTPUT2' });
const rawInvoice = { ...expected, InvoiceID: id, Status: 'AUTHORISED', SubTotal: 100, TotalTax: 15, Total: 115, AmountPaid: 40, UpdatedDateUTC: 'today' };
const context: InvoicePaymentContext = { invoice: { id, projectId: id, invoiceRef: 'INV-TEST', status: 'OPEN', invoiceKind: 'QUOTE_LINKED', paymentTermPosition: 2,
  totalIncGstCents: 11500, currency: 'NZD', customerName: 'Customer', projectName: 'Project' },
  matchedCents: 0, customerWon: false, hasUnmatchedPaymentHistory: false, hasOtherSourceHistory: false,
  invoiceFingerprint: 'a'.repeat(64), ledgerFingerprint: 'b'.repeat(64), providerInvoiceId: id, expectedBody: JSON.stringify({ Invoices: [expected] }) };
const payment = { sourceKind: 'INVOICE_PAYMENT' as const, providerInvoiceId: id, id: paymentId, contactId: id, contact: 'Different display name', reference: '',
  transactionType: 'ACCRECPAYMENT', status: 'AUTHORISED', date: '2026-09-14', total: 40, currency: 'NZD', reconciled: true, updatedAt: 'today', currencyRate: 1 };

it('accepts an exact reconciled partial payment and calculates the remaining balance', () => {
  const result = inspect(context, payment, invoiceEvidence(context, rawInvoice));
  expect(result.blockers).toEqual([]);
  expect(result.remainingIfApprovedCents).toBe(7500);
});
it.each([{ reconciled: false }, { contactId: paymentId }, { providerInvoiceId: paymentId }, { total: 116 }, { currencyRate: 2 }])('rejects unsafe receipt evidence %j', patch => {
  expect(inspect(context, {...payment, ...patch}, invoiceEvidence(context, rawInvoice)).blockers.length).toBeGreaterThan(0);
});
it('rejects invoice content that differs from the frozen portal request', () => {
  expect(inspect(context, payment, invoiceEvidence(context, {...rawInvoice, Total: 116})).blockers.length).toBeGreaterThan(0);
});
