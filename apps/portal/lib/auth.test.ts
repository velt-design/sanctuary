import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getSupabaseServerAuth = vi.fn();
const context = vi.hoisted(() => ({ headers: new Headers() }));
const redirect = vi.fn((href: string) => {
  throw new Error(`redirect:${href}`);
});

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => context.headers }));

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
    context.headers = new Headers();
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
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it('observes the existing identity call only under a real signed Marketing scope, retaining cache and fresh denial', async () => {
  vi.resetModules();
  vi.stubEnv('PORTAL_DOCUMENT_DIAGNOSTICS', JSON.stringify({ until: new Date(Date.now() + 60_000).toISOString(), nonce: 'A'.repeat(43) }));
  const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const { prepareProxyDocumentDiagnostics } = await import('./performance/documentDiagnostics');
  const prepared = prepareProxyDocumentDiagnostics(new Request('https://portal.example/staff/marketing-performance', { headers: { accept: 'text/html', 'sec-fetch-dest': 'document' } }));
  context.headers = prepared.requestHeaders!;
  const user = { id: 'fixture-user', email: 'private@example.invalid' };
  const getUser = vi.fn().mockResolvedValue({ data: { user }, error: null });
  const maybeSingle = vi.fn().mockResolvedValue({ data: { role: 'staff' }, error: null });
  getSupabaseServerAuth.mockResolvedValue({ auth: { getUser }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) });
  const auth = await import('./auth');
  expect((await auth.getPortalSession())?.user).toBe(user);
  expect((await auth.getPortalSession())?.user).toBe(user); expect(getUser).toHaveBeenCalledTimes(1);
  expect(log.mock.calls.map(call => call[1])).toContainEqual(expect.objectContaining({ event: 'portal.document.transport', requestId: prepared.diagnostics!.id, operation: 'rsc.identity', outcome: 'not_observed' }));
  maybeSingle.mockResolvedValue({ data: null, error: null }); expect(await auth.getFreshPortalSession()).toBeNull();
  expect(getUser).toHaveBeenCalledTimes(2); expect(JSON.stringify(log.mock.calls)).not.toMatch(/fixture-user|private@example/);
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
