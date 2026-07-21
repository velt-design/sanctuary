import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();
const getProjectCommandCentre = vi.fn();

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi');
  return { ...actual, requireStaffContext };
});

vi.mock('@/lib/projects/commandCentre/getProjectCommandCentre', () => ({ getProjectCommandCentre }));

const projectId = 'proj_11111111-1111-4111-8111-111111111111';
const context = { params: Promise.resolve({ projectId }) };
const response = {
  projectId,
  generatedAt: '2026-07-20T00:00:00.000Z',
  currentDesign: {
    source: 'none',
    statusLabel: 'No current design',
    statusTone: 'neutral',
    designState: 'none',
    design: null,
    price: { source: 'none', totalIncGstCents: null },
    estimate: null,
    quote: null,
    newerEstimate: null,
    latestDeclinedQuote: null,
    warnings: [],
    links: { designs: '?tab=estimates', quotes: '?tab=quotes', estimate: null, quote: null },
  },
};

describe('GET /api/staff/v1/projects/[projectId]/command-centre', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffContext.mockReset();
    getProjectCommandCentre.mockReset();
    requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { id: 'user-1' }, role: 'staff' },
      supabase: { from: vi.fn() },
    });
    getProjectCommandCentre.mockResolvedValue(response);
  });

  it('returns a private auth-bound command-centre response', async () => {
    const mod = await import('./route');
    const res = await mod.GET(new Request(`http://localhost/api/staff/v1/projects/${projectId}/command-centre`, {
      headers: { 'x-request-id': 'req_command' },
    }), context);

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('x-portal-request-id')).toBe('req_command');
    expect(getProjectCommandCentre).toHaveBeenCalledWith(projectId, expect.anything(), {
      userId: 'user-1',
      isAdmin: false,
    });
    await expect(res.json()).resolves.toEqual(response);
  });

  it.each([401, 403])('preserves the auth helper %s response', async (status) => {
    requireStaffContext.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status }),
    });
    const mod = await import('./route');
    const res = await mod.GET(new Request(`http://localhost/api/staff/v1/projects/${projectId}/command-centre`), context);
    expect(res.status).toBe(status);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(getProjectCommandCentre).not.toHaveBeenCalled();
  });

  it('returns 404 only when the authenticated project is absent', async () => {
    getProjectCommandCentre.mockResolvedValueOnce(null);
    const mod = await import('./route');
    const res = await mod.GET(new Request(`http://localhost/api/staff/v1/projects/${projectId}/command-centre`), context);
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('returns a stable 500 when any bounded read fails', async () => {
    getProjectCommandCentre.mockRejectedValueOnce(new Error('database unavailable'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mod = await import('./route');
    const res = await mod.GET(new Request(`http://localhost/api/staff/v1/projects/${projectId}/command-centre`), context);
    expect(res.status).toBe(500);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    await expect(res.json()).resolves.toEqual({ error: 'Failed to load project command centre' });
    errorSpy.mockRestore();
  });
});
