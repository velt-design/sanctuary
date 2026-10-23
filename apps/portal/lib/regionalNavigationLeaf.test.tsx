// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NAVIGATION_CALLBACK_HEADER, REGIONAL_NAVIGATION_PATHS } from './regionalDocumentAccess';
const h = vi.hoisted(() => ({ user: vi.fn(), role: vi.fn(), seed: vi.fn(), initial: vi.fn(), contactsBoundary: vi.fn(), headers: new Headers() }));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => h.headers }));
vi.mock('next/navigation', () => ({ redirect: (href: string) => { throw new Error(`redirect:${href}`); } }));
vi.mock('./performance/documentRenderDiagnostics', () => ({ getDocumentRenderDiagnostics: async () => null }));
vi.mock('./supabase/serverClient', () => ({ getSupabaseServerAuth: async () => ({ auth: { getUser: h.user }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: h.role }) }) }) }) }));
vi.mock('react', async () => ({ ...await vi.importActual<typeof import('react')>('react'), cache: (fn: () => unknown) => { let pending: unknown; return () => pending ??= fn(); } }));
vi.mock('@/app/dashboard/DashboardClient', () => ({ default: () => <div>Actual client boundary</div> }));
// The leaf delivers this guarded lazy boundary after the fresh role read.
// Static rendering tests its adoption, not unresolved lazy/private client code.
vi.mock('@/app/staff/contacts/GuardedContactsIndexClient', () => ({ default: (props: {initialQuery?:string}) => { h.contactsBoundary(props); return <div>Actual client boundary</div>; } }));
vi.mock('@/app/staff/projects/ProjectsIndexClient', () => ({ default: () => <div>Actual client boundary</div> }));
vi.mock('@/app/staff/schedule/ScheduleClient', () => ({ default: () => <div>Actual client boundary</div> }));
vi.mock('@/app/staff/schedule/SiteVisitsScheduleClient', () => ({ default: () => <div>Actual client boundary</div> }));
vi.mock('@/app/staff/projects/design-packages/DesignPackagesClient', () => ({ default: () => <div>Actual client boundary</div> }));
vi.mock('@/app/staff/projects/running-jobs/RunningJobsClient', () => ({ default: () => <div>Actual client boundary</div> }));
vi.mock('@/app/staff/projects/work-queue/WorkQueueClient', () => ({ default: ({ canReviewInactiveEnquiries }: { canReviewInactiveEnquiries: boolean }) => <div data-admin-review={String(canReviewInactiveEnquiries)}>Actual client boundary</div> }));
vi.mock('@/app/staff/projects/loadProjectsIndexInitialRead', () => ({ loadProjectsIndexInitialRead: h.initial }));
vi.mock('@/lib/scheduling/serverSchedulePageSeed', () => ({ loadSchedulePageSeed: h.seed }));
const loaders = [() => import('../app/dashboard/page'), () => import('../app/staff/projects/page'), () => import('../app/staff/contacts/page'),
  () => import('../app/staff/schedule/page'), () => import('../app/staff/projects/design-packages/page'), () => import('../app/staff/projects/running-jobs/page'),
  () => import('../app/staff/projects/work-queue/page')];
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); h.seed.mockResolvedValue(null); h.user.mockResolvedValue({ data: { user: { id: 'synthetic-user', email: 'private@example.invalid' } }, error: null }); h.role.mockResolvedValue({ data: { role: 'staff' }, error: null }); });
const states = ['staff', 'admin', 'anonymous', 'disabled', 'revoked', 'unrecognized', 'lookup_failed'] as const;
it.each(REGIONAL_NAVIGATION_PATHS.flatMap((path, index) => states.map(state => ({ path, index, state }))))('gates selected leaf $path ($state) without relying on a matched ancestor', async ({ path, index, state }) => {
  // A partial Flight walk can skip matched root/layout segments. Invoke the real
  // selected leaf directly with that retained tree and the middleware-owned context.
  const retained = path.split('/').filter(Boolean).reduceRight<any>((children, segment) => [segment, { children }], ['__PAGE__', {}]);
  h.headers = new Headers({ rsc: '1', [NAVIGATION_CALLBACK_HEADER]: path + '?q=one&q=two',
    'next-router-state-tree': JSON.stringify(['', { children: retained }]) });
  if (state === 'anonymous' || state === 'disabled') h.user.mockResolvedValue({ data: { user: null }, error: state === 'disabled' ? { message: 'disabled' } : null });
  if (state === 'revoked') h.role.mockResolvedValue({ data: null, error: null });
  if (state === 'unrecognized') h.role.mockResolvedValue({ data: { role: 'viewer' }, error: null });
  if (state === 'lookup_failed') h.role.mockResolvedValue({ data: null, error: { message: 'private lookup error' } });
  if (state === 'admin') h.role.mockResolvedValue({ data: { role: 'admin' }, error: null });
  const { default: Page } = await loaders[index]();
  const page = Page as (props: { searchParams: Promise<Record<string, string>> }) => Promise<any>;
  if (state !== 'staff' && state !== 'admin') {
    await expect(page({ searchParams: Promise.resolve({ q: 'one' }) })).rejects.toThrow(state === 'anonymous' || state === 'disabled' ? 'redirect:/login?' : 'redirect:/access-status?');
    expect(h.seed).not.toHaveBeenCalled(); expect(h.initial).not.toHaveBeenCalled(); expect(h.contactsBoundary).not.toHaveBeenCalled();
  } else {
    let release!: (value: unknown) => void;
    h.role.mockReturnValue(new Promise(resolve => { release = resolve; }));
    let finished = false; const pending = page({ searchParams: Promise.resolve({ q: 'one' }) }).then(value => { finished = true; return value; });
    await vi.waitFor(() => expect(h.role).toHaveBeenCalledOnce());
    expect(finished).toBe(false); expect(h.seed).not.toHaveBeenCalled(); expect(h.initial).not.toHaveBeenCalled(); expect(h.contactsBoundary).not.toHaveBeenCalled();
    release({ data: { role: state }, error: null });
    const markup = renderToStaticMarkup(await pending);
    expect(markup).toContain('Actual client boundary');
    if(path==='/staff/contacts')expect(h.contactsBoundary).toHaveBeenCalledExactlyOnceWith({initialQuery:'one'});
    if (path === '/staff/projects/work-queue') expect(markup).toContain(`data-admin-review="${state === 'admin'}"`);
    expect(h.initial).not.toHaveBeenCalled(); // Navigation context cannot select a document seed.
    expect(h.seed).not.toHaveBeenCalled();
  }
  expect(h.user).toHaveBeenCalledOnce();
});
