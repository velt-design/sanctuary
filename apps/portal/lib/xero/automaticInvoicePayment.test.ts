import { beforeEach, expect, it, vi } from 'vitest';
import { mapIssuedInvoiceToXeroDraft } from './invoiceDraftMapping';
const mocks=vi.hoisted(()=>({context:vi.fn(),record:vi.fn(),matches:vi.fn(),invoice:vi.fn(),list:vi.fn(),payment:vi.fn()}));
vi.mock('../invoices/automaticInvoicePaymentRepository',()=>({automaticPaymentContext:mocks.context,recordAutomaticPayment:mocks.record}));
vi.mock('../invoices/xeroMatchRepository',()=>({activeReceiptMatches:mocks.matches}));
vi.mock('./invoicePaymentProvider',()=>({invoicePaymentProvider:{list:mocks.list,payment:mocks.payment}}));
vi.mock('./invoiceTransferProvider',()=>({invoiceTransferProvider:{readInvoice:mocks.invoice}}));
import { recordNextInvoicePayment } from './automaticInvoicePayment';
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

beforeEach(()=>{
  vi.resetAllMocks();mocks.context.mockResolvedValue(structuredClone(context));mocks.invoice.mockResolvedValue(structuredClone(rawInvoice));
  mocks.list.mockResolvedValue({payments:[structuredClone(payment)],limited:false});mocks.payment.mockResolvedValue(structuredClone(payment));
  mocks.matches.mockResolvedValue([]);mocks.record.mockResolvedValue({matchId:id,paymentEntryId:id,replayed:false});
});
it('records exact reconciled evidence without a human approval envelope',async()=>{
  expect((await recordNextInvoicePayment(id,id)).state).toBe('recorded');
  const [key,e]=mocks.record.mock.calls[0];expect(key).toMatch(/^[a-f0-9-]{36}$/);expect(e.amountCents).toBe(4000);
  expect(e.invoicePayment.providerInvoiceId).toBe(id);expect(e.approverId).toBeUndefined();
  await recordNextInvoicePayment(id,id);expect(mocks.record.mock.calls[1][0]).toBe(key);
});
it('does not overlap invoice and payment-list reads within one check', async()=>{
  let release!: (value: typeof rawInvoice) => void;
  mocks.invoice.mockImplementation(()=>new Promise(resolve=>{release=resolve;}));
  const checking=recordNextInvoicePayment(id,id);
  await vi.waitFor(()=>expect(mocks.invoice).toHaveBeenCalledOnce());
  expect(mocks.list).not.toHaveBeenCalled();
  release(rawInvoice); await checking;
  expect(mocks.list).toHaveBeenCalledOnce();
});
it.each([{reconciled:false},{contactId:paymentId},{total:116},{currencyRate:2}])('leaves conflicting evidence for review %j',async patch=>{
  mocks.list.mockResolvedValue({payments:[{...payment,...patch}],limited:false});
  expect((await recordNextInvoicePayment(id,id)).state).toBe('review');expect(mocks.record).not.toHaveBeenCalled();
});
it('does not write from an incomplete payment list',async()=>{
  mocks.list.mockResolvedValue({payments:[payment],limited:true});expect((await recordNextInvoicePayment(id,id)).state).toBe('review');expect(mocks.record).not.toHaveBeenCalled();
});
it('rechecks the exact receipt and refuses a change during the check',async()=>{
  mocks.payment.mockResolvedValue({...payment,updatedAt:'changed'});expect((await recordNextInvoicePayment(id,id)).state).toBe('review');expect(mocks.record).not.toHaveBeenCalled();
});
it('recovers a lost response from an already recorded payment without another write',async()=>{
  mocks.matches.mockResolvedValue([{receiptId:paymentId,invoiceId:id,sourceKind:'INVOICE_PAYMENT',amountCents:4000}]);
  mocks.context.mockResolvedValue({...context,matchedCents:4000});expect((await recordNextInvoicePayment(id,id)).state).toBe('current');expect(mocks.record).not.toHaveBeenCalled();
});
it('does not adopt a payment recorded against another invoice',async()=>{
  mocks.matches.mockResolvedValue([{receiptId:paymentId,invoiceId:paymentId,sourceKind:'INVOICE_PAYMENT',amountCents:4000}]);
  expect((await recordNextInvoicePayment(id,id)).state).toBe('review');expect(mocks.record).not.toHaveBeenCalled();
});
it('reports conflicting invoice content even when no payments were returned',async()=>{
  mocks.list.mockResolvedValue({payments:[],limited:false});mocks.invoice.mockResolvedValue({...rawInvoice,Total:116});
  expect((await recordNextInvoicePayment(id,id)).state).toBe('review');
});
it('propagates write uncertainty for durable retry rather than claiming success',async()=>{
  mocks.record.mockRejectedValue(new Error('connection lost'));await expect(recordNextInvoicePayment(id,id)).rejects.toThrow('connection lost');
});
