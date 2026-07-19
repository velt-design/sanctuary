import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSupabaseServerAuth = vi.fn();
const redirect = vi.fn((href: string) => {
  throw new Error(`redirect:${href}`);
});

vi.mock('server-only', () => ({}));

vi.mock('react', () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => {
    let value: ReturnType<T> | undefined;
    return (() => {
      value ??= fn() as ReturnType<T>;
      return value;
    }) as T;
  },
}));

vi.mock('@/lib/supabase/serverClient', () => ({
  getSupabaseServerAuth,
}));

vi.mock('next/navigation', () => ({
  redirect,
}));

describe('portal server auth', () => {
  beforeEach(() => {
    vi.resetModules();
    getSupabaseServerAuth.mockReset();
    redirect.mockClear();
  });

  it('reuses one request-local verified claim and role lookup across access helpers', async () => {
    const getClaims = vi.fn().mockResolvedValue({
      data: {
        claims: {
          sub: 'user_1',
          email: 'ops@example.com',
          user_metadata: { full_name: 'Casey Operator' },
        },
      },
      error: null,
    });
    const getUser = vi.fn();
    const maybeSingle = vi.fn().mockResolvedValue({ data: { role: 'staff' }, error: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    getSupabaseServerAuth.mockResolvedValue({ auth: { getClaims, getUser }, from });

    const auth = await import('./auth');

    await expect(auth.getPortalAccessState()).resolves.toEqual({
      kind: 'authenticated',
      session: {
        user: { id: 'user_1', email: 'ops@example.com' },
        role: 'staff',
      },
    });
    await expect(auth.getPortalSession()).resolves.toEqual({
      user: {
        id: 'user_1',
        email: 'ops@example.com',
        user_metadata: { full_name: 'Casey Operator' },
      },
      role: 'staff',
    });
    await expect(auth.requireStaffPageAccess('/dashboard')).resolves.toEqual({
      user: {
        id: 'user_1',
        email: 'ops@example.com',
        user_metadata: { full_name: 'Casey Operator' },
      },
      role: 'staff',
    });

    expect(getSupabaseServerAuth).toHaveBeenCalledTimes(1);
    expect(getClaims).toHaveBeenCalledTimes(1);
    expect(getUser).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledWith('role');
    expect(eq).toHaveBeenCalledWith('user_id', 'user_1');
    expect(maybeSingle).toHaveBeenCalledTimes(1);
    expect(redirect).not.toHaveBeenCalled();
  });

  it('rejects verified claims without a subject before looking up portal access', async () => {
    const getClaims = vi.fn().mockResolvedValue({
      data: { claims: { email: 'ops@example.com' } },
      error: null,
    });
    const from = vi.fn();
    getSupabaseServerAuth.mockResolvedValue({ auth: { getClaims }, from });

    const auth = await import('./auth');

    await expect(auth.getPortalAccessState()).resolves.toEqual({ kind: 'unauthenticated' });
    await expect(auth.getPortalSession()).resolves.toBeNull();

    expect(getClaims).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalled();
  });
});
