import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffSession = vi.fn();
const getProjectPageSnapshot = vi.fn();

vi.mock('@/lib/api/staffApi', () => ({
  jsonError: (error: string, status: number) => new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } }),
  requireStaffSession,
}));

vi.mock('@/lib/projects/getProjectPageSnapshot', () => ({
  getProjectPageSnapshot,
}));

describe('GET /api/projects/[projectId]/snapshot', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffSession.mockReset();
    getProjectPageSnapshot.mockReset();
    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'staff' });
  });

  it('returns 401 when no staff session exists', async () => {
    requireStaffSession.mockResolvedValue(null);

    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/projects/proj_1/snapshot'), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 when projectId is blank', async () => {
    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/projects//snapshot'), {
      params: Promise.resolve({ projectId: '   ' }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Invalid projectId' });
  });

  it('returns 404 when the project snapshot is missing', async () => {
    getProjectPageSnapshot.mockResolvedValue(null);

    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/projects/proj_1/snapshot'), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(getProjectPageSnapshot).toHaveBeenCalledWith('proj_1');
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Project not found' });
  });

  it('returns 500 when snapshot loading throws', async () => {
    getProjectPageSnapshot.mockRejectedValue(new Error('Snapshot exploded'));

    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/projects/proj_1/snapshot'), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Snapshot exploded' });
  });

  it('returns the snapshot payload and a server-timing header on success', async () => {
    const snapshot = { project: { id: 'proj_1', name: 'Test Project' } };
    getProjectPageSnapshot.mockResolvedValue(snapshot);

    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/projects/proj_1/snapshot'), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      snapshot,
      generatedAt: expect.any(String),
    });
    expect(res.headers.get('server-timing')).toContain('total;dur=');
  });
});
