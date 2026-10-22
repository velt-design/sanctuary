import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSupabaseServerAuth = vi.fn();
const redirect = vi.fn((href: string) => {
  throw new Error(`redirect:${href}`);
});

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));

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

  it('reuses one request-local user and role lookup across access helpers', async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: 'user_1',
          email: 'ops@example.com',
          user_metadata: { full_name: 'Casey Operator' },
        },
      },
      error: null,
    });
    const maybeSingle = vi.fn().mockResolvedValue({ data: { role: 'staff' }, error: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    getSupabaseServerAuth.mockResolvedValue({ auth: { getUser }, from });

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
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledWith('role');
    expect(eq).toHaveBeenCalledWith('user_id', 'user_1');
    expect(maybeSingle).toHaveBeenCalledTimes(1);
    expect(redirect).not.toHaveBeenCalled();
  });
});

it('revalidates long-running finance reads outside the render cache with the same role resolver',async()=>{
 vi.resetModules();getSupabaseServerAuth.mockReset();
 const getUser=vi.fn().mockResolvedValue({data:{user:{id:'fresh',email:'ops@example.test'}},error:null});
 const maybeSingle=vi.fn().mockResolvedValue({data:{role:'staff'},error:null});
 getSupabaseServerAuth.mockResolvedValue({auth:{getUser},from:()=>({select:()=>({eq:()=>({maybeSingle})})})});
 const auth=await import('./auth');
 expect((await auth.getPortalSession())?.role).toBe('staff');
 maybeSingle.mockResolvedValue({data:null,error:null});
 expect(await auth.getFreshPortalSession()).toBeNull();
 expect((await auth.getPortalSession())?.role).toBe('staff');
 expect(getUser).toHaveBeenCalledTimes(2);
});
