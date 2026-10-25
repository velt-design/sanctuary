import { act, Suspense, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import ProjectMainTabs from './ProjectMainTabs';
import ProjectMainTabsSurface from './ProjectMainTabsSurface';
import ProjectTabBody from './ProjectTabBody';
import CommercialTabSurface from './tabs/CommercialTabSurface';
import EstimatesListSurface, { useEstimatesListControls, type EstimatesListEvidence } from './tabs/EstimatesListSurface';
import { useOwnedPortalPublication } from '@/components/page-state/PortalPageSource';
import { PortalQueryClientScope } from '@/lib/react-query/PortalQueryClientContext';
import { ProjectCommercialProvider } from './ProjectCommercialContext';
import JobPacksListSurface,{type JobPacksListEvidence} from './tabs/JobPacksListSurface';

let search = 'tab=estimates';
const { estimates, packs, editorModules } = vi.hoisted(() => ({ estimates: vi.fn(), packs: vi.fn(), editorModules: vi.fn() }));
vi.mock('next/dynamic', async () => {
  const { default: Loadable } = await vi.importActual<typeof import('next/dist/shared/lib/lazy-dynamic/loadable')>('next/dist/shared/lib/lazy-dynamic/loadable');
  return { default: (loader: () => Promise<any>, options?: object) => Loadable({ loader: () => {
    if (String(loader).includes('CalculatorGridClient')) { editorModules(); return new Promise(() => undefined); }
    return loader();
  }, ...options }) };
});
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(search), usePathname: () => '/staff/projects/proj_1', useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock('@/components/ui/toast/ToastProvider', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock('@/lib/supabase/browserClient', () => ({ supabaseRuntimeUrl: () => 'https://example.invalid', supabaseHostFromUrl: () => 'host' }));
vi.mock('@/lib/localFirst/useResolvedLocalFirstId', () => ({ useResolvedLocalFirstId: (value: string) => value }));
vi.mock('@/lib/queries/projectEstimates', () => ({ estimateMetasByProjectQueryOptions: () => ({ queryKey: ['estimates', 'proj_1'], queryFn: estimates }), estimateDetailQueryOptions: () => ({ queryKey: ['unused-detail'], queryFn: vi.fn() }) }));
vi.mock('@/lib/queries/quotes', () => ({ quoteVersionsByProjectQueryOptions: () => ({ queryKey: ['quotes', 'proj_1'], queryFn: async () => [] }) }));
vi.mock('@/lib/queries/jobPacks', () => ({ generatedJobPacksByProjectQueryOptions: () => ({ queryKey: ['job-packs', 'proj_1'], queryFn: packs }) }));
vi.mock('@/app/staff/calculator/CalculatorGridClient', () => ({ default: () => { throw new Error('Record runtime must not mount for this list read'); } }));

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((accept) => { resolve = accept; }); return { promise, resolve }; }
function tree(client: QueryClient, tab: string, ready = false) {
  const snapshot = ready ? { project: { id: 'proj_1', name: 'Verified project', hasJobPacks: true } } as any : null;
  return <QueryClientProvider client={client}><ProjectCommercialProvider projectId="proj_1" ready={ready}><Suspense fallback={null}><ProjectMainTabs host="host" projectId="proj_1" snapshot={snapshot} snapshotContentReady={ready} snapshotState={ready ? 'fresh' : 'pending'} tab={tab} /></Suspense></ProjectCommercialProvider></QueryClientProvider>;
}
async function settleModules() { for (let depth = 0; depth < 3; depth += 1) await act(async () => { await vi.dynamicImportSettled(); }); }

function ManagedPacks({allowed,owner}:{allowed:boolean;owner:object}){
 const publication=useOwnedPortalPublication<JobPacksListEvidence>(allowed?owner:null);
 const producer=useMemo(()=>allowed?<ProjectCommercialProvider projectId="proj_1" ready><ProjectTabBody projectId="proj_1" host="host" snapshot={null} snapshotContentReady={false} tab="job-packs" publishJobPacks={publication.publish}/></ProjectCommercialProvider>:null,[allowed,publication.publish]);
 return <><JobPacksListSurface evidence={publication.value} unavailable={!allowed}/>{producer}</>;
}
it('keeps the actual Job Packs list header/table/body through held authority, genuine reader arrival and denial',async()=>{
 search='tab=job-packs';packs.mockClear();const read=deferred<any[]>();packs.mockReturnValue(read.promise);
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}}),owner={};const tree=(allowed:boolean)=><QueryClientProvider client={client}><ManagedPacks allowed={allowed} owner={owner}/></QueryClientProvider>;
 const view=renderIntoDocument(tree(false)),table=view.container.querySelector('table'),head=table?.querySelector('thead'),body=table?.querySelector('tbody'),heading=view.container.querySelector('h3');
 expect(packs).not.toHaveBeenCalled();view.rerender(tree(true));await settleModules();expect(packs).toHaveBeenCalledOnce();expect(view.container.querySelector('table')).toBe(table);
 await act(async()=>{read.resolve([{id:'pack-fixture',estimateId:'est-fixture',estimateVersionLabel:'Verified V2',quoteRef:'Q-FIXTURE',quoteVersionNumber:1,quoteStatus:'ACCEPTED',createdAt:'2026-10-01'}]);await new Promise(resolve=>setTimeout(resolve,5));});
 expect(table?.textContent).toContain('Verified V2');expect(view.container.querySelector('h3')).toBe(heading);expect(table?.querySelector('thead')).toBe(head);expect(table?.querySelector('tbody')).toBe(body);
 view.rerender(tree(false));expect(table?.textContent).not.toContain('Verified V2');expect(table?.textContent).toContain('unavailable');expect(view.container.querySelector('table')).toBe(table);view.unmount();client.clear();
});

describe('actual Project specialist parent during independent reads', () => {
  it('keeps the actual Estimates Find and table before and after both source and metadata settle', async () => {
    search = 'tab=estimates'; editorModules.mockClear();
    const read = deferred<any[]>(); estimates.mockReturnValue(read.promise);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = renderIntoDocument(tree(client, 'estimates'));
    await settleModules();
    const find = view.container.querySelector('#estimate-search') as HTMLInputElement;
    const table = view.container.querySelector('table');
    expect(find).not.toBeNull(); expect(find.disabled).toBe(false);
    expect(table?.textContent).toContain('Estimate');
    expect(editorModules).not.toHaveBeenCalled();
    expect(view.container.textContent).toContain('Reading estimates');
    expect(view.container.textContent).not.toContain('Create estimate');
    await act(async () => { read.resolve([{ id: 'est_1', projectId: 'proj_1', versionLabel: 'V2', createdAt: '2026-10-01', status: 'draft', isActiveDraft: true }]); await new Promise((resolve) => setTimeout(resolve, 5)); });
    expect(table?.textContent).toContain('V2');
    view.rerender(tree(client, 'estimates', true));
    expect(view.container.querySelector('#estimate-search')).toBe(find);
    expect(view.container.querySelector('table')).toBe(table);
    expect(view.container.textContent).toContain('Create estimate');
    expect(editorModules).not.toHaveBeenCalled();
    view.unmount(); client.clear();
  });

  it('mounts the actual Job Pack table before availability metadata is known', async () => {
    search = 'tab=job-packs';
    const read = deferred<any[]>(); packs.mockReturnValue(read.promise);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = renderIntoDocument(tree(client, 'job-packs'));
    await settleModules();
    const table = view.container.querySelector('table');
    expect(table).not.toBeNull(); expect(table?.textContent).toContain('Reading job packs');
    await act(async () => { read.resolve([]); await new Promise((resolve) => setTimeout(resolve, 5)); });
    expect(view.container.textContent).toContain('No job packs yet');
    view.rerender(tree(client, 'job-packs', true));
    expect(view.container.querySelector('table')).toBe(table);
    view.unmount(); client.clear();
  });
});


let retiredListPublish: ((value: EstimatesListEvidence | null) => void) | undefined;
function GuardedListBridge({ owner, allowed, shown = true }: { owner: object; allowed: boolean; shown?: boolean }) {
  const controls = useEstimatesListControls('proj_1');
  const publication = useOwnedPortalPublication<EstimatesListEvidence>(allowed ? owner : null);
  const binding = useMemo(() => ({ controls, publish: publication.publish }), [controls, publication.publish]);
  if (allowed) retiredListPublish = publication.publish;
  const body = useMemo(() => <ProjectCommercialProvider projectId="proj_1" ready>
    <ProjectTabBody host="host" projectId="proj_1" snapshot={null} tab="estimates" estimatesList={binding} />
  </ProjectCommercialProvider>, [binding]);
  return <ProjectMainTabsSurface projectId="proj_1" host="host" snapshot={null} tab="estimates"
    privateContentReady={allowed} body={shown ? body : null} publicBody={shown ? <CommercialTabSurface view="estimates" onSelect={() => undefined}>
      {publication.value?.notice}
      <EstimatesListSurface query={controls.query} onQueryChange={controls.setQuery} onInteraction={controls.markInteracted} evidence={publication.value} unavailable={!allowed} />
    {allowed ? body : null}</CommercialTabSurface> : null} />;
}
function guardedListTree(client: QueryClient, owner: object, allowed: boolean, shown = true) {
  return <QueryClientProvider client={client}><PortalQueryClientScope client={client}>
    <GuardedListBridge owner={owner} allowed={allowed} shown={shown}/>
  </PortalQueryClientScope></QueryClientProvider>;
}
function typeListQuery(input: HTMLInputElement, value: string) {
  act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true })); });
}

it('keeps one real safe list before current authority/code and fills the same early-filtered nodes from the actual guarded controller', async () => {
  search = 'tab=estimates'; estimates.mockClear(); editorModules.mockClear();
  const read = deferred<any[]>(); estimates.mockReturnValue(read.promise);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['commercialListView', 'proj_1', 'estimates'], 'Old saved filter');
  client.setQueryData(['commercialListView', 'proj_1', 'active-section'], 'estimates');
  client.setQueryData(['commercialListView', 'proj_1', 'estimates-scroll'], 900);
  const cached = vi.spyOn(client, 'getQueryData'), scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  const a = {}, b = {};
  const view = renderIntoDocument(guardedListTree(client, a, false));
  const input = view.container.querySelector<HTMLInputElement>('#estimate-search')!, table = view.container.querySelector('table'),
    head = view.container.querySelector('thead'), body = view.container.querySelector('tbody');
  expect(input).not.toBeNull(); expect(input.disabled).toBe(false); expect(cached).not.toHaveBeenCalled();
  expect(estimates).not.toHaveBeenCalled(); expect(editorModules).not.toHaveBeenCalled();
  expect(view.container.textContent).not.toContain('No estimates yet'); expect(view.container.textContent).not.toContain('Create estimate');
  act(() => input.focus()); typeListQuery(input, 'Beta');
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 420 }); act(() => window.dispatchEvent(new Event('scroll')));
  view.rerender(guardedListTree(client, a, true)); await settleModules();
  expect(estimates).toHaveBeenCalledTimes(1); expect(view.container.querySelectorAll('table')).toHaveLength(1);
  expect(view.container.querySelector('#estimate-search')).toBe(input); expect(input.value).toBe('Beta'); expect(document.activeElement).toBe(input);
  await act(async () => { read.resolve([
    { id: 'est_a', projectId: 'proj_1', internalName: 'Alpha', versionLabel: 'V1', createdAt: '2026-10-01', status: 'draft' },
    { id: 'est_b', projectId: 'proj_1', internalName: 'Beta', versionLabel: 'V2', createdAt: '2026-10-01', status: 'draft' },
  ]); await new Promise(resolve => setTimeout(resolve, 10)); });
  expect(view.container.querySelector('table')).toBe(table); expect(view.container.querySelector('thead')).toBe(head); expect(view.container.querySelector('tbody')).toBe(body);
  expect(table?.textContent).toContain('Beta'); expect(table?.textContent).not.toContain('Alpha'); expect(scroll).not.toHaveBeenCalled();
  expect(client.getQueryData(['commercialListView', 'proj_1', 'estimates'])).toBe('Beta'); expect(document.activeElement).toBe(input);
  const old = retiredListPublish!;
  view.rerender(guardedListTree(client, a, false));
  expect(table?.textContent).not.toContain('Beta'); expect(view.container.textContent).not.toContain('Create estimate');
  expect(input.value).toBe('Beta'); expect(view.container.querySelector('#estimate-search')).toBe(input);
  view.rerender(guardedListTree(client, b, true)); await settleModules();
  expect(table?.textContent).toContain('Beta');
  act(() => old(null)); expect(table?.textContent).toContain('Beta');
  view.unmount(); act(() => old({ headerActions: <button>Late command</button>, status: null, render: () => ({ empty: null, noMatches: null, rows: <tr><td>Late private row</td></tr> }) }));
  client.clear(); cached.mockRestore(); scroll.mockRestore(); Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
});

it('adopts a saved neutral filter only after the guarded list owner arrives when the public Find was untouched', async () => {
  search = 'tab=estimates'; estimates.mockResolvedValue([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['commercialListView', 'proj_1', 'estimates'], 'Saved neutral query');
  const owner = {}, view = renderIntoDocument(guardedListTree(client, owner, false));
  const input = view.container.querySelector<HTMLInputElement>('#estimate-search')!;
  expect(input.value).toBe(''); view.rerender(guardedListTree(client, owner, true)); await settleModules();
  expect(view.container.querySelector('#estimate-search')).toBe(input); expect(input.value).toBe('Saved neutral query');
  expect(view.container.textContent).toContain('No estimates yet'); view.unmount(); client.clear();
});


it('consumes only the early scroll veto so a later same-owner editor-to-list return restores the original saved position', async () => {
  search = 'tab=estimates'; estimates.mockResolvedValue([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['commercialListView', 'proj_1', 'active-section'], 'estimates');
  client.setQueryData(['commercialListView', 'proj_1', 'estimates-scroll'], 900);
  const frames: FrameRequestCallback[] = [], raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined), owner = {};
  const view = renderIntoDocument(guardedListTree(client, owner, false));
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 350 }); act(() => window.dispatchEvent(new Event('scroll')));
  view.rerender(guardedListTree(client, owner, true)); await settleModules();
  act(() => frames.splice(0).forEach(frame => frame(0))); expect(scroll).not.toHaveBeenCalled();
  view.rerender(guardedListTree(client, owner, true, false));
  client.setQueryData(['commercialListView', 'proj_1', 'estimates-scroll'], 350);
  view.rerender(guardedListTree(client, owner, true)); await settleModules();
  act(() => frames.splice(0).forEach(frame => frame(0))); expect(scroll).toHaveBeenCalledWith({ top: 350, behavior: 'instant' });
  view.unmount(); client.clear(); raf.mockRestore(); scroll.mockRestore(); Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
});

it('keeps the public list through a genuine guarded read failure and uses its original Retry without an empty success', async () => {
  search = 'tab=estimates'; estimates.mockReset().mockRejectedValueOnce(new Error('Fictional estimates unavailable')).mockResolvedValue([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }), owner = {};
  const view = renderIntoDocument(guardedListTree(client, owner, false)), table = view.container.querySelector('table'), input = view.container.querySelector('#estimate-search');
  view.rerender(guardedListTree(client, owner, true)); await settleModules();
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  expect(table?.textContent).toContain('Estimates unavailable'); expect(view.container.textContent).not.toContain('No estimates yet');
  const retry = [...view.container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Retry')!;
  expect(retry).toBeDefined(); act(() => retry.click()); await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  expect(estimates).toHaveBeenCalledTimes(2); expect(view.container.textContent).toContain('No estimates yet');
  expect(view.container.querySelector('#estimate-search')).toBe(input); expect(view.container.querySelector('table')).toBe(table);
  view.unmount(); client.clear();
});


it('ignores retired public query/adoption callbacks after selecting a different project', () => {
  let current!: ReturnType<typeof useEstimatesListControls>;
  function PublicOnly({ id }: { id: string }) {
    current = useEstimatesListControls(id);
    return <EstimatesListSurface query={current.query} onQueryChange={current.setQuery} evidence={null} />;
  }
  const view = renderIntoDocument(<PublicOnly id="project-a"/>), old = current;
  typeListQuery(view.container.querySelector<HTMLInputElement>('#estimate-search')!, 'A input');
  view.rerender(<PublicOnly id="project-b"/>); const input = view.container.querySelector<HTMLInputElement>('#estimate-search')!;
  typeListQuery(input, 'B input');
  act(() => { old.setQuery('Late A'); old.adoptSavedQuery('Saved A'); old.markInteracted(); old.adopted(); });
  expect(input.value).toBe('B input'); view.unmount();
});
