import { describe, expect, it } from 'vitest';
import { mapIssuedInvoiceToXeroDraft, type IssuedInvoiceForXero, type XeroInvoiceMapping } from './invoiceDraftMapping';

const mapping: XeroInvoiceMapping = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  contactId: '22222222-2222-4222-8222-222222222222', accountCode: '200', taxType: 'OUTPUT2',
};
const invoice: IssuedInvoiceForXero = {
  invoiceId: '33333333-3333-4333-8333-333333333333', invoiceRef: 'INV-TEST-1',
  status: 'OPEN', kind: 'QUOTE_LINKED', issueDate: '2026-09-14', dueDate: '2026-09-21',
  quoteRef: 'Q-TEST', paymentTermLabel: 'Deposit', totalIncGstCents: 1332844,
  totalExGstCents: 1158995, gstCents: 173849,
  content: { version: 1, billingName: 'Synthetic customer', billingEmail: 'example@example.com',
    billingAddress: 'Test address', notes: '', items: [
      { id: 'a', description: 'Full job scope', qty: 1, unitPriceIncGstCents: 2665687, lineTotalIncGstCents: 2665687 },
    ] },
};

describe('issued invoice to Xero draft mapping', () => {
  it('exports only the deposit being charged, not the full reference quote', () => {
    const draft = mapIssuedInvoiceToXeroDraft(invoice, mapping);
    expect(draft).toMatchObject({ Status: 'DRAFT', Type: 'ACCREC', CurrencyCode: 'NZD',
      InvoiceNumber: invoice.invoiceRef, Contact: { ContactID: mapping.contactId }, LineAmountTypes: 'Inclusive' });
    expect(draft.LineItems).toEqual([{ Description: 'Deposit - Q-TEST', Quantity: 1,
      UnitAmount: 13328.44, LineAmount: 13328.44, TaxAmount: 1738.49, AccountCode: '200', TaxType: 'OUTPUT2' }]);
    expect(JSON.stringify(draft)).not.toContain('example@example.com');
    expect(JSON.stringify(draft)).not.toContain('Full job scope');
  });

  it.each(['DRAFT', 'VOID'] as const)('does not export %s invoices', status => {
    expect(() => mapIssuedInvoiceToXeroDraft({ ...invoice, status }, mapping)).toThrow('NOT_ISSUED');
  });

  it('still maps a queued issued invoice paid before transfer, without writing a payment', () => {
    const draft = mapIssuedInvoiceToXeroDraft({ ...invoice, status: 'PAID' }, mapping);
    expect(draft.Status).toBe('DRAFT');
    expect(draft).not.toHaveProperty('Payments');
    expect(draft).not.toHaveProperty('AmountPaid');
  });

  it('supports legacy issued deposits without inventing reference items', () => {
    expect(mapIssuedInvoiceToXeroDraft({ ...invoice, content: null }, mapping).LineItems[0].LineAmount).toBe(13328.44);
  });

  it('keeps standalone items and apportions saved tax without rounding drift', () => {
    const standalone: IssuedInvoiceForXero = { ...invoice, kind: 'STANDALONE', quoteRef: null,
      totalIncGstCents: 3, totalExGstCents: 2, gstCents: 1,
      content: { ...invoice.content!, items: ['a', 'b', 'c'].map(id => ({ id, description: id,
        qty: 1, unitPriceIncGstCents: 1, lineTotalIncGstCents: 1 })) } };
    const lines = mapIssuedInvoiceToXeroDraft(standalone, mapping).LineItems;
    expect(lines.map(line => line.TaxAmount)).toEqual([0, 0.01, 0]);
    expect(lines.map(line => line.Description)).toEqual(['a', 'b', 'c']);
    expect(lines.reduce((sum, line) => sum + Math.round(line.LineAmount * 100), 0)).toBe(3);
  });

  it('preserves fractional quantities and rounded line amounts', () => {
    const standalone: IssuedInvoiceForXero = { ...invoice, kind: 'STANDALONE',
      totalIncGstCents: 174, totalExGstCents: 151, gstCents: 23,
      content: { ...invoice.content!, items: [{ id: 'a', description: 'Material', qty: 1.5,
        unitPriceIncGstCents: 116, lineTotalIncGstCents: 174 }] } };
    expect(mapIssuedInvoiceToXeroDraft(standalone, mapping).LineItems[0]).toMatchObject({
      Quantity: 1.5, UnitAmount: 1.16, LineAmount: 1.74, TaxAmount: 0.23,
    });
  });

  it.each([
    { totalExGstCents: 1 }, { gstCents: -1 }, { totalIncGstCents: Number.MAX_SAFE_INTEGER + 1 },
    { issueDate: '2026-02-30' }, { dueDate: '2026-9-1' }, { invoiceRef: '' },
  ])('rejects invalid issued values rather than repairing financial evidence: %j', invalid => {
    expect(() => mapIssuedInvoiceToXeroDraft({ ...invoice, ...invalid }, mapping)).toThrow('INVALID_INVOICE');
  });

  it('refuses standalone content whose scope total differs from the invoice', () => {
    expect(() => mapIssuedInvoiceToXeroDraft({ ...invoice, kind: 'STANDALONE' }, mapping)).toThrow('TOTAL_MISMATCH');
    expect(() => mapIssuedInvoiceToXeroDraft({ ...invoice, kind: 'STANDALONE', content: null }, mapping)).toThrow('MISSING_CONTENT');
  });

  it.each([{ contactId: 'customer name' }, { tenantId: '' }, { taxType: '' }, { accountCode: '' }])(
    'requires explicit mapping rather than guesses: %j', invalid => {
      expect(() => mapIssuedInvoiceToXeroDraft(invoice, { ...mapping, ...invalid })).toThrow('MISSING_MAPPING');
    },
  );
});
