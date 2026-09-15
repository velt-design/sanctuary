import { describe, expect, it } from 'vitest';
import { suggestDepositMatches, type MatchInvoice, type ReceiptCandidate } from './paymentSuggestions';

const invoice: MatchInvoice = { id: 'inv-test', projectId: 'proj-test', invoiceRef: 'INV-0001', status: 'OPEN', invoiceKind: 'QUOTE_LINKED', paymentTermPosition: 1, customerName: 'Example Customer', projectName: 'Example project', totalIncGstCents: 10000, reference: null };
const receipt: ReceiptCandidate = { id: 'receipt-test', contact: 'Example Customer', reference: '', date: '2026-09-01T00:00:00', status: 'AUTHORISED', currency: 'NZD', total: 100, reconciled: true };
const suggest = (patch: Partial<ReceiptCandidate> = {}, invoicePatch: Partial<MatchInvoice> = {}) => suggestDepositMatches({ ...invoice, ...invoicePatch }, [], [{ ...receipt, ...patch }])[0];

describe('deposit match review policy', () => {
  it.each([0.01, 1, 49.99, 100])('any positive deposit %s proposes a win without claiming a paid invoice', total => {
    const result = suggest({ total });
    expect(result.customerWonIfApproved).toBe(true);
    expect(result.depositRemainingIfApprovedCents).toBe(10000 - Math.round(total * 100));
    expect(result.assessment).toBe('review');
    expect(invoice.status).toBe('OPEN');
  });
  it.each([0, -1, null, NaN, Infinity, 0.001, 101])('blocks invalid or over-invoice receipt %s', total => {
    expect(suggest({ total }).customerWonIfApproved).toBe(false);
    expect(suggest({ total }).depositRemainingIfApprovedCents).toBeNull();
  });
  it.each([{ status: 'DELETED' }, { reconciled: false }, { reconciled: null }, { currency: 'AUD' }, { date: 'unknown' }, { contact: 'Other Customer' }])('blocks unverified evidence %j', patch => {
    expect(suggest(patch).assessment).toBe('blocked');
  });
  it.each([{ status: 'PAID' as const }, { status: 'VOID' as const }, { status: 'DRAFT' as const }, { paymentTermPosition: 2 }, { invoiceKind: 'STANDALONE' as const }])('does not infer a new deposit from %j', patch => {
    expect(suggest({}, patch).assessment).toBe('blocked');
  });
  it('blocks any existing project payment history, including history requiring reversal review', () => {
    expect(suggestDepositMatches(invoice, [{ id: 'existing' }], [receipt])[0].assessment).toBe('blocked');
  });
  it('keeps multiple possible receipts separate and names missing reference evidence', () => {
    const rows = suggestDepositMatches(invoice, [], [receipt, { ...receipt, id: 'another', total: 50 }]);
    expect(rows.map(row => row.depositRemainingIfApprovedCents)).toEqual([0, 5000]);
    expect(rows[0].reasons.join(' ')).toContain('Multiple');
    expect(rows[0].reasons.join(' ')).toContain('No exact invoice reference');
  });
});
