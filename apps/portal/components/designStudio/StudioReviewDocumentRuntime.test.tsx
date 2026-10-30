import { act, StrictMode,useContext } from 'react';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import {StudioDocumentContext} from './StudioDocumentContext';
import StudioDocumentSlot from './StudioDocumentSlot';
import StudioReviewDocumentPage from './StudioReviewDocumentPage';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import { useStudioEditingSession } from './useStudioEditingSession';
import { invalidateStudioLifecycle } from '@/lib/designStudio/studioLifecycle';
import { stopLocalFirstRuntime } from '@/lib/localFirst/runtime';
import { __resetLocalFirstQueueForTests } from '@/lib/localFirst/queue';
import { __resetLocalFirstStoreForTests, clearLocalFirstStoreOwner, getLocalFirstStoreOwner, getLocalFirstStoreSnapshot, localFirstStorageKey, createEmptyLocalFirstState } from '@/lib/localFirst/store';
import { StudioReviewProtectedFallback } from '@/lib/designStudio/studioReviewOpeningTransport';
import { StudioOpeningAccessError } from '@/lib/designStudio/studioOpeningTransport';
import { STUDIO_OPENING_FIRST_MS } from '@/lib/designStudio/studioOpening';

const mocks = vi.hoisted(() => ({ read: vi.fn(), initialize: vi.fn(), saved: vi.fn(), website: vi.fn(), api: vi.fn(), get: vi.fn(), set: vi.fn(), update: vi.fn(), keys: vi.fn(), del: vi.fn(), role: vi.fn(),
  changed: null as null | ((event: string, session: unknown) => void),sdk:null as SupabaseClient|null }));
vi.mock('next/navigation', () => ({ usePathname: () => location.pathname, useSearchParams: () => new URLSearchParams(location.search), useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('@/lib/designStudio/studioReviewOpeningTransport', async load => ({ ...await load<typeof import('@/lib/designStudio/studioReviewOpeningTransport')>(), readStudioReviewOpening: mocks.read }));
vi.mock('./studioLeafLoading', () => ({ loadSavedStudioReview: mocks.saved, loadStudioWebsiteReview: mocks.website }));
vi.mock('@/lib/queries/auth', () => ({ fetchPortalRole: mocks.role }));
vi.mock('@/lib/supabase/browserClient', () => ({ supabaseRuntimeUrl: () => '', supabaseHostFromUrl: () => '', getSupabaseBrowser: () => mocks.sdk??({ auth: { initialize: mocks.initialize,
  onAuthStateChange: (fn: typeof mocks.changed) => { mocks.changed = fn; return { data: { subscription: { unsubscribe() {} } } }; } } }) }));
vi.mock('@/lib/repo/apiClient', async load => ({ ...await load<typeof import('@/lib/repo/apiClient')>(), apiJson: mocks.api }));
vi.mock('./StudioQuoteDocument',()=>({default:({quote,actorId}:any)=><main data-quote={quote.id} data-quote-actor={actorId}>Frozen quote</main>}));
vi.mock('idb-keyval', () => ({ get: mocks.get, set: mocks.set, update: mocks.update, keys: mocks.keys, del: mocks.del }));
const actor = '10000000-0000-4000-8000-000000000001', other = '10000000-0000-4000-8000-000000000002';
const projectId = 'proj_20000000-0000-4000-8000-000000000001', estimateId = 'est_30000000-0000-4000-8000-000000000001';
const callback = `/staff/design-studio/${projectId}/${estimateId}`;
const view: any = { schemaVersion: 'studio_authoring_view.v1', designId: 'design', revision: 1, spatial: { houseAssembly: null, decks: [], openings: [], pergolas: [] }, site: { access: 'normal' }, objectOptions: [], pricing: 'unpriced' };
const response = (actorId = actor) => ({ kind: 'review', scope: { actorId, role: 'staff', projectId, estimateId }, quoteVersionId: null, presentation: { theme: { '--portal-accent': '#123456' } },
  response: { review: { estimate: { id: estimateId, projectId, versionLabel: 'V1', updatedAt: '2026-10-20T00:00:00Z' }, websiteComposition: view } } });
function deferred<T = void>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
let currentFrame:import('react').ContextType<typeof StudioDocumentContext>;
let latest: ReturnType<typeof useStudioEditingSession>, db: Map<string, unknown>, mounted: ReturnType<typeof renderIntoDocument> | undefined;
function Website({ review, actorId }: any) {
  currentFrame=useContext(StudioDocumentContext);
  const auth = usePortalSession();
  latest = useStudioEditingSession({ scope: { actorId, projectId, estimateId, designId:view.designId }, view: review.websiteComposition, updatedAt: review.estimate.updatedAt, editable:true });
  return <main data-review data-role={auth.role}><input aria-label="Site input" value={String(latest.edit?.site.access ?? '')} readOnly /></main>;
}
const flush = async () => { await act(async () => { await new Promise(r => setTimeout(r, 1)); }); };
const tree = (key = 'page') => <StudioDocumentSlot callback={callback}><StudioReviewDocumentPage key={key} callback={callback} projectId={projectId} estimateId={estimateId} /></StudioDocumentSlot>;
beforeEach(() => {
  vi.clearAllMocks(); mocks.changed = null;mocks.sdk=null; __resetLocalFirstQueueForTests(); stopLocalFirstRuntime({ clearOwner: true }); __resetLocalFirstStoreForTests(); invalidateStudioLifecycle(); db = new Map(); history.replaceState({}, '', callback);
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: async (_name: string, _options: unknown, fn: (value: unknown) => unknown) => fn({}) } });
  mocks.initialize.mockResolvedValue({ error: null }); mocks.read.mockResolvedValue(response()); mocks.website.mockResolvedValue(Website); mocks.saved.mockResolvedValue(() => <p>Saved review</p>); mocks.role.mockResolvedValue('admin'); mocks.api.mockResolvedValue({});
  mocks.get.mockImplementation(async key => structuredClone(db.get(key))); mocks.keys.mockImplementation(async () => [...db.keys()]); mocks.del.mockImplementation(async key => db.delete(key)); mocks.set.mockImplementation(async (key, value) => db.set(key, structuredClone(value)));
  mocks.update.mockImplementation(async (key, fn) => db.set(key, structuredClone(fn(structuredClone(db.get(key))))));
});
afterEach(() => { mounted?.unmount(); mounted = undefined; stopLocalFirstRuntime({ clearOwner: true }); __resetLocalFirstQueueForTests(); clearLocalFirstStoreOwner(); invalidateStudioLifecycle(); vi.useRealTimers();vi.unstubAllGlobals(); });

it('issues the fresh Review before public leaf preloads and mounts no real actor/store before admission', async () => {
  const first = deferred<any>(); mocks.read.mockReturnValue(first.promise); mounted = renderIntoDocument(tree()); await flush();
  expect(mocks.read).toHaveBeenCalledOnce(); expect(mocks.read.mock.invocationCallOrder[0]).toBeLessThan(mocks.website.mock.invocationCallOrder[0]);
  expect(mocks.get).not.toHaveBeenCalled(); expect(getLocalFirstStoreOwner()).toBeNull(); expect(document.querySelector('[data-review]')).toBeNull(); expect(mocks.api).not.toHaveBeenCalled();
  act(() => mocks.changed?.('INITIAL_SESSION', { user: { id: other } }));
  await act(async () => first.resolve(response())); await flush();
  expect(getLocalFirstStoreOwner()).toBe(actor); expect(document.querySelector('[data-role]')?.getAttribute('data-role')).toBe('staff'); expect(mocks.role).not.toHaveBeenCalled(); expect(mocks.api).not.toHaveBeenCalled(); expect(latest.canEdit).toBe(true);
  act(() => mounted!.rerender(tree('remounted'))); await flush(); expect(mocks.read).toHaveBeenCalledOnce();
});

it('reuses the same installed Frame through Strict replay and held SDK readiness', async () => {
  const initialize = deferred(); mocks.initialize.mockReturnValue(initialize.promise); mounted = renderIntoDocument(<StrictMode>{tree()}</StrictMode>); await flush();
  expect(mocks.read).not.toHaveBeenCalled(); expect(mocks.website).not.toHaveBeenCalled(); expect(mocks.get).not.toHaveBeenCalled();
  await act(async () => initialize.resolve()); await flush(); expect(mocks.read).toHaveBeenCalledOnce(); expect(getLocalFirstStoreOwner()).toBe(actor);
});

it('bounds a hung Review and retries one live turn without a second loader API', async () => {
  vi.useFakeTimers(); const first = deferred<any>(); mocks.read.mockReturnValueOnce(first.promise).mockResolvedValueOnce(response());
  mounted = renderIntoDocument(tree()); await act(async () => vi.advanceTimersByTimeAsync(1));
  const old = mocks.read.mock.calls[0][2] as AbortSignal; await act(async () => vi.advanceTimersByTimeAsync(STUDIO_OPENING_FIRST_MS));
  expect(old.aborted).toBe(true); expect(document.querySelector('[role="alert"]')).not.toBeNull();
  act(() => (document.querySelector('[role="alert"] button') as HTMLButtonElement).click()); await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(mocks.read).toHaveBeenCalledTimes(2); expect(getLocalFirstStoreOwner()).toBe(actor); await act(async () => first.resolve(response(other))); expect(getLocalFirstStoreOwner()).toBe(actor); expect(mocks.api).not.toHaveBeenCalled();
});

it('fences pagehide, drains accepted local writes under the same actor and restores exact input history freshly', async () => {
  mounted = renderIntoDocument(tree()); await flush(); expect(latest.canEdit).toBe(true);
  const hold = deferred(), update = mocks.update.getMockImplementation()!; mocks.update.mockImplementationOnce(async (key, fn) => { await hold.promise; return update(key, fn); });
  act(() => { const edit = structuredClone(latest.edit!); edit.site.access = 'hard'; latest.change(edit); });
  act(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))); expect(getLocalFirstStoreOwner()).toBe(actor); expect(document.querySelector('[data-review]')).toBeNull();
  act(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))); await flush(); expect(getLocalFirstStoreOwner()).toBe(actor); expect(document.querySelector('[data-review]')).toBeNull();
  await act(async () => hold.resolve()); await flush(); expect(latest.edit?.site.access).toBe('hard'); expect(latest.canUndo).toBe(true); expect(mocks.read).toHaveBeenCalledTimes(2); expect(mocks.api).not.toHaveBeenCalled();
  act(() => latest.undo()); await flush(); expect(latest.edit?.site.access).toBe('normal');
});

it('retires A to null/B to A responses without ordinary outbound replay or stale actor data', async () => {
  const state = createEmptyLocalFirstState(); state.queue = [{ id: 'retained', entityKey: 'project:note', mutationKey: 'project.note.delete', payload: { projectId, noteId: 'note' }, status: 'queued', attempts: 0, enqueuedAt: '2026-10-26', updatedAt: '2026-10-26' }]; db.set(localFirstStorageKey(actor), state);
  mounted = renderIntoDocument(tree()); await flush(); const old = deferred<any>(), fresh = deferred<any>(); mocks.read.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
  act(() => mocks.changed?.('SIGNED_OUT', null)); await flush(); expect(document.querySelector('[data-review]')).toBeNull();
  act(() => mocks.changed?.('SIGNED_IN', { user: { id: other } })); await flush();
  await act(async () => old.resolve(response(other))); expect(document.querySelector('[data-review]')).toBeNull();
  await act(async () => fresh.resolve(response(actor))); await flush(); expect(getLocalFirstStoreOwner()).toBe(actor); expect(mocks.api).not.toHaveBeenCalled(); expect(getLocalFirstStoreSnapshot().state.queue).toEqual(state.queue);
});

it('keeps old data withdrawn on fresh-role denial and does not load code on a retained ordinary root', async () => {
  mounted = renderIntoDocument(tree()); await flush(); mocks.read.mockRejectedValueOnce(new StudioOpeningAccessError('no_access'));
  act(() => mocks.changed?.('USER_UPDATED', { user: { id: actor } })); await flush(); expect(document.querySelector('[data-review]')).toBeNull(); expect(mocks.api).not.toHaveBeenCalled();
  mounted.unmount(); mounted = undefined; mocks.read.mockClear(); mocks.website.mockClear(); mocks.get.mockClear(); clearLocalFirstStoreOwner();
  mounted = renderIntoDocument(<StudioReviewDocumentPage callback={callback} projectId={projectId} estimateId={estimateId} />); await flush();
  expect(mocks.read).not.toHaveBeenCalled(); expect(mocks.website).not.toHaveBeenCalled(); expect(mocks.get).not.toHaveBeenCalled();
});

it('keeps a failed content leaf recoverable without refetching the admitted Review or changing source', async () => {
  mocks.website.mockResolvedValue(null); mounted = renderIntoDocument(tree()); await flush();
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('design review could not be opened');
  mocks.website.mockResolvedValue(Website); act(() => (document.querySelector('[role="alert"] button') as HTMLButtonElement).click()); await flush();
  expect(document.querySelector('[data-review]')).not.toBeNull(); expect(mocks.read).toHaveBeenCalledOnce(); expect(mocks.api).not.toHaveBeenCalled();
});

it('withholds changed quote/private soft children while the same local owner drains', async () => {
  mounted = renderIntoDocument(tree()); await flush(); const hold = deferred(), update = mocks.update.getMockImplementation()!;
  mocks.update.mockImplementationOnce(async (key, fn) => { await hold.promise; return update(key, fn); });
  act(() => { const edit = structuredClone(latest.edit!); edit.site.access = 'hard'; latest.change(edit); });
  const privateMount = vi.fn(); function OtherQuote() { privateMount(); return <p>Different quote</p>; }
  history.replaceState({}, '', callback + '?quoteVersionId=qv_40000000-0000-4000-8000-000000000001');
  act(() => mounted!.rerender(<StudioDocumentSlot callback={callback}><OtherQuote /></StudioDocumentSlot>));
  expect(privateMount).not.toHaveBeenCalled(); expect(getLocalFirstStoreOwner()).toBe(actor); expect(mocks.read).toHaveBeenCalledOnce();
  await act(async () => hold.resolve()); await flush(); expect(mocks.api).not.toHaveBeenCalled(); expect(getLocalFirstStoreOwner()).toBe(actor);
});

it('waits through real SDK recovery after pagehide, then admits the server actor once without provider calls',async()=>{
 const storage=deferred(),first=deferred<any>(),network=vi.fn(()=>{throw Error('No provider calls in this test.');});vi.stubGlobal('BroadcastChannel',undefined);
 const session={access_token:'synthetic-access-token',refresh_token:'synthetic-refresh-token',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:other}};
 const sdk=createClient('https://sdk-review.invalid','synthetic-public-key',{global:{fetch:network},auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'review-startup',storage:{getItem:async()=>{await storage.promise;return JSON.stringify(session);},setItem:async()=>{},removeItem:async()=>{}}}});mocks.sdk=sdk;mocks.read.mockReturnValue(first.promise);
 mounted=renderIntoDocument(tree());await flush();act(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));await act(async()=>storage.resolve());await sdk.auth.initialize();await flush();expect(mocks.read).not.toHaveBeenCalled();expect(mocks.get).not.toHaveBeenCalled();
 act(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await flush();expect(mocks.read).toHaveBeenCalledOnce();await act(async()=>first.resolve(response(actor)));await flush();expect(getLocalFirstStoreOwner()).toBe(actor);expect(network).not.toHaveBeenCalled();expect(mocks.role).not.toHaveBeenCalled();
});

it('renders only the exact quote from the fresh full-callback response without a duplicate Review API',async()=>{
 const quoteVersionId='qv_40000000-0000-4000-8000-000000000001',quoted=callback+'?quoteVersionId='+quoteVersionId,value:any=response();value.quoteVersionId=quoteVersionId;value.response.review.quote={id:quoteVersionId};value.response.quoteDocument={id:quoteVersionId,projectId,sourceEstimateVersionId:estimateId};mocks.read.mockResolvedValue(value);history.replaceState({},'',quoted);
 mounted=renderIntoDocument(<StudioDocumentSlot callback={quoted}><StudioReviewDocumentPage callback={quoted} projectId={projectId} estimateId={estimateId} quoteVersionId={quoteVersionId}/></StudioDocumentSlot>);await flush();await flush();
 expect(mocks.read).toHaveBeenCalledOnce();expect(mocks.read.mock.calls[0][0]).toContain('?quoteVersionId='+quoteVersionId);expect(mocks.read.mock.calls[0][1]).toEqual({projectId,estimateId,quoteVersionId});expect(document.querySelector('[data-quote]')?.getAttribute('data-quote')).toBe(quoteVersionId);expect(document.querySelector('[data-quote-actor]')?.getAttribute('data-quote-actor')).toBe(actor);expect(mocks.api).not.toHaveBeenCalled();expect(mocks.website).not.toHaveBeenCalled();
});


it('keeps protected size fallback recoverable when the same owner local drain fails',async()=>{
 mounted=renderIntoDocument(tree());await flush();expect(latest.canEdit).toBe(true);
 mocks.update.mockRejectedValue(Error('Storage temporarily unavailable.'));
 act(()=>{const edit=structuredClone(latest.edit!);edit.site.access='hard';latest.change(edit);});await flush();
 mocks.read.mockRejectedValueOnce(new StudioReviewProtectedFallback());
 act(()=>mocks.changed?.('USER_UPDATED',{user:{id:actor}}));await flush();await flush();
 expect(getLocalFirstStoreOwner()).toBe(actor);expect(document.querySelector('[data-review]')).toBeNull();
 expect(document.querySelector('[role="alert"]')?.textContent).toContain('could not be stored on this device');
 expect(document.querySelector('[role="alert"] button')?.textContent).toBe('Try again');
 mocks.update.mockImplementation(async(key,fn)=>db.set(key,structuredClone(fn(structuredClone(db.get(key))))));
 mocks.read.mockResolvedValue(response());act(()=>(document.querySelector('[role="alert"] button') as HTMLButtonElement).click());await flush();await flush();
 expect(document.querySelector('[data-review]')).not.toBeNull();expect(latest.edit?.site.access).toBe('hard');expect(latest.canUndo).toBe(true);expect(mocks.api).not.toHaveBeenCalled();
});

it('adopts only this completed quote without abort/remount/refetch, then freshly reopens its canonical URL',async()=>{
 mounted=renderIntoDocument(tree());await flush();const lifetime=mocks.read.mock.calls[0][2] as AbortSignal;
 const requestId='50000000-0000-4000-8000-000000000001',quoteVersionId='qv_40000000-0000-4000-8000-000000000001';
 const quote:any={id:quoteVersionId,projectId,sourceEstimateVersionId:estimateId,studioDesign:{schemaVersion:'studio_quote_snapshot.v2',snapshotId:requestId,contentHash:'a'.repeat(64)}};
 const input={actorId:actor,requestId,quote};
 expect(()=>currentFrame!.adoptCommittedQuote!({...input,actorId:other})).toThrow();
 expect(()=>currentFrame!.adoptCommittedQuote!({...input,quote:{...quote,sourceEstimateVersionId:'est_other'}})).toThrow();
 expect(()=>currentFrame!.adoptCommittedQuote!({...input,quote:{...quote,studioDesign:{...quote.studioDesign,snapshotId:'other'}}})).toThrow();
 expect(location.search).toBe('');
 let command:any;await act(async()=>{command=await latest.beginQuote(requestId);});
 await act(async()=>{await latest.finishQuote(command,{saveReceipt:{revision:2,savedAt:'2026-10-28T00:00:01Z',alreadyExisted:false},savedView:{...view,revision:2},sourceUpdatedAt:'2026-10-28T00:00:02Z'});});
 await act(async()=>{currentFrame!.adoptCommittedQuote!(input);mounted!.rerender(tree());});await flush();
 expect(location.pathname+location.search).toBe(callback+'?quoteVersionId='+quoteVersionId);expect(lifetime.aborted).toBe(false);expect(mocks.read).toHaveBeenCalledOnce();expect(document.querySelector('[data-review]')).not.toBeNull();expect(mocks.api).not.toHaveBeenCalled();
 const fresh:any=response();fresh.quoteVersionId=quoteVersionId;fresh.response.review.quote={id:quoteVersionId};fresh.response.quoteDocument=quote;mocks.read.mockResolvedValue(fresh);
 act(()=>mocks.changed?.('USER_UPDATED',{user:{id:actor}}));await flush();await flush();
 expect(lifetime.aborted).toBe(true);expect(mocks.read).toHaveBeenCalledTimes(2);expect(mocks.read.mock.calls[1][0]).toContain('?quoteVersionId='+quoteVersionId);expect(document.querySelector('[data-quote]')?.getAttribute('data-quote')).toBe(quoteVersionId);expect(mocks.api).not.toHaveBeenCalled();
 mounted!.unmount();history.replaceState({},'',callback+'?quoteVersionId='+quoteVersionId);
 mounted=renderIntoDocument(<StudioDocumentSlot callback={location.pathname+location.search}><StudioReviewDocumentPage callback={location.pathname+location.search} projectId={projectId} estimateId={estimateId} quoteVersionId={quoteVersionId}/></StudioDocumentSlot>);await flush();await flush();
 expect(mocks.read).toHaveBeenCalledTimes(3);expect(document.querySelector('[data-quote]')?.getAttribute('data-quote')).toBe(quoteVersionId);expect(mocks.api).not.toHaveBeenCalled();
});
