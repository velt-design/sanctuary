import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();
const getProjectCommandExceptions = vi.fn();
vi.mock('@/lib/api/staffApi', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi')),
  requireStaffContext,
}));
vi.mock('@/lib/projects/commandCentre/getProjectCommandExceptions', () => ({ getProjectCommandExceptions }));

describe('GET dashboard project exceptions', () => {
  beforeEach(() => {
    requireStaffContext.mockReset().mockResolvedValue({
      ok: true, session: { user: { id: 'user-1' }, role: 'admin' }, supabase: {},
    });
    getProjectCommandExceptions.mockReset().mockResolvedValue({ counts: {}, projects: [], totalProjects: 0, generatedAt: '2026-07-20T00:00:00.000Z' });
  });

  it('uses the shared domain loader and returns no-store', async () => {
    const { GET } = await import('./route');
    const res = await GET(new Request('http://localhost/api/staff/v1/dashboard/project-exceptions'));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(getProjectCommandExceptions).toHaveBeenCalledWith({}, { userId: 'user-1', isAdmin: true });
  });
});
