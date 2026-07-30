import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdminContext: vi.fn(),
  getLegacyContactedReview: vi.fn(),
}));

vi.mock('@/lib/api/adminApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/adminApi')>(
    '@/lib/api/adminApi',
  );
  return { ...actual, requireAdminContext: mocks.requireAdminContext };
});

vi.mock('@/lib/projects/workItems/legacyTriage/repository', () => ({
  getLegacyContactedReview: mocks.getLegacyContactedReview,
}));

import { GET } from './route';

const SUPABASE = { rpc: vi.fn() };

describe('GET /api/admin/project-work/legacy-contacted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminContext.mockResolvedValue({
      ok: true,
      supabase: SUPABASE,
      session: { role: 'admin', user: { id: 'admin-1' } },
    });
    mocks.getLegacyContactedReview.mockResolvedValue({
      projects: [],
      summary: {
        total: 0,
        due: 0,
        archived: 0,
        byRecommendation: {
          ACTIVE_EVIDENCE: 0,
          WAITING_CANDIDATE: 0,
          LOST_NO_RESPONSE_CANDIDATE: 0,
          MANUAL_CLASSIFICATION: 0,
        },
      },
      generatedAt: '2026-07-29T00:00:00.000Z',
      nextCursor: null,
    });
  });

  it('stops before classification when admin access fails', async () => {
    mocks.requireAdminContext.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: 'Forbidden' }, { status: 403 }),
    });

    const response = await GET(new Request(
      'http://localhost/api/admin/project-work/legacy-contacted',
    ));

    expect(response.status).toBe(403);
    expect(mocks.getLegacyContactedReview).not.toHaveBeenCalled();
  });

  it('returns the read-only classifier contract with no contact query input', async () => {
    const response = await GET(new Request(
      'http://localhost/api/admin/project-work/legacy-contacted?scope=due&limit=25',
    ));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.getLegacyContactedReview).toHaveBeenCalledWith(SUPABASE, {
      asOf: null,
      limit: 25,
      cursor: null,
      scope: 'due',
    });
    expect(JSON.stringify(await response.json())).not.toMatch(
      /customerEmail|customerPhone|contactEmail|contactPhone/,
    );
  });

  it('rejects an invalid scope before calling the classifier', async () => {
    const response = await GET(new Request(
      'http://localhost/api/admin/project-work/legacy-contacted?scope=archive',
    ));

    expect(response.status).toBe(400);
    expect(mocks.getLegacyContactedReview).not.toHaveBeenCalled();
  });
});
