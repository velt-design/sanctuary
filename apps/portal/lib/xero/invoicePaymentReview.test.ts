import { beforeEach, expect, it, vi } from 'vitest';
import { mapIssuedInvoiceToXeroDraft } from './invoiceDraftMapping';
import { readDepositApproval, prepareDepositApproval } from './paymentApproval';
const mocks = vi.hoisted(() => ({ context: vi.fn(), commit: vi.fn(), active: vi.fn(), previous: vi.fn(), list: vi.fn(), payment: vi.fn(), invoice: vi.fn() }));
vi.mock('../invoices/invoicePaymentRepository', () => ({ loadInvoicePaymentContext: mocks.context, commitInvoicePayment: mocks.commit }));
vi.mock('../invoices/xeroMatchRepository', () => ({ activeReceiptMatches: mocks.active, findPilotMatch: mocks.previous }));
vi.mock('./invoicePaymentProvider', () => ({ invoicePaymentProvider: { list: mocks.list, payment: mocks.payment } }));
vi.mock('./invoiceTransferProvider', () => ({ invoiceTransferProvider: { readInvoice: mocks.invoice } }));
vi.mock('./security', async original => ({ ...await original<typeof import('./security')>(), config: () => ({ tenantId: '11111111-1111-4111-8111-111111111111', key: Buffer.alloc(32, 6) }) }));
import { approveInvoicePayment, reviewInvoicePayments } from './invoicePaymentReview';
const id = '11111111-1111-4111-8111-111111111111';
const paymentId = '22222222-2222-4222-8222-222222222222';
const expected = mapIssuedInvoiceToXeroDraft({ invoiceId: id, invoiceRef: 'INV-TEST', status: 'OPEN', kind: 'QUOTE_LINKED', issueDate: '2026-09-14', dueDate: '2026-09-21',
  quoteRef: 'Q-TEST', paymentTermLabel: 'Final', totalIncGstCents: 11500, totalExGstCents: 10000, gstCents: 1500, content: null },
{ tenantId: id, contactId: id, accountCode: '200', taxType: 'OUTPUT2' });
const rawInvoice = { ...expected, InvoiceID: id, Status: 'AUTHORISED', SubTotal: 100, TotalTax: 15, Total: 115, AmountPaid: 40, UpdatedDateUTC: 'today' };
const context = { invoice: { id, projectId: id, invoiceRef: 'INV-TEST', status: 'OPEN', invoiceKind: 'QUOTE_LINKED', paymentTermPosition: 2,
  totalIncGstCents: 11500, currency: 'NZD', customerName: 'Customer', projectName: 'Project' },
  matchedCents: 0, customerWon: false, hasUnmatchedPaymentHistory: false, hasOtherSourceHistory: false,
  invoiceFingerprint: 'a'.repeat(64), ledgerFingerprint: 'b'.repeat(64), providerInvoiceId: id, expectedBody: JSON.stringify({ Invoices: [expected] }) };
const payment = { sourceKind: 'INVOICE_PAYMENT', providerInvoiceId: id, id: paymentId, contactId: id, contact: 'Different display name', reference: '',
  transactionType: 'ACCRECPAYMENT', status: 'AUTHORISED', date: '2026-09-14', total: 40, currency: 'NZD', reconciled: true, updatedAt: 'today', currencyRate: 1 };
beforeEach(() => {
  vi.resetAllMocks(); mocks.context.mockResolvedValue(structuredClone(context)); mocks.invoice.mockResolvedValue(structuredClone(rawInvoice));
  mocks.list.mockResolvedValue({ payments: [structuredClone(payment)], limited: false }); mocks.payment.mockResolvedValue(structuredClone(payment));
  mocks.active.mockResolvedValue([]); mocks.previous.mockResolvedValue(null); mocks.commit.mockResolvedValue({ matchId: id, paymentEntryId: id, replayed: false });
});
async function proposal() { return (await reviewInvoicePayments(id, id)).suggestions[0]; }
it('uses bound identities rather than customer display names and rechecks exact payment before commit', async () => {
  const p = await proposal(); expect(p.blockers).toEqual([]); expect(p.remainingIfApprovedCents).toBe(7500);
  await approveInvoicePayment(p.approvalToken!, id);
  expect(mocks.payment).toHaveBeenCalledWith(id, id, paymentId);
  expect(mocks.commit.mock.calls[0][0].evidence.invoicePayment.providerInvoiceId).toBe(id);
});
it.each([{ total: 41 }, { reconciled: false }, { status: 'DELETED' }, { contactId: paymentId }, { updatedAt: 'changed' }, { providerInvoiceId: paymentId }])('refuses changed payment evidence %j', async patch => {
  const p = await proposal(); mocks.payment.mockResolvedValue({ ...payment, ...patch });
  await expect(approveInvoicePayment(p.approvalToken!, id)).rejects.toThrow('APPROVAL_EVIDENCE_CHANGED');
  expect(mocks.commit).not.toHaveBeenCalled();
});
it.each([{ Reference: 'Changed elsewhere' }, { AmountPaid: 41 }, { UpdatedDateUTC: 'changed' }, { AmountCredited: 1 }])('requires fresh review when Xero invoice changes %j', async patch => {
  const p = await proposal(); mocks.invoice.mockResolvedValue({ ...rawInvoice, ...patch });
  await expect(approveInvoicePayment(p.approvalToken!, id)).rejects.toThrow('APPROVAL_EVIDENCE_CHANGED');
  expect(mocks.commit).not.toHaveBeenCalled();
});
it.each([{ hasOtherSourceHistory: true }, { hasUnmatchedPaymentHistory: true }, { matchedCents: 1000 }])('blocks history or paid-total conflicts %j', async patch => {
  mocks.context.mockResolvedValue({ ...context, ...patch }); expect((await proposal()).approvalToken).toBeNull();
});
it('does not approve a duplicate or incomplete result set', async () => {
  mocks.active.mockResolvedValue([{ receiptId: paymentId }]); expect((await proposal()).approvalToken).toBeNull();
  mocks.active.mockResolvedValue([]); mocks.list.mockResolvedValue({ payments: [payment], limited: true });
  expect((await proposal()).approvalToken).toBeNull();
});
it('recovers a committed result without another provider read or ledger write', async () => {
  const p = await proposal(); const approval = readDepositApproval(p.approvalToken!, id, id, Buffer.alloc(32, 6));
  mocks.previous.mockResolvedValue({ id: approval.approvalId, sourceKind: 'INVOICE_PAYMENT', providerInvoiceId: id,
    approvedBy: id, tenantId: id, receiptId: paymentId, invoiceId: id, projectId: id, amountCents: 4000,
    evidenceFingerprint: approval.evidence.receiptFingerprint, reversedAt: null, paymentEntryId: id });
  mocks.invoice.mockClear(); expect((await approveInvoicePayment(p.approvalToken!, id)).replayed).toBe(true);
  expect(mocks.invoice).not.toHaveBeenCalled(); expect(mocks.commit).not.toHaveBeenCalled();
});
it('refuses a bank-receipt envelope through the invoice-payment entry point', async () => {
  const p = await proposal(); const approval = readDepositApproval(p.approvalToken!, id, id, Buffer.alloc(32, 6));
  delete approval.evidence.invoicePayment;
  const token = prepareDepositApproval(approval.evidence, id, Buffer.alloc(32, 6));
  await expect(approveInvoicePayment(token, id)).rejects.toThrow('APPROVAL_REVIEW_REQUIRED');
  expect(mocks.previous).not.toHaveBeenCalled();
});
it('distinguishes a payment recorded here from one matched to another invoice', async () => {
 mocks.active.mockResolvedValue([{receiptId:paymentId,invoiceId:id}]);
 expect((await proposal()).alreadyRecorded).toBe(true);
 mocks.active.mockResolvedValue([{receiptId:paymentId,invoiceId:paymentId}]);
 const p=await proposal(); expect(p.alreadyRecorded).toBe(false); expect(p.approvalToken).toBeNull();
 expect(p.blockers).toContain('This payment is recorded against another portal invoice. Finance must investigate the match.');
});
