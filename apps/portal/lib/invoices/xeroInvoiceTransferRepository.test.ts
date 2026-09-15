import { afterEach, describe, expect, it, vi } from 'vitest';
const rpc = vi.hoisted(() => vi.fn());
vi.mock('../supabaseClient', () => ({ supabaseServiceRole: { rpc } }));
import { xeroInvoiceTransferRepository as repository } from './xeroInvoiceTransferRepository';
import { mapIssuedInvoiceToXeroDraft } from '../xero/invoiceDraftMapping';
const id = '11111111-1111-4111-8111-111111111111';
const lease = { jobId: id, leaseToken: '22222222-2222-4222-8222-222222222222' };
const draft = mapIssuedInvoiceToXeroDraft({ invoiceId: id, invoiceRef: 'INV-TEST', status: 'OPEN', kind: 'QUOTE_LINKED',
  issueDate: '2026-09-14', dueDate: '2026-09-21', quoteRef: 'Q-TEST', paymentTermLabel: 'Deposit',
  totalIncGstCents: 115, totalExGstCents: 100, gstCents: 15, content: null },
{ tenantId: id, contactId: id, accountCode: '200', taxType: 'OUTPUT2' });
afterEach(() => vi.clearAllMocks());
describe('Xero finance RPC repository', () => {
  it('preserves original request bytes and sends the job lease to preparation', async () => {
    const body = JSON.stringify({ Invoices: [draft] });
    rpc.mockResolvedValue({ data: { body, bodyHash: 'a'.repeat(64), tenantId: id, idempotencyKey: 'synthetic-key',
      expiresAt: Date.now() + 300000, dispatchStarted: false, providerInvoiceId: null, finalised: false }, error: null });
    const result = await repository.prepare(lease, { tenantId: id, draft, body, bodyHash: 'a'.repeat(64) });
    expect(result.body).toBe(body);
    expect(JSON.stringify({ Invoices: [result.draft] })).toBe(body);
    expect(rpc).toHaveBeenCalledWith('xero_invoice_prepare_request', {
      p_job_id: lease.jobId, p_lease_token: lease.leaseToken, p_tenant_id: id, p_body: body,
    });
  });
  it('rejects provider mismatch before database finalisation', async () => {
    await expect(repository.finalise(lease, id, 'a'.repeat(64), { draft, evidence: { ...draft, InvoiceID: id, Total: 999 } }))
      .rejects.toThrow('XERO_VERIFICATION_MISMATCH');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('sends only bounded verified proof rather than the raw accounting response', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await repository.finalise(lease, id, 'a'.repeat(64), { draft,
      evidence: { ...draft, InvoiceID: id, Total: 1.15, TotalTax: 0.15, SubTotal: 1, AmountPaid: 0, PrivateExtra: 'private-data' } });
    expect(rpc).toHaveBeenCalledWith('xero_invoice_finalise', {
      p_job_id: lease.jobId, p_lease_token: lease.leaseToken, p_body_hash: 'a'.repeat(64),
      p_proof: { invoiceId: id, draft, totalCents: 115, taxCents: 15, subtotalCents: 100 },
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('private-data');
  });
  it('redacts unknown database errors and preserves fixed lease/mapping failures', async () => {
    rpc.mockResolvedValue({ error: { message: 'private connection details' } });
    await expect(repository.context(lease)).rejects.toThrow('XERO_TRANSFER_UNAVAILABLE');
    rpc.mockResolvedValue({ error: { message: 'background-job lease is no longer owned by this worker' } });
    await expect(repository.context(lease)).rejects.toThrow('XERO_LEASE_LOST');
    rpc.mockResolvedValue({ error: { message: 'XERO_MAPPING_REQUIRED' } });
    await expect(repository.context(lease)).rejects.toThrow('XERO_MAPPING_REQUIRED');
  });
});
