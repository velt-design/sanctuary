import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();
const loadProjectsIndexData = vi.fn();

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi');
  return { ...actual, requireStaffContext };
});

vi.mock('@/lib/projects/serverProjectsIndex', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/projects/serverProjectsIndex')>();
  return { ...actual, loadProjectsIndexData };
});

const loaded = {
  projects: {
    rows: [{ id: 'proj_1' }],
    totalCount: 1,
    truncated: false,
    page: 1,
    pageSize: 50,
    totalPages: 1,
  },
  contacts: { rows: [{ id: 'ct_1' }], totalCount: 1, truncated: false },
};

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
    loadProjectsIndexData.mockResolvedValue(loaded);
  });

  it('defaults to every unarchived project state', async () => {
    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/staff/v1/projects/index', {
      headers: { 'x-request-id': 'req_default' },
    }));

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('x-portal-request-id')).toBe('req_default');
    expect(loadProjectsIndexData).toHaveBeenCalledWith({
      archive: 'active',
      search: '',
      status: 'all',
      journey: 'all',
      state: 'all',
      owner: 'all',
      page: 1,
      pageSize: 50,
      sort: 'newest',
    }, expect.anything(), expect.objectContaining({ route: '/api/staff/v1/projects/index' }));
    await expect(res.json()).resolves.toEqual({
      archive: 'active',
      ...loaded,
      query: {
        search: '',
        status: 'all',
        journey: 'all',
        state: 'all',
        owner: 'all',
        sort: 'newest',
      },
      generatedAt: expect.any(String),
    });
  });

  it('passes journey, detailed stage, and state to the server owner', async () => {
    const mod = await import('./route');
    const res = await mod.GET(new Request(
      'http://localhost/api/staff/v1/projects/index?journey=proposal&stage=sent&state=waiting&archive=archived&q=deck&page=2&pageSize=25&sort=name_asc',
    ));

    expect(res.status).toBe(200);
    expect(loadProjectsIndexData).toHaveBeenCalledWith({
      archive: 'active',
      search: 'deck',
      status: 'SENT',
      journey: 'PROPOSAL',
      state: 'WAITING',
      owner: 'all',
      page: 2,
      pageSize: 25,
      sort: 'name_asc',
    }, expect.anything(), expect.objectContaining({ route: '/api/staff/v1/projects/index' }));
  });

  it('routes archived state through the archived storage scope', async () => {
    const mod = await import('./route');
    const res = await mod.GET(new Request(
      'http://localhost/api/staff/v1/projects/index?state=archived',
    ));

    expect(res.status).toBe(200);
    expect(loadProjectsIndexData).toHaveBeenCalledWith(
      expect.objectContaining({ archive: 'archived', state: 'ARCHIVED' }),
      expect.anything(),
      expect.anything(),
    );
  });

  it.each([
    ['active', 'active', 'all'],
    ['archived', 'archived', 'ARCHIVED'],
    ['all', 'all', 'all'],
  ] as const)('preserves the legacy archive=%s query', async (legacyArchive, archive, state) => {
    const mod = await import('./route');
    const res = await mod.GET(new Request(
      `http://localhost/api/staff/v1/projects/index?archive=${legacyArchive}`,
    ));

    expect(res.status).toBe(200);
    expect(loadProjectsIndexData).toHaveBeenCalledWith(
      expect.objectContaining({ archive, state }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('preserves archive=all when the current client also sends state=all', async () => {
    const mod = await import('./route');
    const res = await mod.GET(new Request(
      'http://localhost/api/staff/v1/projects/index?archive=all&state=all',
    ));

    expect(res.status).toBe(200);
    expect(loadProjectsIndexData).toHaveBeenCalledWith(
      expect.objectContaining({ archive: 'all', state: 'all' }),
      expect.anything(),
      expect.anything(),
    );
  });

  it.each([
    ['archive=private', 'archive must be active, archived, or all'],
    ['journey=quoting', 'Invalid project journey'],
    ['stage=proposal', 'Invalid project stage'],
    ['state=lost', 'Invalid project state'],
    ['owner=sales', 'Invalid project owner'],
  ])('rejects invalid filters before loading data: %s', async (query, message) => {
    const mod = await import('./route');
    const res = await mod.GET(new Request(
      `http://localhost/api/staff/v1/projects/index?${query}`,
    ));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: message });
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
