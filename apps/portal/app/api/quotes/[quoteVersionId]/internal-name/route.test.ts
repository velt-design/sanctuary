import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateQuoteInternalNameByVersion = vi.hoisted(() => vi.fn());
const getQuoteVersionDetail = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi');
  return {
    ...actual,
    requireStaffSession: vi.fn(async () => ({ user: { email: 'ops@example.com' } })),
  };
});

vi.mock('@/lib/quotes/internalName.server', () => ({ updateQuoteInternalNameByVersion }));
vi.mock('@/lib/quotes/server', () => ({ getQuoteVersionDetail }));

import { PATCH } from './route';

describe('PATCH /api/quotes/[quoteVersionId]/internal-name', () => {
  beforeEach(() => {
    updateQuoteInternalNameByVersion.mockReset().mockResolvedValue({ projectUuid: 'project-uuid' });
    getQuoteVersionDetail.mockReset().mockResolvedValue({
      id: 'qv_1',
      quoteId: 'qt_1',
      internalName: 'Front deck pergola',
    });
  });

  it('updates the quote family name without requiring a mutable draft', async () => {
    const response = await PATCH(
      new Request('http://localhost/api/quotes/qv_1/internal-name', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ internalName: '  Front   deck pergola ' }),
      }),
      { params: Promise.resolve({ quoteVersionId: 'qv_1' }) },
    );

    expect(response.status).toBe(200);
    expect(updateQuoteInternalNameByVersion).toHaveBeenCalledWith({
      quoteVersionId: 'qv_1',
      internalName: 'Front deck pergola',
      actor: 'ops@example.com',
    });
  });

  it('rejects overlong names before touching the quote family', async () => {
    const response = await PATCH(
      new Request('http://localhost/api/quotes/qv_1/internal-name', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ internalName: 'x'.repeat(121) }),
      }),
      { params: Promise.resolve({ quoteVersionId: 'qv_1' }) },
    );

    expect(response.status).toBe(400);
    expect(updateQuoteInternalNameByVersion).not.toHaveBeenCalled();
  });
});
