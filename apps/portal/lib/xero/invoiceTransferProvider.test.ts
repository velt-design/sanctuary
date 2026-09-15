import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapIssuedInvoiceToXeroDraft } from './invoiceDraftMapping';
import { invoiceTransferProvider } from './invoiceTransferProvider';
import type { FrozenInvoiceTransfer } from './invoiceTransfer';

const mocks = vi.hoisted(() => ({ access: vi.fn(), config: vi.fn() }));
vi.mock('./store', () => ({ access: mocks.access }));
vi.mock('./security', async importOriginal => ({ ...await importOriginal<typeof import('./security')>(), config: mocks.config }));
const tenantId = '11111111-1111-4111-8111-111111111111';
const invoiceId = '22222222-2222-4222-8222-222222222222';
function setup(): FrozenInvoiceTransfer {
  mocks.config.mockReturnValue({ tenantId });
  mocks.access.mockResolvedValue({ accessToken: 'synthetic-access', refreshToken: 'synthetic-refresh',
    expiresAt: Date.now() + 1800000, scopes: ['accounting.invoices'] });
  const draft = mapIssuedInvoiceToXeroDraft({ invoiceId, invoiceRef: 'INV-TEST', status: 'OPEN', kind: 'QUOTE_LINKED',
    quoteRef: 'Q-TEST', paymentTermLabel: 'Deposit', issueDate: '2026-09-14', dueDate: '2026-09-21',
    totalIncGstCents: 115, totalExGstCents: 100, gstCents: 15, content: null },
  { tenantId, contactId: invoiceId, accountCode: '200', taxType: 'OUTPUT2' });
  return { tenantId, draft, body: JSON.stringify({ Invoices: [draft] }), bodyHash: 'not-used-by-adapter',
    idempotencyKey: 'synthetic-request-key', expiresAt: Date.now() + 300000,
    dispatchStarted: true, providerInvoiceId: null, finalised: false };
}
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('Xero invoice API adapter', () => {
  it('sends exactly one frozen draft with the saved key and pinned tenant', async () => {
    const request = setup(); vi.stubEnv('XERO_INVOICE_TRANSFERS_ENABLED', 'true');
    const fetcher = vi.fn().mockResolvedValue(Response.json({ Invoices: [{ InvoiceID: invoiceId }] }));
    vi.stubGlobal('fetch', fetcher);
    expect(await invoiceTransferProvider.createDraft(request)).toEqual({ invoiceId });
    expect(fetcher.mock.calls[0]).toEqual(['https://api.xero.com/api.xro/2.0/Invoices', expect.objectContaining({
      method: 'PUT', body: request.body, redirect: 'error', cache: 'no-store',
      headers: expect.objectContaining({ 'Xero-tenant-id': tenantId, 'Idempotency-Key': request.idempotencyKey }),
    })]);
  });
  it('fails closed without both rollout enablement and proven invoice scope', async () => {
    const request = setup(); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await expect(invoiceTransferProvider.createDraft(request)).rejects.toThrow('XERO_INVOICE_TRANSFERS_DISABLED');
    vi.stubEnv('XERO_INVOICE_TRANSFERS_ENABLED', 'true');
    mocks.access.mockResolvedValue({ accessToken: 'old-token', scopes: ['accounting.invoices.read'] });
    await expect(invoiceTransferProvider.createDraft(request)).rejects.toThrow('INSUFFICIENT_SCOPE');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('refuses tenant substitution, changed payloads and expired dispatches before network writes', async () => {
    const request = setup(); vi.stubEnv('XERO_INVOICE_TRANSFERS_ENABLED', 'true');
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    for (const changed of [{ tenantId: invoiceId }, { body: '{}' }, { expiresAt: Date.now() }, { dispatchStarted: false }]) {
      await expect(invoiceTransferProvider.createDraft({ ...request, ...changed })).rejects.toThrow();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('escapes invoice names using Xero expression syntax and bounds the search', async () => {
    setup(); const fetcher = vi.fn().mockResolvedValue(Response.json({ Invoices: [] })); vi.stubGlobal('fetch', fetcher);
    await invoiceTransferProvider.findInvoice(tenantId, 'INV-"TEST"');
    const url = fetcher.mock.calls[0][0] as URL;
    expect(url.searchParams.get('where')).toBe('Type=="ACCREC"&&InvoiceNumber=="INV-""TEST"""');
    expect(url.searchParams.get('pageSize')).toBe('2');
  });
  it('rejects a wrong record ID and does not expose provider error text', async () => {
    setup(); const fetcher = vi.fn().mockResolvedValue(Response.json({ Invoices: [{ InvoiceID: tenantId }] }));
    vi.stubGlobal('fetch', fetcher);
    await expect(invoiceTransferProvider.readInvoice(tenantId, invoiceId)).rejects.toThrow('INVALID_PROVIDER_RESPONSE');
    fetcher.mockResolvedValue(new Response('private provider details', { status: 500 }));
    await expect(invoiceTransferProvider.findInvoice(tenantId, 'INV-TEST')).rejects.toThrow('XERO_INVOICE_REQUEST_FAILED');
  });
});
