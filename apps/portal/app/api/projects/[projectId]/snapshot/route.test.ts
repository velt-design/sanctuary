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

describe('GET /api/projects/[projectId]/snapshot diagnostics', () => {
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
  });
});
