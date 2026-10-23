import { act, useEffect, useLayoutEffect, useMemo } from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import { PortalQueryClientScope } from '@/lib/react-query/PortalQueryClientContext';
import { PortalInstantRouteContent, PortalRouteTransitionProvider } from '@/components/page-state/PortalRouteTransition';
import { PortalGuardedPage, usePortalPageSource } from '@/components/page-state/PortalPageSource';
import Provider, { useOptionalProjectWorkspace } from '../ProjectInstantNavigation';
import { useProjectInstantOpen } from '../ProjectInstantOpen';
import Snapshot from './ProjectSnapshotPageClient';
import ProjectDetailPage from './page';
import type { ProjectSnapshotEvidence } from './ProjectSnapshotSurface';

const state = vi.hoisted(() => ({ canonical: '/staff/projects', pathname: '/staff/projects', readers: 0, outletMounts: 0,
  outletRetires: 0, duplicateViews: 0, facts: 0, owners: 0, initial: null as unknown, retiredPublish: null as null | ((v: any) => void) }));
const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => state.pathname,
  useSelectedLayoutSegments: () => state.canonical.split('/').filter(Boolean), useSearchParams: () => new URLSearchParams(window.location.search) }));
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/lib/auth', () => ({ requireStaffPageAccess: async () => ({ user: { id: 'fictional-staff' }, role: 'staff' }) }));
vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('@/components/auth/PortalAuthProvider', () => ({ usePortalSession: () => ({ role: 'staff' }) }));
vi.mock('@/components/ui/toast/ToastProvider', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock('@/components/navigation/ProjectsIndexLink', () => ({ default: ({ children }: any) => <button data-return>{children}</button> }));
vi.mock('@/components/projects/ProjectPage/ProjectHeaderOwnerControl', () => ({ default: () => {
  useEffect(() => { state.owners++; return () => { state.owners--; }; }, []); return <span data-real-owner>Verified owner</span>;
} }));
vi.mock('@/components/projects/ProjectPage/projectTabModules', () => ({
  preloadProjectTab: vi.fn(), preloadProjectTabModule: vi.fn(),
  OverviewTab: () => { useEffect(() => { state.facts++; return () => { state.facts--; }; }, []); return <p data-real-fact>Current project facts</p>; },
  FilesTab: () => <p data-private-files>Files</p>, CommercialTab: () => <p data-private-commercial>Commercial</p>, JobPacksTab: () => <p>Job packs</p>,
}));
vi.mock('./ProjectSnapshotRead', () => ({ default: ({ projectId, publish, initialRead }: any) => {
  const evidence = useMemo(() => ({ snapshot: { project: { id: projectId, name: `Verified ${projectId}`, stage: 'new', hasJobPacks: false },
    workModel: 'legacy', pipeline: { stage: 'new' }, activity: [], emails: [], notes: [] }, host: 'host', readOnly: false,
    snapshotContentReady: true, snapshotState: 'fresh', overviewReads: null, calculatorWorkspace: false, searchReader: null,
    onProjectAccessEnding: vi.fn(), statusPanel: null }) as unknown as ProjectSnapshotEvidence, [projectId]);
  useLayoutEffect(() => { state.readers++; state.initial = initialRead; state.retiredPublish = publish; publish(evidence);
    return () => { state.readers--; publish(null); }; }, [publish, evidence, initialRead]);
  return null;
} }));

let client: QueryClient, view: ReturnType<typeof renderIntoDocument> | undefined;
const index = {}, detailA = {}, detailB = {}, recovered = {}, initialRead = {};
let completion = detailA, denied = false;
function Open() { const { openProject } = useProjectInstantOpen(); return <button data-open onClick={() => openProject('proj_A')}>Open record</button>; }
function Controls() { const source = usePortalPageSource(); const workspace = useOptionalProjectWorkspace();
  useLayoutEffect(() => {
    if (source?.selectedPath === '/staff/projects' && document.querySelector('[data-project-page-frame]')
      && [...document.querySelectorAll('h1')].some(heading => heading.textContent === 'Projects')) state.duplicateViews++;
  });
  return <><button data-select-index onClick={() => { source!.begin('/staff/projects'); window.history.pushState(null, '', '/staff/projects'); }}>Index</button>
    <button data-rejected onClick={() => workspace!.showProject('https://foreign.invalid/staff/projects/proj_A')}>Rejected</button>
    <button data-deny onClick={() => source!.deny('/staff/projects/proj_A')}>Deny</button><output data-current-owner={String(Boolean(workspace?.owner))}/></>; }
function Outlet() {
  usePortalPageSource(); // Next owns an independent router subscription in production.
  useEffect(() => { state.outletMounts++; return () => { state.outletRetires++; }; }, []);
  const path = state.canonical;
  return path === '/staff/projects' ? <PortalGuardedPage pathname={path} completion={index}><p data-index>Index facts</p><Open/></PortalGuardedPage>
    : <PortalGuardedPage pathname={path} completion={completion} publicFrame={false} unavailable={denied}>
      <Snapshot projectId={path.split('/').at(-1)!} tab="activity" estimateId={null} debugExportEnabled={false} initialRead={initialRead as any}/>
    </PortalGuardedPage>;
}
const stableOutlet = <Outlet/>;
function tree() { return <QueryClientProvider client={client}><PortalQueryClientScope client={client}><PortalRouteTransitionProvider>
  <PortalInstantRouteContent><Provider><Controls/>{stableOutlet}</Provider></PortalInstantRouteContent>
</PortalRouteTransitionProvider></PortalQueryClientScope></QueryClientProvider>; }
function adopt(id = 'proj_A') { state.pathname = `/staff/projects/${id}`; state.canonical = state.pathname; view!.rerender(tree()); }
function click(selector: string) { act(() => view!.container.querySelector<HTMLButtonElement>(selector)!.click()); }
beforeEach(() => { state.canonical = state.pathname = '/staff/projects'; Object.assign(state, { readers: 0, facts: 0, owners: 0, outletMounts: 0, outletRetires: 0, duplicateViews: 0, initial: null, retiredPublish: null });
  completion = detailA; denied = false; window.history.replaceState(null, '', '/staff/projects');
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); });
afterEach(() => { view?.unmount(); view = undefined; client.clear(); });

describe('one real project frame beside the retained Next outlet', () => {
  it('keeps the outlet and actual search/tabpanel nodes through pending, guarded adoption, linked return and cached Back', () => {
    view = renderIntoDocument(tree()); click('[data-rejected]');
    expect(view.container.querySelector('[data-index]')).not.toBeNull(); expect(view.container.querySelector('[data-project-page-frame]')).toBeNull();
    click('[data-open]');
    const frame = view.container.querySelector('[data-project-page-frame]'), input = view.container.querySelector<HTMLInputElement>('[role=combobox]')!,
      body = view.container.querySelector('[data-project-tab-body]');
    expect(frame).not.toBeNull(); expect(body).not.toBeNull();
    expect(view.container.querySelector('[data-index]')).toBeNull();
    expect([...view.container.querySelectorAll('h1')].some(heading => heading.textContent === 'Projects')).toBe(false); expect(state.readers).toBe(0); expect(state.facts).toBe(0); expect(state.owners).toBe(0);
    act(() => input.focus()); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => { setter.call(input, 'Early query'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    adopt();
    expect(state.outletMounts).toBe(1); expect(state.outletRetires).toBe(0); expect(state.readers).toBe(1); expect(state.initial).toBe(initialRead);
    expect(view.container.querySelector('[data-project-page-frame]')).toBe(frame); expect(view.container.querySelector('[role=combobox]')).toBe(input);
    expect(view.container.querySelector('[data-project-tab-body]')).toBe(body); expect(document.activeElement).toBe(input); expect(input.value).toBe('Early query');
    expect(view.container.querySelector('[data-project-background-ready=true]')).not.toBeNull(); expect(state.facts).toBe(1);
    click('[data-select-index]'); expect(state.readers).toBe(0); expect(state.facts).toBe(0); expect(state.owners).toBe(0); expect(view.container.querySelector('[data-project-page-frame]')).toBeNull();
    state.canonical = state.pathname = '/staff/projects'; view.rerender(tree()); expect(view.container.querySelector('[data-index]')).not.toBeNull();
    act(() => { window.history.replaceState(null, '', '/staff/projects/proj_A'); window.dispatchEvent(new PopStateEvent('popstate')); });
    adopt(); expect(state.readers).toBe(1); expect(view.container.querySelector('[data-real-fact]')).not.toBeNull();
    expect(state.outletMounts).toBe(1); expect(state.outletRetires).toBe(0);
  });
  it('never publishes departed owner facts or actions into a denied or replacement source', () => {
    view = renderIntoDocument(tree()); click('[data-open]'); adopt(); const old = state.retiredPublish!;
    click('[data-deny]'); expect(view.container.querySelector('[data-state=unavailable]')).not.toBeNull();
    expect([...view.container.querySelectorAll('button')].some(button => button.textContent === 'Retry')).toBe(true);
    expect(state.readers).toBe(0); expect(state.facts).toBe(0); expect(state.owners).toBe(0);
    act(() => old({ snapshotState: 'fresh', snapshot: { project: { name: 'Late forbidden facts' } } }));
    expect(view.container.textContent).not.toContain('Late forbidden facts'); expect(view.container.querySelector('[data-project-background-ready]')).toBeNull();
    completion = recovered; view.rerender(tree()); expect(state.readers).toBe(1);
    completion = detailB; window.history.replaceState(null, '', '/staff/projects/proj_B'); adopt('proj_B');
    expect(view.container.textContent).toContain('Verified proj_B'); act(() => old(null)); expect(view.container.textContent).toContain('Verified proj_B');
    expect(state.readers).toBe(1); expect(state.outletRetires).toBe(0);
  });
  it('renders the same neutral real frame synchronously for a cold detail document', () => {
    state.pathname = state.canonical = '/staff/projects/proj_A'; window.history.replaceState(null, '', state.pathname);
    const html = renderToString(tree()); expect(html).toContain('data-project-page-frame="true"'); expect(html).toContain('role="combobox"');
    expect(html).toContain('role="tabpanel"'); expect(html).toContain('Reading project'); expect(html).not.toContain('Verified proj_A'); expect(state.readers).toBe(0);
  });
});

it('keeps the existing trim-invalid server UI as the single owner without adding a reading frame', async () => {
  state.pathname = state.canonical = '/staff/projects/%20%20%20'; window.history.replaceState(null, '', state.pathname);
  const leaf = await ProjectDetailPage({ params: Promise.resolve({ projectId: '   ' }) });
  const html = renderToString(<QueryClientProvider client={client}><PortalQueryClientScope client={client}><PortalRouteTransitionProvider>
    <Provider>{leaf}</Provider>
  </PortalRouteTransitionProvider></PortalQueryClientScope></QueryClientProvider>);
  expect(html).toContain('The project link is invalid'); expect(html).not.toContain('data-project-page-frame');
  expect(html.match(/data-ui-foundation-consumer="project-detail"/g)).toHaveLength(1); expect(state.readers).toBe(0);
});
it.each(['work-queue', 'design-packages', 'running-jobs', 'new'])('does not mistake the decoded static %s route for a project', name => {
  state.pathname = state.canonical = `/staff/projects/%${name.charCodeAt(0).toString(16)}${name.slice(1)}`; window.history.replaceState(null, '', state.pathname);
  const html = renderToString(<QueryClientProvider client={client}><PortalRouteTransitionProvider><Provider><h1>Actual static route</h1></Provider></PortalRouteTransitionProvider></QueryClientProvider>);
  expect(html).toContain('Actual static route'); expect(html).not.toContain('data-project-page-frame'); expect(state.readers).toBe(0);
});

it('restores cached denied detail as unavailable and uses the same frame Retry before distinct genuine recovery', () => {
  view = renderIntoDocument(tree()); click('[data-open]'); adopt();
  denied = true; view.rerender(tree()); expect(state.readers).toBe(0);
  click('[data-select-index]'); state.pathname = state.canonical = '/staff/projects'; view.rerender(tree());
  act(() => { window.history.replaceState(null, '', '/staff/projects/proj_A'); window.dispatchEvent(new PopStateEvent('popstate')); });
  adopt();
  const frame = view.container.querySelector('[data-project-page-frame]'), input = view.container.querySelector<HTMLInputElement>('[role=combobox]')!;
  expect(frame).not.toBeNull(); expect(view.container.querySelector('[data-state=unavailable]')).not.toBeNull();
  expect(view.container.querySelector('[data-real-fact]')).toBeNull(); expect(state.readers).toBe(0); expect(state.owners).toBe(0);
  const retry = [...view.container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Retry')!;
  const before = router.refresh.mock.calls.length; act(() => { input.focus(); retry.click(); });
  expect(router.refresh.mock.calls.length).toBe(before + 1); expect(state.readers).toBe(0);
  expect(view.container.querySelector('[data-project-page-frame]')).toBe(frame);
  completion = recovered; denied = false; view.rerender(tree());
  expect(view.container.querySelector('[data-project-page-frame]')).toBe(frame); expect(view.container.querySelector('[role=combobox]')).toBe(input);
  expect(view.container.querySelector('[data-state=unavailable]')).toBeNull(); expect(view.container.querySelector('[data-real-fact]')).not.toBeNull();
  expect(state.readers).toBe(1); expect(state.outletRetires).toBe(0);
});

it('restores the genuine held index after unrelated detail failure without even a commit containing both views', () => {
  view = renderIntoDocument(tree()); click('[data-open]');
  expect(state.canonical).toBe('/staff/projects'); expect(view.container.querySelector('[data-index]')).toBeNull();
  click('[data-deny]'); expect(state.readers).toBe(0); click('[data-select-index]');
  expect(view.container.querySelector('[data-index]')).not.toBeNull(); expect(view.container.querySelector('[data-project-page-frame]')).toBeNull();
  expect(state.duplicateViews).toBe(0); expect(state.outletRetires).toBe(0);
});
