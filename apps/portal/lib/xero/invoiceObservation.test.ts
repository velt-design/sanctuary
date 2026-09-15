import { expect, it } from 'vitest';
import { mapIssuedInvoiceToXeroDraft } from './invoiceDraftMapping';
import { observeXeroInvoice } from './invoiceObservation';
const id = '11111111-1111-4111-8111-111111111111';
const expected = mapIssuedInvoiceToXeroDraft({ invoiceId: id, invoiceRef: 'INV-TEST', status: 'OPEN', kind: 'QUOTE_LINKED', issueDate: '2026-09-14', dueDate: '2026-09-21',
  quoteRef: 'Q-TEST', paymentTermLabel: 'Deposit', totalIncGstCents: 11500, totalExGstCents: 10000, gstCents: 1500, content: null },
{ tenantId: id, contactId: id, accountCode: '200', taxType: 'OUTPUT2' });
const evidence = { ...expected, InvoiceID: id, SubTotal: 100, TotalTax: 15, Total: 115, AmountPaid: 0 };
it.each([['DRAFT', 'draft'], ['SUBMITTED', 'awaiting_approval'], ['AUTHORISED', 'posted']])('recognises unchanged %s without reporting a content conflict', (Status, state) => {
  expect(observeXeroInvoice(expected, id, false, { ...evidence, Status }).state).toBe(state);
});
it('shows Xero payments as evidence requiring portal review, not an automatic portal receipt', () => {
  expect(observeXeroInvoice(expected, id, false, { ...evidence, Status: 'AUTHORISED', AmountPaid: 40 })).toEqual({ state: 'payment_recorded', reason: 'REVIEW_PAYMENT_MATCH_IN_PORTAL', amountPaidCents: 4000 });
});
it('detects independent changes even when finance has legitimately posted the invoice', () => {
  expect(observeXeroInvoice(expected, id, false, { ...evidence, Status: 'AUTHORISED', Reference: 'Changed' }).state).toBe('conflict');
  expect(observeXeroInvoice(expected, '22222222-2222-4222-8222-222222222222', false, evidence).state).toBe('conflict');
});
it('tracks portal void correction separately from an independent Xero void', () => {
  expect(observeXeroInvoice(expected, id, true, evidence).state).toBe('correction_pending');
  expect(observeXeroInvoice(expected, id, true, { ...evidence, Status: 'VOIDED' }).state).toBe('correction_complete');
  expect(observeXeroInvoice(expected, id, false, { ...evidence, Status: 'VOIDED' }).state).toBe('conflict');
});
it('flags credits and impossible payment totals for finance instead of hiding them', () => {
  for (const change of [{ AmountCredited: 10 }, { AmountPaid: 116 }, { Status: 'PAID', AmountPaid: 100 }, { AmountPaid: 1 }]) {
    expect(observeXeroInvoice(expected, id, false, { ...evidence, ...change }).state).toBe('conflict');
  }
});
