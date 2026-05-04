import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffSession = vi.fn();
const parseJsonBody = vi.fn();
const createDepositInvoiceFromQuote = vi.fn();

vi.mock('@/lib/api/staffApi', () => ({
  jsonError: (error: string, status: number) => new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } }),
  jsonOk: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  parseJsonBody,
  requireStaffSession,
}));

vi.mock('@/lib/invoices/server', () => ({
  createDepositInvoiceFromQuote,
}));

describe('POST /api/staff/v1/quotes/[quoteId]/invoice', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffSession.mockReset();
    parseJsonBody.mockReset();
    createDepositInvoiceFromQuote.mockReset();
  });

  it('returns the invoice domain summary without commercial source metadata', async () => {
    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' } });
    parseJsonBody.mockResolvedValue({ ok: true, body: { depositPercent: 50, sendNow: false } });
    createDepositInvoiceFromQuote.mockResolvedValue({
      invoice: {
        id: 'inv_1',
        quoteVersionId: 'qv_1',
        invoiceRef: 'INV-1',
        totalIncGstCents: 500,
      },
      created: true,
      sent: false,
      alreadySent: false,
      sendError: null,
    });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/quotes/qv_1/invoice', { method: 'POST' }), {
      params: Promise.resolve({ quoteId: 'qv_1' }),
    });

    expect(res.status).toBe(200);
    expect(createDepositInvoiceFromQuote).toHaveBeenCalledWith({
      quoteVersionId: 'qv_1',
      actor: 'ops@example.com',
      depositPercent: 50,
      dueDate: undefined,
      reference: undefined,
      sendNow: false,
    });
    const body = await res.json();
    expect(body.invoice.quoteVersionId).toBe('qv_1');
    expect(JSON.stringify(body)).not.toContain('commercial_design_input');
    expect(JSON.stringify(body)).not.toContain('pricing_source_metadata');
  });
});
