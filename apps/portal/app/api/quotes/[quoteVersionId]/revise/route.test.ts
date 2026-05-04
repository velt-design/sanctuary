import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffSession = vi.fn();
const reviseQuoteVersion = vi.fn();

vi.mock('@/lib/api/staffApi', () => ({
  jsonError: (error: string, status: number) => new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } }),
  jsonOk: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  requireStaffSession,
}));

vi.mock('@/lib/quotes/server', () => ({
  reviseQuoteVersion,
}));

describe('POST /api/quotes/[quoteVersionId]/revise', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffSession.mockReset();
    reviseQuoteVersion.mockReset();
  });

  it('returns the new draft revision without source metadata fields', async () => {
    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' } });
    reviseQuoteVersion.mockResolvedValue({
      id: 'qv_2',
      revisedFromQuoteVersionId: 'qv_1',
      status: 'DRAFT',
      totals: { totalIncGstCents: 1000, totalExGstCents: 870, gstCents: 130 },
    });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/quotes/qv_1/revise', { method: 'POST' }), {
      params: Promise.resolve({ quoteVersionId: 'qv_1' }),
    });

    expect(res.status).toBe(200);
    expect(reviseQuoteVersion).toHaveBeenCalledWith('qv_1', 'ops@example.com');
    const body = await res.json();
    expect(body.quoteVersion.status).toBe('DRAFT');
    expect(body.quoteVersion.revisedFromQuoteVersionId).toBe('qv_1');
    expect(JSON.stringify(body)).not.toContain('commercial_design_input');
    expect(JSON.stringify(body)).not.toContain('pricing_source_metadata');
  });
});
