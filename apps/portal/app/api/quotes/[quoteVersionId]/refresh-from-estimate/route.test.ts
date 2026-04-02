import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffSession = vi.fn();
const parseJsonBody = vi.fn();
const refreshDraftQuoteVersionFromEstimate = vi.fn();

vi.mock('@/lib/api/staffApi', () => ({
  jsonError: (error: string, status: number) => new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } }),
  jsonOk: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  parseJsonBody,
  requireStaffSession,
}));

vi.mock('@/lib/quotes/server', () => ({
  refreshDraftQuoteVersionFromEstimate,
}));

describe('POST /api/quotes/[quoteVersionId]/refresh-from-estimate', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffSession.mockReset();
    parseJsonBody.mockReset();
    refreshDraftQuoteVersionFromEstimate.mockReset();
  });

  it('returns the refreshed draft quote', async () => {
    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' } });
    parseJsonBody.mockResolvedValue({ ok: true, body: { estimateVersionId: 'est_2' } });
    refreshDraftQuoteVersionFromEstimate.mockResolvedValue({ id: 'qv_1', status: 'DRAFT' });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/quotes/qv_1/refresh-from-estimate', { method: 'POST' }), {
      params: Promise.resolve({ quoteVersionId: 'qv_1' }),
    });

    expect(res.status).toBe(200);
    expect(refreshDraftQuoteVersionFromEstimate).toHaveBeenCalledWith('qv_1', 'est_2', 'ops@example.com');
    await expect(res.json()).resolves.toEqual({ quoteVersion: { id: 'qv_1', status: 'DRAFT' } });
  });

  it('returns 423 when the quote is locked', async () => {
    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' } });
    parseJsonBody.mockResolvedValue({ ok: true, body: { estimateVersionId: 'est_2' } });
    refreshDraftQuoteVersionFromEstimate.mockRejectedValue(new Error('Quote is locked'));

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/quotes/qv_1/refresh-from-estimate', { method: 'POST' }), {
      params: Promise.resolve({ quoteVersionId: 'qv_1' }),
    });

    expect(res.status).toBe(423);
    await expect(res.json()).resolves.toEqual({ error: 'Quote is locked', code: 'QUOTE_LOCKED' });
  });
});
