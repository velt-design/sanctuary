import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, maybeSingleMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  maybeSingleMock: vi.fn(),
}));

vi.mock('@/lib/supabase/browserClient', () => ({
  getSupabaseBrowser: () => ({ from: fromMock }),
}));

import { fetchPortalRole } from './auth';

describe('fetchPortalRole', () => {
  beforeEach(() => {
    maybeSingleMock.mockReset();
    fromMock.mockReset().mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: maybeSingleMock })),
      })),
    });
  });

  it.each(['admin', 'staff'] as const)('accepts the known %s role', async (role) => {
    maybeSingleMock.mockResolvedValue({ data: { role }, error: null });

    await expect(fetchPortalRole('user-1')).resolves.toBe(role);
    expect(fromMock).toHaveBeenCalledWith('portal_users');
  });

  it('does not promote an unknown role to staff access', async () => {
    maybeSingleMock.mockResolvedValue({ data: { role: 'contractor' }, error: null });

    await expect(fetchPortalRole('user-1')).resolves.toBeNull();
  });

  it('propagates lookup errors', async () => {
    const error = new Error('lookup unavailable');
    maybeSingleMock.mockResolvedValue({ data: null, error });

    await expect(fetchPortalRole('user-1')).rejects.toBe(error);
  });
});
