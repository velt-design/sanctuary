import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminSession = vi.fn();
const parseJsonBody = vi.fn();
const getQuoteVersionDetail = vi.fn();
const getProjectInvoiceSchedule = vi.fn();
const createAdminInvoice = vi.fn();
const sendDepositInvoiceNow = vi.fn();

vi.mock('@/lib/api/adminApi', () => ({
  jsonError: (error: string, status: number) => new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } }),
  jsonOk: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  parseJsonBody,
  requireAdminSession,
}));
vi.mock('@/lib/invoices/adminPayments', () => ({ createAdminInvoice, getProjectInvoiceSchedule }));
vi.mock('@/lib/invoices/server', () => ({ sendDepositInvoiceNow }));
vi.mock('@/lib/quotes/server', () => ({ getQuoteVersionDetail }));

const firstTerm = {
  id: 'deposit', label: 'Initial payment', calculationType: 'percentage',
  fixedAmountIncGstCents: null, percentageOfRemainder: 50, resolvedAmountIncGstCents: 500,
};

describe('POST /api/staff/v1/quotes/[quoteId]/invoice compatibility adapter', () => {
  beforeEach(() => {
    vi.resetModules();
    for (const mock of [requireAdminSession, parseJsonBody, getQuoteVersionDetail, getProjectInvoiceSchedule, createAdminInvoice, sendDepositInvoiceNow]) mock.mockReset();
    requireAdminSession.mockResolvedValue({ ok: true, session: { user: { id: 'admin-uuid' } } });
    parseJsonBody.mockResolvedValue({ ok: true, body: { sendNow: false } });
    getQuoteVersionDetail.mockResolvedValue({
      id: 'qv_1', projectId: 'proj_1', status: 'ACCEPTED', paymentTerms: [firstTerm],
    });
    getProjectInvoiceSchedule.mockResolvedValue({ terms: [] });
  });

  it('keeps invoice creation admin-only', async () => {
    requireAdminSession.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
    });
    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/quotes/qv_1/invoice', { method: 'POST' }), {
      params: Promise.resolve({ quoteId: 'qv_1' }),
    });
    expect(res.status).toBe(403);
    expect(createAdminInvoice).not.toHaveBeenCalled();
  });

  it('adapts the legacy path to the authoritative first-stage command', async () => {
    createAdminInvoice.mockResolvedValue({ invoice: { id: 'inv_1' }, created: true, sent: false });
    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/quotes/qv_1/invoice', { method: 'POST' }), {
      params: Promise.resolve({ quoteId: 'qv_1' }),
    });
    expect(res.status).toBe(200);
    expect(createAdminInvoice).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'proj_1', quoteVersionId: 'qv_1', mode: 'next_stage',
      paymentTermId: 'deposit', label: 'Initial payment', actor: 'admin-uuid',
      clientIntentId: expect.stringMatching(/^legacy-first-stage-/),
    }));
  });

  it('reuses a deterministic intent when the legacy request is retried', async () => {
    createAdminInvoice.mockResolvedValue({ invoice: { id: 'inv_1' }, created: true, sent: false });
    const mod = await import('./route');
    const request = () => new Request('http://localhost/api/staff/v1/quotes/qv_1/invoice', { method: 'POST' });
    const context = () => ({ params: Promise.resolve({ quoteId: 'qv_1' }) });

    await mod.POST(request(), context());
    await mod.POST(request(), context());

    const firstIntent = createAdminInvoice.mock.calls[0]?.[0]?.clientIntentId;
    const secondIntent = createAdminInvoice.mock.calls[1]?.[0]?.clientIntentId;
    expect(firstIntent).toBe(secondIntent);
    expect(firstIntent).toMatch(/^legacy-first-stage-[a-f0-9]{64}$/);
  });

  it('returns an existing whole invoice instead of attempting a duplicate', async () => {
    const invoice = { id: 'inv_1', lastDeliveryStatus: 'NOT_SENT' };
    getProjectInvoiceSchedule.mockResolvedValue({
      terms: [{ quoteVersionId: 'qv_1', paymentTermId: 'deposit', invoice }],
    });
    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/quotes/qv_1/invoice', { method: 'POST' }), {
      params: Promise.resolve({ quoteId: 'qv_1' }),
    });
    expect(res.status).toBe(200);
    expect(createAdminInvoice).not.toHaveBeenCalled();
    expect(await res.json()).toMatchObject({ invoice, created: false, sent: false });
  });
});
