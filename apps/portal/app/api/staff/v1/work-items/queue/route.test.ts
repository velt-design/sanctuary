import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffContext: vi.fn(),
  getProjectWorkQueue: vi.fn(),
}));

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>(
    '@/lib/api/staffApi',
  );
  return { ...actual, requireStaffContext: mocks.requireStaffContext };
});

vi.mock('@/lib/projects/workItems/repository', () => ({
  getProjectWorkQueue: mocks.getProjectWorkQueue,
}));

import { GET } from './route';

const SUPABASE = { from: vi.fn(), rpc: vi.fn() };
const QUEUE = {
  entries: [{
    projectId: '11111111-1111-4111-8111-111111111111',
    projectName: 'Internal fixture',
    group: 'today',
    title: 'Send first enquiry email',
    dueAt: '2026-08-03T05:00:00.000Z',
    priority: 'NORMAL',
    blockedReason: null,
    href: '/staff/projects/proj_11111111-1111-4111-8111-111111111111?tab=activity',
  }],
  generatedAt: '2026-08-03T00:00:00.000Z',
};

function request() {
  return new Request('http://localhost/api/staff/v1/work-items/queue', {
    headers: { 'x-request-id': 'req-team-queue' },
  });
}

describe('GET /api/staff/v1/work-items/queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { id: 'user-1' }, role: 'staff' },
      supabase: SUPABASE,
    });
    mocks.getProjectWorkQueue.mockResolvedValue(QUEUE);
  });

  it('is private and auth-bound', async () => {
    mocks.requireStaffContext.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.getProjectWorkQueue).not.toHaveBeenCalled();
  });

  it('returns the server-owned team queue', async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-portal-request-id')).toBe('req-team-queue');
    await expect(response.json()).resolves.toEqual(QUEUE);
    expect(mocks.getProjectWorkQueue).toHaveBeenCalledWith(SUPABASE);
  });

  it('maps an unavailable queue RPC to 503', async () => {
    mocks.getProjectWorkQueue.mockRejectedValueOnce(
      Object.assign(new Error('function is not in the schema cache'), {
        code: 'PGRST202',
      }),
    );

    const response = await GET(request());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: 'WORK_ITEMS_UNAVAILABLE',
    });
  });
});
