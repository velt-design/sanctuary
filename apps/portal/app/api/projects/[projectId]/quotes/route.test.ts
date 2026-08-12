import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuoteHandoffBlockedError } from '@/lib/quotes/mapping';

const requireStaffSession = vi.fn();
const parseJsonBody = vi.fn();
const createQuoteFromEstimate = vi.fn();
const createManualQuote = vi.fn();
const listQuoteVersionsForProject = vi.fn();

vi.mock('@/lib/api/staffApi', () => ({
  jsonError: (error: string, status: number) => new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } }),
  jsonOk: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  parseJsonBody,
  requireStaffSession,
}));

vi.mock('@/lib/quotes/server', () => ({
  createQuoteFromEstimate,
  createManualQuote,
  listQuoteVersionsForProject,
}));

describe('POST /api/projects/[projectId]/quotes', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffSession.mockReset();
    parseJsonBody.mockReset();
    createQuoteFromEstimate.mockReset();
    createManualQuote.mockReset();
    listQuoteVersionsForProject.mockReset();
  });

  it('forwards the actor and estimate ID through the quote domain helper', async () => {
    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' } });
    parseJsonBody.mockResolvedValue({
      ok: true,
      body: {
        estimateVersionId: 'est_1',
        clientIntentId: 'quote-create:test-1',
      },
    });
    createQuoteFromEstimate.mockResolvedValue({
      id: 'qv_1',
      status: 'DRAFT',
      totals: { totalIncGstCents: 1000, totalExGstCents: 870, gstCents: 130 },
    });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/projects/proj_1/quotes', { method: 'POST' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(201);
    expect(createQuoteFromEstimate).toHaveBeenCalledWith(
      'proj_1',
      'est_1',
      'ops@example.com',
      'quote-create:test-1',
    );
    const body = await res.json();
    expect(body).toEqual({
      quoteVersion: {
        id: 'qv_1',
        status: 'DRAFT',
        totals: { totalIncGstCents: 1000, totalExGstCents: 870, gstCents: 130 },
      },
    });
    expect(JSON.stringify(body)).not.toContain('commercial_design_input');
    expect(JSON.stringify(body)).not.toContain('pricing_source_metadata');
  });

  it('returns commercial validation when quote mapping is blocked', async () => {
    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' } });
    parseJsonBody.mockResolvedValue({
      ok: true,
      body: {
        estimateVersionId: 'est_1',
        clientIntentId: 'quote-create:test-2',
      },
    });
    createQuoteFromEstimate.mockRejectedValue(
      new QuoteHandoffBlockedError('Quote handoff blocked: Pool blind needs valid dimensions.'),
    );

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/projects/proj_1/quotes', { method: 'POST' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toEqual({ error: 'Quote handoff blocked: Pool blind needs valid dimensions.' });
  });

  it('allows admins to create a manual quote without an estimate', async () => {
    requireStaffSession.mockResolvedValue({ user: { email: 'admin@example.com' }, role: 'admin' });
    parseJsonBody.mockResolvedValue({
      ok: true,
      body: {
        mode: 'manual',
        clientIntentId: 'manual-quote:test-1',
        internalName: 'Extra works',
        lineItems: [{ description: 'Additional post', qty: 1, unitPriceIncGstCents: 120000 }],
      },
    });
    createManualQuote.mockResolvedValue({ id: 'qv_manual', status: 'DRAFT' });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/projects/proj_1/quotes', { method: 'POST' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(201);
    expect(createManualQuote).toHaveBeenCalledWith(
      'proj_1',
      'admin@example.com',
      'manual-quote:test-1',
      'Extra works',
      [{ description: 'Additional post', qty: 1, unitPriceIncGstCents: 120000 }],
    );
  });

  it('rejects manual quote creation for non-admin staff', async () => {
    requireStaffSession.mockResolvedValue({ user: { email: 'staff@example.com' }, role: 'staff' });
    parseJsonBody.mockResolvedValue({
      ok: true,
      body: { mode: 'manual', clientIntentId: 'manual-quote:test-2', lineItems: [] },
    });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/projects/proj_1/quotes', { method: 'POST' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });
    expect(res.status).toBe(403);
    expect(createManualQuote).not.toHaveBeenCalled();
  });
});
