import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffSession: vi.fn(),
  updateDraftQuoteVersion: vi.fn(),
}));

vi.mock('@/lib/api/staffApi', () => ({
  jsonError: (error: string, status: number) =>
    Response.json({ error }, { status }),
  jsonOk: (body: unknown, status = 200) => Response.json(body, { status }),
  parseJsonBody: async (request: Request) => ({
    ok: true,
    body: await request.json(),
  }),
  requireStaffSession: mocks.requireStaffSession,
}));

vi.mock('@/lib/quotes/server', () => ({
  deleteDraftQuoteVersion: vi.fn(),
  getQuoteVersionDetail: vi.fn(),
  updateDraftQuoteVersion: mocks.updateDraftQuoteVersion,
}));

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/quotes/qv_1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const context = {
  params: Promise.resolve({ quoteVersionId: 'qv_1' }),
};

describe('PATCH /api/quotes/[quoteVersionId]', () => {
  beforeEach(() => {
    mocks.requireStaffSession.mockReset();
    mocks.updateDraftQuoteVersion.mockReset();
    mocks.requireStaffSession.mockResolvedValue({
      user: { email: 'ops@example.com' },
    });
  });

  it('requires and forwards the commercial revision', async () => {
    mocks.updateDraftQuoteVersion.mockResolvedValue({
      id: 'qv_1',
      commercialRevision: 4,
    });
    const { PATCH } = await import('./route');

    const response = await PATCH(
      request({
        expectedCommercialRevision: 3,
        reference: 'Ref 3',
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(mocks.updateDraftQuoteVersion).toHaveBeenCalledWith(
      'qv_1',
      expect.objectContaining({
        expectedCommercialRevision: 3,
        reference: 'Ref 3',
      }),
    );
  });

  it('rejects an update without a commercial revision', async () => {
    const { PATCH } = await import('./route');
    const response = await PATCH(request({ reference: 'Ref 3' }), context);

    expect(response.status).toBe(400);
    expect(mocks.updateDraftQuoteVersion).not.toHaveBeenCalled();
  });

  it('maps a stale server revision to a recoverable conflict', async () => {
    mocks.updateDraftQuoteVersion.mockRejectedValue(new Error('QUOTE_STALE'));
    const { PATCH } = await import('./route');
    const response = await PATCH(
      request({ expectedCommercialRevision: 3, reference: 'Ref 3' }),
      context,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ code: 'QUOTE_STALE' }),
    );
  });
});
