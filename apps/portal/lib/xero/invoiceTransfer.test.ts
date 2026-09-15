import { describe, expect, it, vi } from 'vitest';
import { executeInvoiceTransfer, type FrozenInvoiceTransfer, type InvoiceTransferProvider, type InvoiceTransferRepository } from './invoiceTransfer';
import type { IssuedInvoiceForXero } from './invoiceDraftMapping';

const id = '11111111-1111-4111-8111-111111111111';
const tenantId = '22222222-2222-4222-8222-222222222222';
const providerId = '33333333-3333-4333-8333-333333333333';
const lease = { jobId: id, leaseToken: providerId };
const now = 1_800_000_000_000;
const invoice: IssuedInvoiceForXero = { invoiceId: id, invoiceRef: 'INV-TEST', status: 'OPEN', kind: 'QUOTE_LINKED',
  issueDate: '2026-09-14', dueDate: '2026-09-21', quoteRef: 'Q-TEST', paymentTermLabel: 'Deposit',
  totalIncGstCents: 11500, totalExGstCents: 10000, gstCents: 1500, content: null };

function harness() {
  let stored: FrozenInvoiceTransfer | null = null;
  let remote: unknown[] = [];
  const order: string[] = [];
  const repository: InvoiceTransferRepository = {
    context: vi.fn(async () => ({ invoice, mapping: { tenantId, contactId: id, accountCode: '200', taxType: 'OUTPUT2' } })),
    prepare: vi.fn(async (_lease, request) => {
      order.push('prepare');
      stored ??= { ...request, idempotencyKey: 'synthetic-invoice-key-1', expiresAt: now + 300000,
        dispatchStarted: false, providerInvoiceId: null, finalised: false };
      return structuredClone(stored!);
    }),
    beginDispatch: vi.fn(async () => {
      order.push('dispatch'); stored!.dispatchStarted = true; return structuredClone(stored!);
    }),
    finalise: vi.fn(async (_lease, invoiceId) => {
      order.push('finalise'); stored!.finalised = true; stored!.providerInvoiceId = invoiceId;
    }),
  };
  const provider: InvoiceTransferProvider = {
    findInvoice: vi.fn(async () => { order.push('find'); return remote; }),
    createDraft: vi.fn(async request => {
      order.push('create'); remote = [{ ...request.draft, InvoiceID: providerId,
        SubTotal: 100, TotalTax: 15, Total: 115, AmountPaid: 0 }]; return { invoiceId: providerId };
    }),
    readInvoice: vi.fn(async () => { order.push('read'); return remote[0]; }),
  };
  return { repository, provider, order, stored: () => stored!,
    setRemote: (value: unknown[]) => { remote = value; },
    run: (time = now) => executeInvoiceTransfer(lease, repository, provider, () => time) };
}

describe('durable Xero draft transfer orchestration', () => {
  it('creates an approved invoice once when the database selects automatic approval', async () => {
    const h = harness();
    const context = await h.repository.context(lease);
    h.repository.context = vi.fn(async () => ({ ...context, targetStatus: 'AUTHORISED' as const }));
    await h.run();
    expect(h.stored().draft.Status).toBe('AUTHORISED');
    await h.run();
    expect(h.provider.createDraft).toHaveBeenCalledTimes(1);
    expect(h.stored().body).not.toContain('Email');
  });
  it('refuses to report an approved transfer complete when Xero returns only a draft', async () => {
    const h = harness();
    const context = await h.repository.context(lease);
    h.repository.context = vi.fn(async () => ({ ...context, targetStatus: 'AUTHORISED' as const }));
    const read = h.provider.readInvoice;
    h.provider.readInvoice = vi.fn(async (tenant, invoiceId) => ({ ...(await read(tenant, invoiceId) as object), Status: 'DRAFT' }));
    await expect(h.run()).rejects.toThrow('XERO_INVOICE_CONFLICT');
    expect(h.repository.finalise).not.toHaveBeenCalled();
  });
  it('freezes before dispatch, verifies a fresh read and finalises once', async () => {
    const h = harness();
    expect(await h.run()).toEqual({ resultCode: 'XERO_DRAFT_VERIFIED', processedCount: 1 });
    expect(h.order).toEqual(['prepare', 'find', 'dispatch', 'create', 'read', 'finalise']);
    await h.run();
    expect(h.provider.createDraft).toHaveBeenCalledTimes(1);
    expect(h.repository.finalise).toHaveBeenCalledTimes(1);
  });

  it('recovers a lost successful write response by reading, even after retry expiry', async () => {
    const h = harness();
    const create = h.provider.createDraft;
    h.provider.createDraft = vi.fn(async request => { await create(request); throw new Error('Lost response'); });
    await expect(h.run()).rejects.toThrow('PROVIDER_OUTCOME_UNCERTAIN');
    expect(h.repository.finalise).not.toHaveBeenCalled();
    await h.run(now + 600000);
    expect(h.provider.createDraft).toHaveBeenCalledTimes(1);
    expect(h.repository.finalise).toHaveBeenCalledTimes(1);
  });

  it('retries a failed write with exactly the same saved bytes and key', async () => {
    const h = harness();
    const create = h.provider.createDraft;
    const writes: FrozenInvoiceTransfer[] = [];
    h.provider.createDraft = vi.fn(async request => {
      writes.push(request);
      if (writes.length === 1) throw new Error('Disconnected before provider');
      return create(request);
    });
    await expect(h.run()).rejects.toThrow('PROVIDER_OUTCOME_UNCERTAIN');
    await h.run(now + 30000);
    expect(writes[1].body).toBe(writes[0].body);
    expect(writes[1].idempotencyKey).toBe(writes[0].idempotencyKey);
    expect(writes[1].expiresAt).toBe(writes[0].expiresAt);
  });

  it('never blindly creates again after the safe window', async () => {
    const h = harness();
    h.provider.createDraft = vi.fn(async () => { throw new Error('Timeout'); });
    await expect(h.run()).rejects.toThrow('PROVIDER_OUTCOME_UNCERTAIN');
    await expect(h.run(now + 300000)).rejects.toThrow('IDEMPOTENCY_WINDOW_EXPIRED');
    expect(h.provider.createDraft).toHaveBeenCalledTimes(1);
  });

  it('requires finance review for an existing invoice without prior dispatch evidence', async () => {
    const h = harness(); h.setRemote([{ InvoiceID: providerId, InvoiceNumber: 'INV-TEST' }]);
    await expect(h.run()).rejects.toThrow('EXISTING_INVOICE_REVIEW');
    expect(h.repository.beginDispatch).not.toHaveBeenCalled();
    expect(h.provider.createDraft).not.toHaveBeenCalled();
  });

  it('stops before writing if lease validation or a concurrent void prevents dispatch', async () => {
    const h = harness();
    h.repository.beginDispatch = vi.fn(async () => { throw new Error('LEASE_OR_INVOICE_CHANGED'); });
    await expect(h.run()).rejects.toThrow('LEASE_OR_INVOICE_CHANGED');
    expect(h.provider.createDraft).not.toHaveBeenCalled();
  });

  it('does not finalise a provider result with different totals', async () => {
    const h = harness();
    h.provider.readInvoice = vi.fn(async () => ({ ...h.stored().draft, InvoiceID: providerId,
      Total: 116, SubTotal: 101, TotalTax: 15, AmountPaid: 0 }));
    await expect(h.run()).rejects.toThrow('XERO_INVOICE_CONFLICT');
    expect(h.repository.finalise).not.toHaveBeenCalled();
  });

  it('recovers a database finalisation failure without duplicating the provider invoice', async () => {
    const h = harness();
    const finalise = h.repository.finalise;
    h.repository.finalise = vi.fn(async () => { throw new Error('Database unavailable'); });
    await expect(h.run()).rejects.toThrow('Database unavailable');
    h.repository.finalise = finalise;
    await h.run();
    expect(h.provider.createDraft).toHaveBeenCalledTimes(1);
  });

  it('refuses altered stored request bytes even with a new claimed lease', async () => {
    const h = harness();
    h.provider.createDraft = vi.fn(async () => { throw new Error('Timeout'); });
    await expect(h.run()).rejects.toThrow();
    h.stored().body = '{}';
    await expect(h.run()).rejects.toThrow('INVALID_FROZEN_REQUEST');
    expect(h.provider.createDraft).toHaveBeenCalledTimes(1);
  });
});
