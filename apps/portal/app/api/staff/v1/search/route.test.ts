import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();
const searchPortal = vi.fn();

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi');
  return { ...actual, requireStaffContext };
});
vi.mock('@/lib/search/serverPortalSearch', () => ({ searchPortal }));

describe('GET /api/staff/v1/search', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffContext.mockReset();
    searchPortal.mockReset();
    requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { id: 'user-1' }, role: 'staff' },
      supabase: { from: vi.fn() },
    });
    searchPortal.mockResolvedValue({
      projects: [{ kind: 'project', id: 'proj_1', name: 'Remuera Residence' }],
      contacts: [{ kind: 'contact', id: 'ct_1', name: 'Alex Mason' }],
    });
  });

  it('searches through the auth-bound client and disables private caching', async () => {
    const mod = await import('./route');
    const response = await mod.GET(new Request('http://localhost/api/staff/v1/search?q=remuera', {
      headers: { 'x-request-id': 'req_search' },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-portal-request-id')).toBe('req_search');
    expect(searchPortal).toHaveBeenCalledWith(expect.anything(), 'remuera');
    await expect(response.json()).resolves.toEqual({
      query: 'remuera',
      projects: [{ kind: 'project', id: 'proj_1', name: 'Remuera Residence' }],
      contacts: [{ kind: 'contact', id: 'ct_1', name: 'Alex Mason' }],
      generatedAt: expect.any(String),
    });
  });

  it.each(['', 'a'])('rejects a query shorter than two characters: %s', async (query) => {
    const mod = await import('./route');
    const response = await mod.GET(new Request(`http://localhost/api/staff/v1/search?q=${query}`));
    expect(response.status).toBe(400);
    expect(searchPortal).not.toHaveBeenCalled();
  });

  it('rejects queries longer than the public contract limit', async () => {
    const mod = await import('./route');
    const response = await mod.GET(new Request(`http://localhost/api/staff/v1/search?q=${'a'.repeat(81)}`));
    expect(response.status).toBe(400);
    expect(searchPortal).not.toHaveBeenCalled();
  });

  it.each([401, 403])('preserves the auth helper %s response', async (status) => {
    requireStaffContext.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status }),
    });
    const mod = await import('./route');
    const response = await mod.GET(new Request('http://localhost/api/staff/v1/search?q=deck'));
    expect(response.status).toBe(status);
    expect(searchPortal).not.toHaveBeenCalled();
  });

  it('returns a stable server error without exposing provider details', async () => {
    searchPortal.mockRejectedValueOnce(new Error('database unavailable'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mod = await import('./route');
    const response = await mod.GET(new Request('http://localhost/api/staff/v1/search?q=deck'));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Failed to search the portal' });
    errorSpy.mockRestore();
  });
});

