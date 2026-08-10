import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffSession: vi.fn(),
  requireAdminSession: vi.fn(),
  deleteDraftQuoteVersion: vi.fn(),
  updateDraftQuoteVersion: vi.fn(),
}));

vi.mock('@/lib/api/adminApi', () => ({
  requireAdminSession: mocks.requireAdminSession,
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
  deleteDraftQuoteVersion: mocks.deleteDraftQuoteVersion,
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
    mocks.requireAdminSession.mockReset();
    mocks.deleteDraftQuoteVersion.mockReset();
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

describe('DELETE /api/quotes/[quoteVersionId]', () => {
  beforeEach(() => {
    mocks.requireAdminSession.mockReset();
    mocks.deleteDraftQuoteVersion.mockReset();
  });

  it('requires an admin before deleting a draft quote', async () => {
    mocks.requireAdminSession.mockResolvedValue({ ok: false, response: Response.json({ error: 'Forbidden' }, { status: 403 }) });
    const { DELETE } = await import('./route');
    const response = await DELETE(new Request('http://localhost/api/quotes/qv_1', { method: 'DELETE' }), context);
    expect(response.status).toBe(403);
    expect(mocks.deleteDraftQuoteVersion).not.toHaveBeenCalled();
  });

  it('allows an admin to delete an unsent draft quote', async () => {
    mocks.requireAdminSession.mockResolvedValue({ ok: true, session: { user: { id: 'admin-1' } } });
    mocks.deleteDraftQuoteVersion.mockResolvedValue(undefined);
    const { DELETE } = await import('./route');
    const response = await DELETE(new Request('http://localhost/api/quotes/qv_1', { method: 'DELETE' }), context);
    expect(response.status).toBe(200);
    expect(mocks.deleteDraftQuoteVersion).toHaveBeenCalledWith('qv_1', 'admin-1');
  });
});
