import { act, useEffect, type ReactElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import PortalActualFrames from '@/components/page-state/PortalActualFrames';
import { PortalGuardedPage, PortalPageSourceProvider, usePortalPageSourceController } from '@/components/page-state/PortalPageSource';
import { ProjectCorrespondenceWarmRead } from '@/components/projects/ProjectPage/tabs/overview/ProjectCorrespondenceWarmRead';
import ProjectDetailPage from './page';
const scheduling = vi.hoisted(() => ({ headers: new Headers(), load: vi.fn(), gate: vi.fn() }));
const lifetime = vi.hoisted(() => ({ mounts: 0, cleanups: 0, api: vi.fn() }));
const router = { replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => window.location.pathname, useSearchParams: () => new URLSearchParams(window.location.search) }));
vi.mock('@/lib/repo/apiClient', async original => ({ ...await original<typeof import('@/lib/repo/apiClient')>(), apiJson: (...args: unknown[]) => lifetime.api(...args) }));
vi.mock('next/headers', () => ({ headers: async () => scheduling.headers }));
vi.mock('./loadProjectWorkInitialRead', () => ({ loadProjectWorkInitialRead: scheduling.load }));
vi.mock('@/lib/auth', () => ({ requireStaffPageAccess: scheduling.gate }));
beforeEach(() => {
  scheduling.headers = new Headers(); scheduling.load.mockReset();
  scheduling.gate.mockReset().mockResolvedValue({ role: 'staff', user: { id: 'staff-a' } });
  lifetime.mounts = 0; lifetime.cleanups = 0; lifetime.api.mockReset().mockImplementation(() => new Promise(() => {}));
});
let mounted: ReturnType<typeof renderIntoDocument> | undefined;
const clients: QueryClient[] = [];
afterEach(() => { mounted?.unmount(); mounted = undefined; clients.splice(0).forEach(client => client.clear()); });

vi.mock('@/components/navigation/ProjectsIndexLink', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('./ProjectSnapshotPageClient', () => ({
  default: (props: { projectId: string; tab: string; estimateId: string | null; calculatorWorkspace: boolean; debugExportEnabled: boolean }) => {
    useEffect(() => { lifetime.mounts++; return () => { lifetime.mounts--; lifetime.cleanups++; }; }, []);
    return (
    <div
      data-testid="project-page"
      data-project-id={props.projectId}
      data-tab={props.tab}
      data-estimate-id={props.estimateId ?? ''}
      data-calculator-workspace={String(props.calculatorWorkspace)}
      data-debug-enabled={String(props.debugExportEnabled)}
    />
    );
  },
}));

function RetainedOutlet({ canonical, leaf, expectedOwner }: { canonical: string; leaf: ReactNode; expectedOwner?: object }) {
  const source = usePortalPageSourceController(window.location.pathname, canonical, window.location.search.slice(1));
  useEffect(() => { window.addEventListener('popstate', source.cancel); return () => window.removeEventListener('popstate', source.cancel); }, [source.cancel]);
  return <PortalPageSourceProvider value={source}>
    <button onClick={() => { source.begin('/staff/projects'); window.history.pushState(null, '', '/staff/projects'); }}>Select Projects</button>
    <output data-current-owner={source.owner === expectedOwner && expectedOwner ? 'expected' : source.owner ? 'other' : 'pending'} />
    <PortalActualFrames>{leaf}</PortalActualFrames>
  </PortalPageSourceProvider>;
}

describe('ProjectDetailPage', () => {
  it('retires a settled canonical detail and its correspondence read before the retained outlet adopts the selected Projects leaf', async () => {
    const id = 'proj_11111111-1111-4111-8111-111111111111', path = `/staff/projects/${id}`;
    window.history.replaceState(null, '', path);
    const detail = await ProjectDetailPage({ params: Promise.resolve({ projectId: id }) });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
    const ui = (canonical: string, leaf: ReactNode, expectedOwner?: object) => <QueryClientProvider client={client}><RetainedOutlet canonical={canonical} leaf={leaf} expectedOwner={expectedOwner}/></QueryClientProvider>;
    mounted = renderIntoDocument(ui(path, detail));
    expect(mounted.container.querySelector('[data-testid="project-page"]')).not.toBeNull();
    expect(lifetime.mounts).toBe(1); expect(lifetime.api).toHaveBeenCalledTimes(1);
    const signal = lifetime.api.mock.calls[0][1].signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    act(() => mounted!.container.querySelector('button')!.click());
    expect(window.location.pathname).toBe('/staff/projects');
    expect(mounted.container.querySelector('h1')?.textContent).toBe('Projects');
    expect(mounted.container.querySelector('[data-testid="project-page"]')).toBeNull();
    expect(lifetime.mounts).toBe(0); expect(lifetime.cleanups).toBe(1); expect(signal.aborted).toBe(true);
    const table = mounted.container.querySelector('table'), find = mounted.container.querySelector('input');
    const indexCompletion = {};
    mounted.rerender(ui('/staff/projects', <>{detail}<PortalGuardedPage pathname="/staff/projects" completion={indexCompletion}><p data-index-evidence>Current guarded index evidence</p></PortalGuardedPage></>, indexCompletion));
    expect(mounted.container.querySelector('[data-current-owner]')?.getAttribute('data-current-owner')).toBe('expected');
    expect(mounted.container.querySelector('[data-index-evidence]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="project-page"]')).toBeNull();
    expect(mounted.container.querySelector('table')).toBe(table); expect(mounted.container.querySelector('input')).toBe(find);
    expect(lifetime.api).toHaveBeenCalledTimes(1);
  });
  it('starts only a matching Work document read after the fresh gate', async () => {
    const id = 'proj_11111111-1111-4111-8111-111111111111';
    scheduling.headers.set('x-portal-document-callback', `/staff/projects/${id}?tab=activity`);
    scheduling.load.mockImplementation(() => {
      expect(scheduling.gate).toHaveBeenCalledWith(`/staff/projects/${id}`);
      return undefined;
    });
    await ProjectDetailPage({ params: Promise.resolve({ projectId: id }) });
    expect(scheduling.load).toHaveBeenCalledWith(id, { userId: 'staff-a', isAdmin: false });
    scheduling.load.mockClear();
    await ProjectDetailPage({ params: Promise.resolve({ projectId: id }), searchParams: Promise.resolve({ tab: 'estimates' }) });
    scheduling.headers = new Headers();
    await ProjectDetailPage({ params: Promise.resolve({ projectId: id }) });
    expect(scheduling.load).not.toHaveBeenCalled();
  });

  it('returns the actual client while every request-owned document result is still unsettled', async () => {
    const id='proj_11111111-1111-4111-8111-111111111111';
    scheduling.headers.set('x-portal-document-callback', `/staff/projects/${id}?tab=activity`);
    const pending=new Promise(()=>{});
    const initial={id:'fictional-read',ownerId:'staff-a',host:'fixture',projectId:id,results:{summary:pending,snapshot:pending,command:pending,payment:pending}};
    scheduling.load.mockReturnValue(initial);
    const page=await ProjectDetailPage({params:Promise.resolve({projectId:id})});
    expect(page.type).toBe(PortalGuardedPage); expect(page.props.publicFrame).toBe(false);
    const warm = page.props.children as ReactElement<{ children: ReactElement<{ initialRead: unknown }> }>;
    expect(warm.type).toBe(ProjectCorrespondenceWarmRead);
    expect(warm.props.children.props.initialRead).toBe(initial);
    expect(scheduling.gate).toHaveBeenCalledTimes(1);
  });

  it('never starts private reads when the page gate rejects', async () => {
    scheduling.gate.mockRejectedValue(new Error('denied'));
    await expect(ProjectDetailPage({ params: Promise.resolve({ projectId: 'proj_1' }) })).rejects.toThrow('denied');
    expect(scheduling.load).not.toHaveBeenCalled();
    expect(lifetime.api).not.toHaveBeenCalled(); expect(lifetime.mounts).toBe(0);
  });

  it('keeps private scheduling behind the unresolved fresh gate and creates a distinct completion for each granted leaf', async () => {
    const id = 'proj_11111111-1111-4111-8111-111111111111';
    let allow!: (session: { role: string; user: { id: string } }) => void;
    scheduling.headers.set('x-portal-document-callback', `/staff/projects/${id}`);
    scheduling.gate.mockReturnValueOnce(new Promise(resolve => { allow = resolve; }));
    const pending = ProjectDetailPage({ params: Promise.resolve({ projectId: id }) });
    await Promise.resolve();
    expect(scheduling.gate).toHaveBeenCalledExactlyOnceWith(`/staff/projects/${id}`);
    expect(scheduling.load).not.toHaveBeenCalled(); expect(lifetime.api).not.toHaveBeenCalled();
    allow({ role: 'staff', user: { id: 'staff-a' } });
    const first = await pending, second = await ProjectDetailPage({ params: Promise.resolve({ projectId: id }) });
    expect(first.type).toBe(PortalGuardedPage); expect(first.props.pathname).toBe(`/staff/projects/${id}`); expect(first.props.publicFrame).toBe(false);
    expect(first.props.completion).not.toBe(second.props.completion);
    expect(scheduling.load).toHaveBeenCalledTimes(2); expect(lifetime.mounts).toBe(0);
  });

  it('reuses valid cached detail completion on Back and retires it again on Forward without reviving the retained index', async () => {
    const id = 'proj_11111111-1111-4111-8111-111111111111', path = `/staff/projects/${id}`;
    window.history.replaceState(null, '', path);
    const detail = await ProjectDetailPage({ params: Promise.resolve({ projectId: id }) });
    const indexCompletion = {}, index = <PortalGuardedPage pathname="/staff/projects" completion={indexCompletion}><p data-index-evidence>Current guarded index evidence</p></PortalGuardedPage>;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
    const ui = (canonical: string, leaf: ReactNode, owner: object) => <QueryClientProvider client={client}><RetainedOutlet canonical={canonical} leaf={leaf} expectedOwner={owner}/></QueryClientProvider>;
    mounted = renderIntoDocument(ui(path, detail, detail.props.completion));
    expect(mounted.container.querySelector('[data-current-owner]')?.getAttribute('data-current-owner')).toBe('expected');
    act(() => mounted!.container.querySelector('button')!.click());
    mounted.rerender(ui('/staff/projects', <>{detail}{index}</>, indexCompletion));
    expect(mounted.container.querySelector('[data-index-evidence]')).not.toBeNull(); expect(lifetime.mounts).toBe(0);
    act(() => { window.history.replaceState(null, '', path); window.dispatchEvent(new PopStateEvent('popstate')); });
    mounted.rerender(ui(path, <>{detail}{index}</>, detail.props.completion));
    expect(mounted.container.querySelector('[data-testid="project-page"]')).not.toBeNull(); expect(mounted.container.querySelector('[data-index-evidence]')).toBeNull();
    expect(mounted.container.querySelector('[data-current-owner]')?.getAttribute('data-current-owner')).toBe('expected');
    expect(lifetime.mounts).toBe(1); expect(lifetime.api).toHaveBeenCalledTimes(2); expect(scheduling.gate).toHaveBeenCalledTimes(1);
    const returningSignal = lifetime.api.mock.calls[1][1].signal as AbortSignal;
    act(() => { window.history.replaceState(null, '', '/staff/projects'); window.dispatchEvent(new PopStateEvent('popstate')); });
    mounted.rerender(ui('/staff/projects', <>{detail}{index}</>, indexCompletion));
    expect(mounted.container.querySelector('[data-index-evidence]')).not.toBeNull(); expect(mounted.container.querySelector('[data-testid="project-page"]')).toBeNull();
    expect(mounted.container.querySelector('[data-current-owner]')?.getAttribute('data-current-owner')).toBe('expected');
    expect(lifetime.mounts).toBe(0); expect(lifetime.cleanups).toBe(2); expect(returningSignal.aborted).toBe(true); expect(lifetime.api).toHaveBeenCalledTimes(2);
  });

  it('keeps the retired detail private owners absent through selected-index denial and genuine completion recovery', async () => {
    const id = 'proj_11111111-1111-4111-8111-111111111111', path = `/staff/projects/${id}`;
    window.history.replaceState(null, '', path);
    const detail = await ProjectDetailPage({ params: Promise.resolve({ projectId: id }) });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
    const ui = (canonical: string, leaf: ReactNode, owner?: object) => <QueryClientProvider client={client}><RetainedOutlet canonical={canonical} leaf={leaf} expectedOwner={owner}/></QueryClientProvider>;
    mounted = renderIntoDocument(ui(path, detail));
    act(() => mounted!.container.querySelector('button')!.click());
    mounted.rerender(ui('/staff/projects', <>{detail}<PortalGuardedPage pathname="/staff/projects" completion={{}} unavailable><p data-index-evidence>Denied index evidence</p></PortalGuardedPage></>));
    expect(mounted.container.querySelector('[data-testid="project-page"]')).toBeNull(); expect(mounted.container.querySelector('[data-index-evidence]')).toBeNull();
    expect(mounted.container.textContent).toContain('Projects unavailable'); expect(lifetime.mounts).toBe(0); expect(lifetime.api).toHaveBeenCalledTimes(1);
    const completion = {};
    mounted.rerender(ui('/staff/projects', <>{detail}<PortalGuardedPage pathname="/staff/projects" completion={completion}><p data-index-evidence>Current guarded index evidence</p></PortalGuardedPage></>, completion));
    expect(mounted.container.querySelector('[data-current-owner]')?.getAttribute('data-current-owner')).toBe('expected');
    expect(mounted.container.querySelector('[data-index-evidence]')?.textContent).toBe('Current guarded index evidence');
    expect(mounted.container.querySelector('[data-testid="project-page"]')).toBeNull(); expect(lifetime.mounts).toBe(0); expect(lifetime.api).toHaveBeenCalledTimes(1);
  });
  it('renders an unavailable state for invalid ids', async () => {
    const ui = (await ProjectDetailPage({
      params: Promise.resolve({ projectId: '   ' }),
      searchParams: Promise.resolve({}),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('Project unavailable');
    expect(markup).toContain('Invalid project id.');
  });

  it('passes route state to the client without blocking on the project snapshot', async () => {
    const ui = (await ProjectDetailPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
      searchParams: Promise.resolve({ tab: 'quotes', estimateId: 'est_1' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('data-project-id="proj_1"');
    expect(markup).toContain('data-tab="quotes"');
    expect(markup).toContain('data-estimate-id="est_1"');
    expect(markup).toContain('data-calculator-workspace="false"');
  });

  it('selects the focused calculator workspace only for explicit Estimates intent', async () => {
    const ui = (await ProjectDetailPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
      searchParams: Promise.resolve({ tab: 'estimates', fromEstimateId: 'est_1' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('data-calculator-workspace="true"');
  });

  it('preserves a direct Files workspace entry', async () => {
    const ui = (await ProjectDetailPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
      searchParams: Promise.resolve({ tab: 'files' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('data-project-id="proj_1"');
    expect(markup).toContain('data-tab="files"');
  });

  it('coerces the retired Emails tab back to activity', async () => {
    const ui = (await ProjectDetailPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
      searchParams: Promise.resolve({ tab: 'emails' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('data-tab="activity"');
  });

  it('accepts invoices through the shared project-tab contract', async () => {
    const ui = (await ProjectDetailPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
      searchParams: Promise.resolve({ tab: 'invoices' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('data-tab="invoices"');
  });
});
