import { describe, expect, it, vi } from 'vitest';
const access = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth', () => ({ requireAdminPageAccess: access }));
vi.mock('./PortalActionsClient', () => ({ default: () => null }));
import Page from './page';

describe('Portal action administration page', () => {
  it('requires administrator page access using its exact return path', async () => {
    access.mockResolvedValueOnce({ user: { id: 'synthetic-admin' } });
    expect(await Page()).toBeTruthy();
    expect(access).toHaveBeenLastCalledWith('/admin/portal-actions');
  });
  it('propagates the existing auth redirect before rendering controls', async () => {
    const redirect = new Error('auth redirect');
    access.mockRejectedValueOnce(redirect);
    await expect(Page()).rejects.toBe(redirect);
  });
});
