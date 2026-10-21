// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
import { DOCUMENT_CALLBACK_HEADER } from './regionalDocumentAccess';

const h = vi.hoisted(() => ({ user: vi.fn(), role: vi.fn(), headers: new Headers() }));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => h.headers }));
vi.mock('next/navigation', () => ({ redirect: (href: string) => { throw new Error(`redirect:${href}`); } }));
vi.mock('./supabase/serverClient', () => ({ getSupabaseServerAuth: async () => ({ auth: { getUser: h.user }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: h.role }) }) }) }) }));
vi.mock('react', () => ({ cache: (fn: () => unknown) => { let pending: unknown; return () => pending ??= fn(); } }));
beforeEach(() => {
  vi.resetModules(); h.user.mockReset(); h.role.mockReset();
  h.headers = new Headers({ [DOCUMENT_CALLBACK_HEADER]: '/staff/projects?q=one&q=two&sort=recent' });
  h.user.mockResolvedValue({ data: { user: { id: 'synthetic-user', email: 'private@example.invalid' } }, error: null });
  h.role.mockResolvedValue({ data: { role: 'staff' }, error: null });
});

it('root, layout and page share a pending fresh verification, without releasing before role resolution', async () => {
  let release!: (value: unknown) => void;
  h.role.mockReturnValue(new Promise(resolve => { release = resolve; }));
  const auth = await import('./auth'); let completed = 0;
  const calls = [auth.requireRegionalDocumentAccess(), auth.requireStaffPageAccess('/staff'), auth.getPortalAccessState()];
  calls.forEach(call => { void call.then(() => { completed++; }); });
  await vi.waitFor(() => expect(h.role).toHaveBeenCalledOnce());
  expect(completed).toBe(0); expect(h.user).toHaveBeenCalledOnce();
  release({ data: { role: 'staff' }, error: null });
  await Promise.all(calls); expect(completed).toBe(3);
});

it.each(['missing', 'disabled', 'revoked', 'unrecognized', 'lookup_failed'] as const)('denies %s before the selected document root can render', async state => {
  if (state === 'missing' || state === 'disabled') h.user.mockResolvedValue({ data: { user: null }, error: state === 'disabled' ? { message: 'disabled' } : null });
  if (state === 'revoked') h.role.mockResolvedValue({ data: null, error: null });
  if (state === 'unrecognized') h.role.mockResolvedValue({ data: { role: 'viewer' }, error: null });
  if (state === 'lookup_failed') h.role.mockResolvedValue({ data: null, error: { message: 'private failure' } });
  const auth = await import('./auth');
  const target = state === 'missing' || state === 'disabled' ? '/login?' : '/access-status?';
  await expect(auth.requireRegionalDocumentAccess()).rejects.toThrow(`redirect:${target}`);
  await expect(auth.requireStaffPageAccess('/staff')).rejects.toThrow('callbackUrl=%2Fstaff%2Fprojects%3Fq%3Done%26q%3Dtwo%26sort%3Drecent');
  expect(h.user).toHaveBeenCalledOnce();
});

it.each(['https://outside.invalid', '//outside.invalid', '/admin', '/staff/projects/new', '/staff/projects#fragment'])('does not use unsafe/out-of-scope context %s', async value => {
  h.headers.set(DOCUMENT_CALLBACK_HEADER, value);
  h.user.mockResolvedValue({ data: { user: null }, error: null });
  const auth = await import('./auth');
  await auth.requireRegionalDocumentAccess(); expect(h.user).not.toHaveBeenCalled();
  await expect(auth.requireStaffPageAccess('/staff')).rejects.toThrow('redirect:/login?callbackUrl=%2Fstaff');
});

it('never trusts a transport header to pass admin authorization', async () => {
  const auth = await import('./auth');
  await expect(auth.requireAdminPageAccess('/admin')).rejects.toThrow('redirect:/staff/calculator');
});
it.each(['missing','revoked','lookup_failed'] as const)('verifies Marketing document authority freshly and rejects %s',async state=>{
 h.headers.set(DOCUMENT_CALLBACK_HEADER,'/staff/marketing-performance?view=financials&financeSection=bank');
 if(state==='missing')h.user.mockResolvedValue({data:{user:null},error:null});
 if(state==='revoked')h.role.mockResolvedValue({data:null,error:null});
 if(state==='lookup_failed')h.role.mockResolvedValue({data:null,error:{message:'private failure'}});
 const auth=await import('./auth');
 await expect(auth.requireRegionalDocumentAccess()).rejects.toThrow('redirect:');
 await expect(auth.requireStaffPageAccess('/staff/marketing-performance')).rejects.toThrow('callbackUrl=%2Fstaff%2Fmarketing-performance%3Fview%3Dfinancials%26financeSection%3Dbank');
 expect(h.user).toHaveBeenCalledOnce();
});
