import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  markQuoteVersionSuperseded: vi.fn(),
  getQuoteVersionDetail: vi.fn(),
}));

vi.mock('@/lib/api/adminApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/adminApi')>('@/lib/api/adminApi');
  return { ...actual, requireAdminSession: mocks.requireAdminSession };
});
vi.mock('@/lib/quotes/adminLifecycle', () => ({
  markQuoteVersionSuperseded: mocks.markQuoteVersionSuperseded,
}));
vi.mock('@/lib/quotes/server', () => ({
  getQuoteVersionDetail: mocks.getQuoteVersionDetail,
}));

import { POST } from './route';

const context = { params: Promise.resolve({ quoteVersionId: 'qv_1' }) };

describe('POST /api/admin/quotes/[quoteVersionId]/supersede', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({
      ok: true,
      session: { user: { id: 'admin-1' } },
    });
    mocks.markQuoteVersionSuperseded.mockResolvedValue({
      changed: true,
      previousStatus: 'ACCEPTED',
    });
    mocks.getQuoteVersionDetail.mockResolvedValue({ id: 'qv_1', status: 'SUPERSEDED' });
  });

  it('immediately supersedes a quote for an admin', async () => {
    const response = await POST(new Request('http://localhost', { method: 'POST' }), context);

    expect(response.status).toBe(200);
    expect(mocks.markQuoteVersionSuperseded).toHaveBeenCalledWith('qv_1', 'admin-1');
    await expect(response.json()).resolves.toEqual({
      quoteVersion: { id: 'qv_1', status: 'SUPERSEDED' },
    });
  });

  it('rejects non-admin users', async () => {
    mocks.requireAdminSession.mockResolvedValue({
      ok: false,
      response: Response.json({ error: 'Forbidden' }, { status: 403 }),
    });

    const response = await POST(new Request('http://localhost', { method: 'POST' }), context);

    expect(response.status).toBe(403);
    expect(mocks.markQuoteVersionSuperseded).not.toHaveBeenCalled();
  });
});
