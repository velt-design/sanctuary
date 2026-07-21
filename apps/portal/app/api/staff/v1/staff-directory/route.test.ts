import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();
const getPortalStaffDirectory = vi.fn();
vi.mock('@/lib/api/staffApi', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi')),
  requireStaffContext,
}));
vi.mock('@/lib/projects/commandCentre/staffDirectory', () => ({ getPortalStaffDirectory }));

describe('GET staff directory', () => {
  beforeEach(() => {
    requireStaffContext.mockReset().mockResolvedValue({ ok: true, supabase: {} });
    getPortalStaffDirectory.mockReset().mockResolvedValue([{ userId: 'user-1', displayName: 'Aroha', email: null, accessRole: 'staff' }]);
  });

  it('returns only the normalized directory with no-store', async () => {
    const { GET } = await import('./route');
    const res = await GET(new Request('http://localhost/api/staff/v1/staff-directory'));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    await expect(res.json()).resolves.toEqual({ staff: [{ userId: 'user-1', displayName: 'Aroha', email: null, accessRole: 'staff' }] });
  });
});
