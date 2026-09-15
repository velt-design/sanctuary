import { describe, expect, it } from 'vitest';
import { reconcileXeroDraft } from './invoiceDraftReconciliation';
import { mapIssuedInvoiceToXeroDraft } from './invoiceDraftMapping';

const request = mapIssuedInvoiceToXeroDraft({ invoiceId: '11111111-1111-4111-8111-111111111111',
  invoiceRef: 'INV-TEST', status: 'OPEN', kind: 'QUOTE_LINKED', issueDate: '2026-09-14', dueDate: '2026-09-21',
  quoteRef: 'Q-TEST', paymentTermLabel: 'Deposit', totalIncGstCents: 11500, totalExGstCents: 10000,
  gstCents: 1500, content: null }, { tenantId: '22222222-2222-4222-8222-222222222222',
  contactId: '33333333-3333-4333-8333-333333333333', accountCode: '200', taxType: 'OUTPUT2' });
const provider = { ...request, InvoiceID: '44444444-4444-4444-8444-444444444444',
  Date: '/Date(1789344000000+0000)/', DateString: '2026-09-14T00:00:00',
  SubTotal: 100, TotalTax: 15, Total: 115, AmountPaid: 0 };

describe('Xero invoice evidence reconciliation', () => {
  it('finalises only an exactly matching draft', () => {
    expect(reconcileXeroDraft(request, provider)).toEqual({ outcome: 'MATCHED_DRAFT', invoiceId: provider.InvoiceID });
  });
  it('supports legacy provider midnight dates without guessing invalid timestamps', () => {
    const { DateString: _date, ...legacy } = provider;
    legacy.Date = `/Date(${Date.parse('2026-09-14T00:00:00Z')}+0000)/`;
    expect(reconcileXeroDraft(request, legacy).outcome).toBe('MATCHED_DRAFT');
    expect(reconcileXeroDraft(request, { ...legacy, Date: '/Date(1)/' }).outcome).toBe('REVIEW_REQUIRED');
  });
  it.each(['AUTHORISED', 'PAID', 'VOIDED', 'DELETED', 'SUBMITTED'])('does not overwrite %s accounting records', Status => {
    expect(reconcileXeroDraft(request, { ...provider, Status })).toEqual({ outcome: 'REVIEW_REQUIRED', reason: 'NOT_A_DRAFT' });
  });
  it.each([{ Total: 114.99 }, { TotalTax: 14.99 }, { SubTotal: 99.99 }, { AmountPaid: 1 },
    { Total: 115.0001 }, { AmountCredited: 1 }])('requires exact totals: %j', change => {
    expect(reconcileXeroDraft(request, { ...provider, ...change })).toEqual({ outcome: 'REVIEW_REQUIRED', reason: 'TOTAL_MISMATCH' });
  });
  it.each([{ Reference: '' }, { Contact: { ContactID: 'another customer' } }, { CurrencyCode: 'AUD' },
    { DateString: '2026-09-15T00:00:00' }, { DueDate: '2026-10-01' }, { InvoiceNumber: 'OTHER' }])(
    'detects existing records that merely share amounts: %j', change => {
      expect(reconcileXeroDraft(request, { ...provider, ...change }).outcome).toBe('REVIEW_REQUIRED');
    },
  );
  it.each([{ Description: 'Changed' }, { TaxType: 'NONE' }, { AccountCode: '999' },
    { Quantity: 2 }, { DiscountRate: 10 }, { Tracking: [{ Name: 'Region', Option: 'Other' }] }])(
    'detects line edits even if invoice totals match: %j', change => {
      expect(reconcileXeroDraft(request, { ...provider, LineItems: [{ ...request.LineItems[0], ...change }] }))
        .toEqual({ outcome: 'REVIEW_REQUIRED', reason: 'INVOICE_CHANGED' });
    },
  );
  it('refuses malformed provider responses and validation errors', () => {
    for (const value of [null, {}, { ...provider, InvoiceID: '' }, { ...provider, HasErrors: true },
      { ...provider, ValidationErrors: [{ Message: 'Rejected' }] }]) {
      expect(reconcileXeroDraft(request, value)).toEqual({ outcome: 'REVIEW_REQUIRED', reason: 'INVALID_RESPONSE' });
    }
  });
});
