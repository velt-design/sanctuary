import { beforeEach, describe, expect, it, vi } from 'vitest';

const searchPortalForRequest = vi.fn();

vi.mock('@/lib/search/serverPortalSearch', async () => {
  const actual = await vi.importActual<typeof import('@/lib/search/serverPortalSearch')>(
    '@/lib/search/serverPortalSearch'
  );
  return { ...actual, searchPortalForRequest };
});

describe('GET /api/staff/v1/search', () => {
  beforeEach(() => {
    vi.resetModules();
    searchPortalForRequest.mockReset();
    searchPortalForRequest.mockResolvedValue({
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
    expect(searchPortalForRequest).toHaveBeenCalledWith('remuera');
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
    expect(searchPortalForRequest).not.toHaveBeenCalled();
  });

  it('rejects queries longer than the public contract limit', async () => {
    const mod = await import('./route');
    const response = await mod.GET(new Request(`http://localhost/api/staff/v1/search?q=${'a'.repeat(81)}`));
    expect(response.status).toBe(400);
    expect(searchPortalForRequest).not.toHaveBeenCalled();
  });

  it.each([401, 403] as const)('preserves the database-verified %s access response', async (status) => {
    const { PortalSearchAccessError } = await import('@/lib/search/serverPortalSearch');
    searchPortalForRequest.mockRejectedValueOnce(new PortalSearchAccessError(status));
    const mod = await import('./route');
    const response = await mod.GET(new Request('http://localhost/api/staff/v1/search?q=deck'));
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({
      error: status === 401 ? 'Unauthorized' : 'Forbidden',
    });
  });

  it('returns a stable server error without exposing provider details', async () => {
    searchPortalForRequest.mockRejectedValueOnce(new Error('database unavailable'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mod = await import('./route');
    const response = await mod.GET(new Request('http://localhost/api/staff/v1/search?q=deck'));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Failed to search the portal' });
    errorSpy.mockRestore();
  });
});
