import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();
const loadProjectsIndexData = vi.fn();

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi');
  return { ...actual, requireStaffContext };
});

vi.mock('@/lib/projects/serverProjectsIndex', () => ({ loadProjectsIndexData }));

describe('GET /api/staff/v1/projects/index', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffContext.mockReset();
    loadProjectsIndexData.mockReset();
    requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { id: 'user-1' }, role: 'staff' },
      supabase: { from: vi.fn() },
    });
    loadProjectsIndexData.mockResolvedValue({
      projects: { rows: [{ id: 'proj_1' }], totalCount: 1, truncated: false },
      contacts: { rows: [{ id: 'ct_1' }], totalCount: 1, truncated: false },
    });
  });

  it.each(['active', 'archived', 'all'] as const)('loads the %s scope through the auth-bound client', async (archive) => {
    const mod = await import('./route');
    const res = await mod.GET(new Request(`http://localhost/api/staff/v1/projects/index?archive=${archive}`, {
      headers: { 'x-request-id': `req_${archive}` },
    }));

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('x-portal-request-id')).toBe(`req_${archive}`);
    expect(loadProjectsIndexData).toHaveBeenCalledWith(expect.anything(), { archiveFilter: archive });
    await expect(res.json()).resolves.toEqual({
      archive,
      projects: { rows: [{ id: 'proj_1' }], totalCount: 1, truncated: false },
      contacts: { rows: [{ id: 'ct_1' }], totalCount: 1, truncated: false },
      generatedAt: expect.any(String),
    });
  });

  it('defaults a missing archive scope to active', async () => {
    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/staff/v1/projects/index'));
    expect(res.status).toBe(200);
    expect(loadProjectsIndexData).toHaveBeenCalledWith(expect.anything(), { archiveFilter: 'active' });
  });

  it('rejects invalid scopes before loading data', async () => {
    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/staff/v1/projects/index?archive=private'));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'archive must be active, archived, or all' });
    expect(loadProjectsIndexData).not.toHaveBeenCalled();
  });

  it.each([401, 403])('preserves the auth helper %s response', async (status) => {
    requireStaffContext.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status }),
    });
    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/staff/v1/projects/index'));
    expect(res.status).toBe(status);
    expect(loadProjectsIndexData).not.toHaveBeenCalled();
  });

  it('returns a stable diagnostics-backed server error', async () => {
    loadProjectsIndexData.mockRejectedValueOnce(new Error('database unavailable'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/staff/v1/projects/index', {
      headers: { 'x-request-id': 'req_failed' },
    }));

    expect(res.status).toBe(500);
    expect(res.headers.get('x-portal-request-id')).toBe('req_failed');
    await expect(res.json()).resolves.toEqual({ error: 'Failed to load projects' });
    errorSpy.mockRestore();
  });
});
