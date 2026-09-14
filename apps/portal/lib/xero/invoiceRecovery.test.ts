import { createHash } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { mapIssuedInvoiceToXeroDraft } from './invoiceDraftMapping';
import { recoverInvoiceTransfer } from './invoiceRecovery';
const id = '11111111-1111-4111-8111-111111111111';
function setup() {
  const draft = mapIssuedInvoiceToXeroDraft({ invoiceId: id, invoiceRef: 'INV-TEST', status: 'OPEN', kind: 'QUOTE_LINKED',
    quoteRef: 'Q-TEST', paymentTermLabel: 'Deposit', issueDate: '2026-09-14', dueDate: '2026-09-21',
    totalIncGstCents: 115, totalExGstCents: 100, gstCents: 15, content: null }, { tenantId: id, contactId: id, accountCode: '475', taxType: 'TAX001' });
  const body = JSON.stringify({ Invoices: [draft] });
  const request = { tenantId: id, draft, body, bodyHash: createHash('sha256').update(body).digest('hex'), idempotencyKey: 'synthetic-recovery-key',
    expiresAt: 1, dispatchStarted: true, providerInvoiceId: null, finalised: false };
  const evidence = { ...draft, InvoiceID: id, Total: 1.15, SubTotal: 1, TotalTax: 0.15, AmountPaid: 0 };
  const repository = { load: vi.fn().mockResolvedValue(request), finalise: vi.fn() };
  const provider = { findInvoice: vi.fn().mockResolvedValue([evidence]), readInvoice: vi.fn(), createDraft: vi.fn() };
  return { request, evidence, repository, provider, run: () => recoverInvoiceTransfer(repository, provider) };
}
it('recovers an exact dispatched draft after expiry without accessing any provider write method', async () => {
  const s = setup(); expect(await s.run()).toEqual({ state: 'recovered' });
  expect(s.repository.finalise).toHaveBeenCalledExactlyOnceWith(s.request, id, s.evidence);
  expect(s.provider.createDraft).not.toHaveBeenCalled();
});
it('does not create a replacement when the expected draft is absent, duplicated or changed', async () => {
  for (const mode of ['absent', 'duplicate', 'changed', 'posted']) {
    const s = setup(); s.provider.findInvoice.mockResolvedValue(mode === 'absent' ? [] : mode === 'duplicate' ? [s.evidence, s.evidence]
      : [{ ...s.evidence, ...(mode === 'posted' ? { Status: 'AUTHORISED' } : { Total: 999 }) }]);
    await expect(s.run()).rejects.toThrow(/XERO_RECOVERY_NOT_FOUND|XERO_INVOICE_CONFLICT/);
    expect(s.provider.createDraft).not.toHaveBeenCalled(); expect(s.repository.finalise).not.toHaveBeenCalled();
  }
});
it('refuses invalid saved bytes and requires a prior dispatch before looking at Xero', async () => {
  for (const change of [{ bodyHash: 'invalid' }, { dispatchStarted: false }]) {
    const s = setup(); s.repository.load.mockResolvedValue({ ...s.request, ...change });
    await expect(s.run()).rejects.toThrow(); expect(s.provider.findInvoice).not.toHaveBeenCalled();
  }
});
it('returns an already-finalised transfer without claiming a fresh provider check', async () => {
  const s = setup(); s.repository.load.mockResolvedValue({ ...s.request, providerInvoiceId: id, finalised: true });
  expect(await s.run()).toEqual({ state: 'already_verified' }); expect(s.provider.findInvoice).not.toHaveBeenCalled(); expect(s.repository.finalise).not.toHaveBeenCalled();
});
