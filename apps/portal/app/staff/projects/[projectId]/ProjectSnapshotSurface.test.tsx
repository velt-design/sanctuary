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
import ProjectHeaderOwnerControl from '@/components/projects/ProjectPage/ProjectHeaderOwnerControl';
import ProjectTabBody from '@/components/projects/ProjectPage/ProjectTabBody';
import type { ProjectSnapshotEvidence } from './ProjectSnapshotSurface';

const state = vi.hoisted(() => ({ canonical: '/staff/projects', pathname: '/staff/projects', readers: 0, outletMounts: 0,
  publicPrepare: null as null | ((tab: any) => void), prepared: [] as string[], preparationModes: [] as boolean[], outletRetires: 0, duplicateViews: 0, facts: 0, owners: 0, initial: null as unknown, retiredPublish: null as null | ((v: any) => void) }));
const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => state.pathname,
  useSelectedLayoutSegments: () => state.canonical.split('/').filter(Boolean), useSearchParams: () => new URLSearchParams(window.location.search) }));
vi.mock('@/components/projects/ProjectPage/ProjectHeaderSurface', async (original) => {
  const actual = await original<typeof import('@/components/projects/ProjectPage/ProjectHeaderSurface')>();
  return { default: (props: any) => { state.publicPrepare = props.onTabIntent; return <actual.default {...props} />; } };
});
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
vi.mock('./ProjectSnapshotRead', () => ({ default: ({ projectId, publish, initialRead, navigation, estimatesList,quotesList,invoicesList,publishCommercial }: any) => {
  const evidence = useMemo(() => ({ snapshot: { project: { id: projectId, name: `Verified ${projectId}`, stage: 'new', hasJobPacks: false },
    workModel: 'legacy', pipeline: { stage: 'new' }, activity: [], emails: [], notes: [] }, host: 'host', readOnly: false,
    snapshotContentReady: true, snapshotState: 'fresh', overviewReads: null, calculatorWorkspace: false, searchReader: null,
    headerOwner: <ProjectHeaderOwnerControl project={null} projectId={projectId} host="host" active />,
    body: <ProjectTabBody projectId={projectId} host="host" snapshot={null} tab="activity" optimisticTab={navigation.optimisticTab} />,
    onTabIntent: (tab: string, codeOnly = false) => { state.prepared.push(tab); state.preparationModes.push(codeOnly); },
    onProjectAccessEnding: vi.fn(), statusPanel: null }) as unknown as ProjectSnapshotEvidence, [projectId, navigation.optimisticTab]);
  const listEvidence = useMemo(() => ({ headerActions: <button>Verified estimate command</button>, status: null,
      render: (query: string) => ({ empty: null, noMatches: null, rows: 'Beta'.toLowerCase().includes(query.toLowerCase())
        ? <tr><td>Beta {projectId}</td></tr> : null }) }), [projectId]);
  const quoteEvidence=useMemo(()=>({closed:false,headerActions:<button>Verified quote command</button>,accepted:null,status:null,historicalLabel:0,dialogs:null,
    render:(query:string)=>({noMatches:null,rows:'Beta'.toLowerCase().includes(query.toLowerCase())?<tr><td>Beta quote {projectId}</td></tr>:null})}),[projectId]);
  const invoiceEvidence=useMemo(()=>({closed:false,schedule:null,schedulePending:false,scheduleEyebrow:'Verified schedule',beforeSchedule:null,scheduleDetails:null,beforeHistory:null,historyEyebrow:'Verified invoices',dialogs:null,
    render:(query:string)=>({noMatches:null,rows:'Beta'.toLowerCase().includes(query.toLowerCase())?<tr><td>Beta invoice {projectId}</td></tr>:null})}),[projectId]);
  useLayoutEffect(()=>{quotesList?.publish(quoteEvidence);return()=>quotesList?.publish(null);},[quotesList?.publish,quoteEvidence]);
  useLayoutEffect(()=>{invoicesList?.publish(invoiceEvidence);return()=>invoicesList?.publish(null);},[invoicesList?.publish,invoiceEvidence]);
  useLayoutEffect(() => { estimatesList?.publish(listEvidence); return () => estimatesList?.publish(null); }, [estimatesList?.publish, listEvidence]);
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
beforeEach(() => { state.canonical = state.pathname = '/staff/projects'; Object.assign(state, { readers: 0, facts: 0, owners: 0, outletMounts: 0, outletRetires: 0, duplicateViews: 0, initial: null, retiredPublish: null, publicPrepare: null, prepared: [], preparationModes: [] });
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

// The real pending navigation must survive safe tab use; only current adopted code may prepare data.
it('queues early tab URL/preparation without cancelling held adoption, then reuses the same actual tab body', () => {
  view = renderIntoDocument(tree()); click('[data-open]');
  const frame = view.container.querySelector('[data-project-page-frame]');
  const body = view.container.querySelector('[data-project-tab-body]');
  const files = [...view.container.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(node => node.textContent === 'Files')!;
  const historyLength = window.history.length;
  act(() => { files.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); files.click(); });
  expect(files.getAttribute('aria-selected')).toBe('true');
  expect(body?.getAttribute('data-project-tab-body')).toBe('files');
  expect(new URL(window.location.href).searchParams.get('tab')).toBe('activity');
  expect(state.prepared).toEqual([]); expect(state.readers).toBe(0); expect(state.facts).toBe(0);
  adopt();
  expect(window.history.length).toBe(historyLength);
  expect(new URL(window.location.href).searchParams.get('tab')).toBe('files');
  expect(view.container.querySelector('[data-project-page-frame]')).toBe(frame);
  expect(view.container.querySelector('[data-project-tab-body]')).toBe(body);
  expect(view.container.querySelector('[data-private-files]')).not.toBeNull();
  expect(state.prepared).toEqual(['files']); expect(state.preparationModes).toEqual([true]); expect(state.readers).toBe(1); expect(state.outletRetires).toBe(0);
});

it('discards pending tab URL and preparation when that source is retired before code adoption', () => {
  view = renderIntoDocument(tree()); click('[data-open]');
  const files = [...view.container.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(node => node.textContent === 'Files')!;
  act(() => { files.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); files.click(); });
  click('[data-select-index]');
  expect(state.prepared).toEqual([]); expect(state.readers).toBe(0);
  state.canonical = state.pathname = '/staff/projects'; view.rerender(tree());
  expect(new URL(window.location.href).pathname).toBe('/staff/projects');
  expect(new URL(window.location.href).searchParams.get('tab')).toBeNull();
  expect(view.container.querySelector('[data-project-page-frame]')).toBeNull();
  expect(state.outletRetires).toBe(0);
});

it('rejects a late public preparation callback after its guarded project owner retires', () => {
  view = renderIntoDocument(tree()); click('[data-open]'); adopt();
  const oldPreparation = state.publicPrepare!;
  expect(state.readers).toBe(1);
  click('[data-select-index]');
  expect(state.readers).toBe(0);
  act(() => oldPreparation('files'));
  expect(state.prepared).toEqual([]);
  expect(view.container.querySelector('[data-project-page-frame]')).toBeNull();
});

it('does not queue a blocked pending tab selection or mutate the URL', () => {
  view = renderIntoDocument(tree()); click('[data-open]');
  const block = (event: Event) => event.preventDefault();
  window.addEventListener('portal:before-project-view-change', block);
  try {
    const files = [...view.container.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(node => node.textContent === 'Files')!;
    act(() => files.click());
    expect(files.getAttribute('aria-selected')).toBe('false');
    expect(new URL(window.location.href).searchParams.get('tab')).toBe('activity');
    adopt();
    expect(new URL(window.location.href).searchParams.get('tab')).toBe('activity');
    expect(state.prepared).toEqual([]);
  } finally { window.removeEventListener('portal:before-project-view-change', block); }
});


it('selects the same actual Estimates Find/table before held detail authority and rejects old source publication on denial and A→B', () => {
  view = renderIntoDocument(tree()); click('[data-open]');
  const commercial = [...view.container.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(node => node.textContent === 'Commercial')!;
  act(() => commercial.click());
  const input = view.container.querySelector<HTMLInputElement>('#estimate-search')!, table = view.container.querySelector('table'),
    head = view.container.querySelector('thead'), body = view.container.querySelector('tbody');
  expect(input).not.toBeNull(); expect(input.disabled).toBe(false); expect(table?.textContent).toContain('Reading estimates');
  expect(state.readers).toBe(0); expect(state.owners).toBe(0); expect(state.outletMounts).toBe(1); expect(state.outletRetires).toBe(0);
  expect(view.container.textContent).not.toContain('Beta proj_A'); expect(view.container.textContent).not.toContain('Verified estimate command');
  act(() => { input.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Beta'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  adopt(); const old = state.retiredPublish!;
  expect(view.container.querySelector('#estimate-search')).toBe(input); expect(view.container.querySelector('table')).toBe(table);
  expect(view.container.querySelector('thead')).toBe(head); expect(view.container.querySelector('tbody')).toBe(body);
  expect(table?.textContent).toContain('Beta proj_A'); expect(document.activeElement).toBe(input); expect(input.value).toBe('Beta');
  click('[data-deny]'); expect(table?.textContent).toContain('Estimates unavailable'); expect(table?.textContent).not.toContain('Beta proj_A');
  expect(view.container.textContent).not.toContain('Verified estimate command'); expect(view.container.querySelector('#estimate-search')).toBe(input);
  expect(state.readers).toBe(0); expect(input.value).toBe('Beta');
  completion = recovered; view.rerender(tree()); expect(table?.textContent).toContain('Beta proj_A');
  completion = detailB; window.history.replaceState(null, '', '/staff/projects/proj_B?tab=estimates'); adopt('proj_B');
  expect(view.container.querySelector('#estimate-search')).toBe(input); expect(input.value).toBe(''); expect(table?.textContent).toContain('Beta proj_B');
  act(() => old(null)); expect(table?.textContent).toContain('Beta proj_B'); expect(state.outletRetires).toBe(0);
});


it('renders the one real Estimates Find/table synchronously for a cold Estimates document without guarded readers or invented rows', () => {
  state.pathname = state.canonical = '/staff/projects/proj_A'; window.history.replaceState(null, '', `${state.pathname}?tab=estimates`);
  const cache = vi.spyOn(client, 'getQueryData');
  const html = renderToString(tree());
  expect(html.match(/data-estimates-view="list"/g)).toHaveLength(1); expect(html).toContain('id="estimate-search"');
  expect(html).toContain('aria-label="Project estimates"'); expect(html).toContain('Reading estimates');
  expect(html).not.toContain('Beta proj_A'); expect(html).not.toContain('Verified estimate command'); expect(html).not.toContain('No estimates yet');
  expect(state.readers).toBe(0); expect(cache).not.toHaveBeenCalled(); cache.mockRestore();
});

it('keeps one real Commercial toolbar across all three safe views before held authority, then fills the same quote/invoice tables only from the current owner',()=>{
 view=renderIntoDocument(tree());click('[data-open]');
 const tab=(label:string)=>[...view!.container.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(node=>node.textContent===label)!;
 act(()=>tab('Commercial').click());const toolbar=view.container.querySelector('[aria-label="Commercial sections"]');
 expect(toolbar).not.toBeNull();act(()=>tab('Quotes').click());
 const input=view.container.querySelector<HTMLInputElement>('#quote-search')!,table=view.container.querySelector('table'),head=table?.querySelector('thead'),body=table?.querySelector('tbody');
 expect(tab('Quotes').getAttribute('aria-selected')).toBe('true');expect(input.disabled).toBe(false);expect(table?.textContent).toContain('Reading quote versions');
 expect(view.container.querySelector('[aria-label="Commercial sections"]')).toBe(toolbar);expect(state.readers).toBe(0);expect(view.container.textContent).not.toContain('Verified quote command');
 act(()=>{input.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'Beta');input.dispatchEvent(new Event('input',{bubbles:true}));});
 adopt();expect(view.container.querySelector('#quote-search')).toBe(input);expect(view.container.querySelector('table')).toBe(table);expect(table?.querySelector('thead')).toBe(head);expect(table?.querySelector('tbody')).toBe(body);
 expect(table?.textContent).toContain('Beta quote proj_A');expect(input.value).toBe('Beta');expect(document.activeElement).toBe(input);
 click('[data-deny]');expect(view.container.querySelector('#quote-search')).toBe(input);expect(table?.textContent).not.toContain('Beta quote');expect(view.container.textContent).not.toContain('Verified quote command');
 act(()=>tab('Invoices').click());const invoice=view.container.querySelector<HTMLInputElement>('#invoice-search')!,invoiceTable=view.container.querySelector('table');
 expect(tab('Invoices').getAttribute('aria-selected')).toBe('true');expect(invoice.disabled).toBe(false);expect(invoiceTable?.textContent).toContain('Invoices unavailable');expect(view.container.querySelector('[aria-label="Commercial sections"]')).toBe(toolbar);
 completion=recovered;view.rerender(tree());expect(view.container.querySelector('#invoice-search')).toBe(invoice);expect(view.container.querySelector('table')).toBe(invoiceTable);expect(invoiceTable?.textContent).toContain('Beta invoice proj_A');
 expect(state.outletRetires).toBe(0);
});
it.each(['quotes','invoices','activity','files','job-packs'])('renders the SAME actual %s surface synchronously without private readers/cache/commands',tab=>{
 state.pathname=state.canonical='/staff/projects/proj_A';window.history.replaceState(null,'',`${state.pathname}?tab=${tab}`);
 const cached=vi.spyOn(client,'getQueryData');const html=renderToString(tree());
 const required:Record<string,string[]>= {quotes:['quote-search','Show historical versions','<thead'],invoices:['invoice-search','Job payment schedule','Invoice history'],activity:['data-project-overview="true"','Project Work sections','Team notes &amp; portal history'],files:['Find in this folder','Files list','Download'], 'job-packs':['Job Packs','Design','Quote status']};
 for(const item of required[tab])expect(html).toContain(item);
 expect(html).not.toContain('Verified proj_A');expect(html).not.toContain('Beta quote');expect(html).not.toContain('Verified quote command');expect(state.readers).toBe(0);expect(cached).not.toHaveBeenCalled();cached.mockRestore();
});
