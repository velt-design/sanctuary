import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();
const getProjectPageSummary = vi.fn();

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi');
  return { ...actual, requireStaffContext };
});

vi.mock('@/lib/projects/getProjectPageSnapshot', () => ({ getProjectPageSummary }));

const projectId = 'proj_11111111-1111-4111-8111-111111111111';
const context = { params: Promise.resolve({ projectId }) };
const summary = {
  project: { id: projectId, name: 'Alpha Project', stage: 'new' },
  pipeline: { stage: 'new' },
  activity: [],
  emails: [],
  notes: [],
};

describe('GET /api/staff/v1/projects/[projectId]/summary', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffContext.mockReset();
    getProjectPageSummary.mockReset();
    requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { id: 'user-1' }, role: 'staff' },
      supabase: { from: vi.fn() },
    });
    getProjectPageSummary.mockResolvedValue(summary);
  });

  it('returns a private authenticated project summary', async () => {
    const mod = await import('./route');
    const res = await mod.GET(new Request(`http://localhost/api/staff/v1/projects/${projectId}/summary`, {
      headers: { 'x-request-id': 'req_summary' },
    }), context);

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('x-portal-request-id')).toBe('req_summary');
    expect(getProjectPageSummary).toHaveBeenCalledWith(projectId, expect.anything(), expect.anything());
    await expect(res.json()).resolves.toEqual({ snapshot: summary, generatedAt: expect.any(String) });
  });

  it.each([401, 403])('preserves the auth helper %s response', async (status) => {
    requireStaffContext.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status }),
    });
    const mod = await import('./route');
    const res = await mod.GET(new Request(`http://localhost/api/staff/v1/projects/${projectId}/summary`), context);

    expect(res.status).toBe(status);
    expect(getProjectPageSummary).not.toHaveBeenCalled();
  });

  it('returns 404 only when the authenticated project is absent', async () => {
    getProjectPageSummary.mockResolvedValueOnce(null);
    const mod = await import('./route');
    const res = await mod.GET(new Request(`http://localhost/api/staff/v1/projects/${projectId}/summary`), context);

    expect(res.status).toBe(404);
  });

  it('returns a stable 500 when the summary read fails', async () => {
    getProjectPageSummary.mockRejectedValueOnce(new Error('database unavailable'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mod = await import('./route');
    const res = await mod.GET(new Request(`http://localhost/api/staff/v1/projects/${projectId}/summary`), context);

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Failed to load project summary' });
    errorSpy.mockRestore();
  });
});
