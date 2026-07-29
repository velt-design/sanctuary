import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();
const loadContactsIndexData = vi.fn();

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi');
  return { ...actual, requireStaffContext };
});
vi.mock('@/lib/contacts/serverContactsIndex', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/contacts/serverContactsIndex')>();
  return { ...actual, loadContactsIndexData };
});

describe('GET /api/staff/v1/contacts/index', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffContext.mockReset();
    loadContactsIndexData.mockReset();
    requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { id: 'user-1' }, role: 'staff' },
      supabase: { from: vi.fn() },
    });
    loadContactsIndexData.mockResolvedValue({
      rows: [{ id: 'ct_1' }],
      totalCount: 1,
      truncated: false,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    });
  });

  it('loads a server-filtered page through the auth-bound client with diagnostics', async () => {
    const mod = await import('./route');
    const response = await mod.GET(new Request('http://localhost/api/staff/v1/contacts/index', {
      headers: { 'x-request-id': 'req_contacts' },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-portal-request-id')).toBe('req_contacts');
    expect(loadContactsIndexData).toHaveBeenCalledWith(
      { search: '', page: 1, pageSize: 50, sort: 'name_asc' },
      expect.anything(),
    );
    await expect(response.json()).resolves.toEqual({
      contacts: {
        rows: [{ id: 'ct_1' }],
        totalCount: 1,
        truncated: false,
        page: 1,
        pageSize: 50,
        totalPages: 1,
      },
      query: { search: '', sort: 'name_asc' },
      generatedAt: expect.any(String),
    });
  });

  it.each([401, 403])('preserves the auth helper %s response', async (status) => {
    requireStaffContext.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status }),
    });
    const mod = await import('./route');
    const response = await mod.GET(new Request('http://localhost/api/staff/v1/contacts/index'));
    expect(response.status).toBe(status);
    expect(loadContactsIndexData).not.toHaveBeenCalled();
  });

  it('returns a stable diagnostics-backed server error', async () => {
    loadContactsIndexData.mockRejectedValueOnce(new Error('database unavailable'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mod = await import('./route');
    const response = await mod.GET(new Request('http://localhost/api/staff/v1/contacts/index', {
      headers: { 'x-request-id': 'req_failed' },
    }));
    expect(response.status).toBe(500);
    expect(response.headers.get('x-portal-request-id')).toBe('req_failed');
    await expect(response.json()).resolves.toEqual({ error: 'Failed to load contacts' });
    errorSpy.mockRestore();
  });
});
