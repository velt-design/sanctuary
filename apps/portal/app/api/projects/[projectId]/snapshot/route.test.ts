import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();
const getProjectPageSnapshot = vi.fn();
const supabase = { from: vi.fn() };

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi');
  return {
    ...actual,
    requireStaffContext,
  };
});

vi.mock('@/lib/projects/getProjectPageSnapshot', () => ({
  getProjectPageSnapshot,
}));

describe('GET /api/projects/[projectId]/snapshot diagnostics and cache policy', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffContext.mockReset();
    getProjectPageSnapshot.mockReset();
    supabase.from.mockReset();
    requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { id: 'user_1', email: 'ops@example.com' }, role: 'staff' },
      supabase,
    });
  });

  it('returns request-id and server-timing headers on success', async () => {
    const snapshot = { project: { id: 'proj_1' } };
    getProjectPageSnapshot.mockResolvedValue(snapshot);

    const mod = await import('./route');
    const res = await mod.GET(
      new Request('http://localhost/api/projects/proj_1/snapshot', {
        headers: { 'x-request-id': 'req_snapshot_ok' },
      }),
      { params: Promise.resolve({ projectId: 'proj_1' }) },
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      snapshot,
      generatedAt: expect.any(String),
    });
    expect(res.headers.get('x-portal-request-id')).toBe('req_snapshot_ok');
    expect(res.headers.get('server-timing')).toContain('total;dur=');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(getProjectPageSnapshot).toHaveBeenCalledWith(
      'proj_1',
      expect.objectContaining({
        route: '/api/projects/[projectId]/snapshot',
        method: 'GET',
        requestId: 'req_snapshot_ok',
      }),
      supabase,
      'user_1',
    );
  });

  it('returns request-id and server-timing headers on failure', async () => {
    getProjectPageSnapshot.mockRejectedValue(new Error('Snapshot exploded'));

    const mod = await import('./route');
    const res = await mod.GET(
      new Request('http://localhost/api/projects/proj_1/snapshot', {
        headers: { 'x-request-id': 'req_snapshot_err' },
      }),
      { params: Promise.resolve({ projectId: 'proj_1' }) },
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Snapshot exploded' });
    expect(res.headers.get('x-portal-request-id')).toBe('req_snapshot_err');
    expect(res.headers.get('server-timing')).toContain('total;dur=');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('keeps authentication failures private and non-cacheable', async () => {
    requireStaffContext.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });

    const mod = await import('./route');
    const res = await mod.GET(
      new Request('http://localhost/api/projects/proj_1/snapshot'),
      { params: Promise.resolve({ projectId: 'proj_1' }) },
    );

    expect(res.status).toBe(401);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(getProjectPageSnapshot).not.toHaveBeenCalled();
  });

  it('keeps invalid and missing-project responses private and non-cacheable', async () => {
    const mod = await import('./route');
    const invalid = await mod.GET(
      new Request('http://localhost/api/projects/blank/snapshot'),
      { params: Promise.resolve({ projectId: '  ' }) },
    );

    expect(invalid.status).toBe(400);
    expect(invalid.headers.get('cache-control')).toBe('private, no-store');
    expect(getProjectPageSnapshot).not.toHaveBeenCalled();

    getProjectPageSnapshot.mockResolvedValue(null);
    const missing = await mod.GET(
      new Request('http://localhost/api/projects/missing/snapshot'),
      { params: Promise.resolve({ projectId: 'missing' }) },
    );

    expect(missing.status).toBe(404);
    expect(missing.headers.get('cache-control')).toBe('private, no-store');
  });
});
