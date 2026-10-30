import {act,StrictMode,Suspense,useContext,useLayoutEffect,useRef} from 'react';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../test/reactHarness';
import StudioDocument from './StudioDocument';
import {StudioDocumentContext} from './StudioDocumentContext';
import StudioDocumentSlot from './StudioDocumentSlot';
import StudioDocumentPage from './StudioDocumentPage';
import PortalAuthProvider from '@/components/auth/PortalAuthProvider';
import {Providers} from '@/app/providers';
import {StudioOpeningAccessError} from '@/lib/designStudio/studioOpeningTransport';
import {STUDIO_OPENING_FIRST_MS} from '@/lib/designStudio/studioOpening';
import {navigateStudioDocument} from '@/lib/designStudio/studioDocumentNavigation';
import {useStudioEditingSession,type StudioEditingSessionProps} from './useStudioEditingSession';
import {clearLocalFirstStoreOwner,getLocalFirstStoreOwner,getLocalFirstStoreSnapshot,localFirstStorageKey,createEmptyLocalFirstState,__resetLocalFirstStoreForTests} from '@/lib/localFirst/store';
import {enqueueAndProcessLocalFirstMutation,__resetLocalFirstQueueForTests} from '@/lib/localFirst/queue';
import {stopLocalFirstRuntime} from '@/lib/localFirst/runtime';
import {invalidateStudioLifecycle} from '@/lib/designStudio/studioLifecycle';
import {PORTAL_LOCAL_FIRST_MUTATIONS} from '@/lib/localFirst/portalEntities';
import {readStudioWorkingCopy} from '@/lib/designStudio/workingCopy';

const mocks=vi.hoisted(()=>({opening:vi.fn(),initialize:vi.fn(),sdk:null as SupabaseClient|null,leaf:vi.fn(),get:vi.fn(),set:vi.fn(),update:vi.fn(),keys:vi.fn(),del:vi.fn(),api:vi.fn(),editorBarrier:null as Promise<void>|null,cleanupProbe:null as null|(()=>void),authChanged:null as null|((event:string,session:unknown)=>void)}));
vi.mock('next/navigation',()=>({usePathname:()=>location.pathname,useSearchParams:()=>new URLSearchParams(location.search),useRouter:()=>({replace:vi.fn()})}));
vi.mock('@/lib/designStudio/studioOpeningTransport',async load=>({...await load<typeof import('@/lib/designStudio/studioOpeningTransport')>(),readStudioOpening:mocks.opening}));
vi.mock('./studioLeafLoading',()=>({loadStudioEditor:mocks.leaf}));
vi.mock('@/lib/supabase/browserClient',()=>({supabaseRuntimeUrl:()=>'',supabaseHostFromUrl:()=>'',getSupabaseBrowser:()=>mocks.sdk??({auth:{initialize:mocks.initialize,onAuthStateChange:(fn:typeof mocks.authChanged)=>{mocks.authChanged=fn;return{data:{subscription:{unsubscribe(){}}}};}}})}));
vi.mock('@/lib/repo/apiClient',async load=>({...await load<typeof import('@/lib/repo/apiClient')>(),apiJson:mocks.api}));
vi.mock('idb-keyval',()=>({get:mocks.get,set:mocks.set,update:mocks.update,keys:mocks.keys,del:mocks.del}));
const actor='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',projectId='proj_20000000-0000-4000-8000-000000000001',estimateId='est_30000000-0000-4000-8000-000000000001';
const callback=`/staff/design-studio/${projectId}/${estimateId}/edit`;
const view:StudioEditingSessionProps['view']={schemaVersion:'studio_authoring_view.v1',designId:'design',revision:1,spatial:{houseAssembly:null,decks:[],openings:[],pergolas:[]},site:{access:'normal'},objectOptions:[],pricing:'unpriced'};
const authoring={state:'ready',estimate:{id:estimateId,projectId,versionLabel:'V1',updatedAt:'2026-10-20T00:00:00Z',requiresNewRevision:false},view,nextAction:'edit',reason:null};
const response=(actorId=actor)=>({scope:{actorId,role:'staff',projectId,estimateId},authoring});
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return{promise,resolve};};
let latest:ReturnType<typeof useStudioEditingSession>,db:Map<string,unknown>,mounted:ReturnType<typeof renderIntoDocument>|undefined;
function Editor(props:StudioEditingSessionProps){useLayoutEffect(()=>()=>{mocks.cleanupProbe?.();},[]);const ready=useRef(false);if(!ready.current&&mocks.editorBarrier)throw mocks.editorBarrier;ready.current=true;latest=useStudioEditingSession(props);return <main data-editor data-status={latest.status}/>;}
beforeEach(()=>{
 __resetLocalFirstQueueForTests();stopLocalFirstRuntime({clearOwner:true});__resetLocalFirstStoreForTests();invalidateStudioLifecycle();vi.clearAllMocks();mocks.editorBarrier=null;mocks.cleanupProbe=null;mocks.authChanged=null;mocks.sdk=null;mocks.initialize.mockResolvedValue({error:null});db=new Map();history.replaceState({},'',callback);
 Object.defineProperty(navigator,'onLine',{configurable:true,value:true});Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(name:string,_options:unknown,fn:(lock:unknown)=>unknown)=>fn({name})}});
 mocks.leaf.mockResolvedValue(Editor);mocks.opening.mockResolvedValue(response());mocks.api.mockResolvedValue({ok:true});
 mocks.get.mockImplementation(async key=>structuredClone(db.get(key)));mocks.keys.mockImplementation(async()=>[...db.keys()]);mocks.del.mockImplementation(async key=>db.delete(key));mocks.set.mockImplementation(async(key,value)=>{db.set(key,structuredClone(value));});mocks.update.mockImplementation(async(key,fn)=>{db.set(key,structuredClone(fn(structuredClone(db.get(key)))));});
});
afterEach(()=>{mounted?.unmount();mounted=undefined;stopLocalFirstRuntime({clearOwner:true});__resetLocalFirstQueueForTests();invalidateStudioLifecycle();clearLocalFirstStoreOwner();vi.unstubAllGlobals();vi.useRealTimers();});
const flush=async()=>{await act(async()=>{await new Promise(resolve=>setTimeout(resolve,1));});};
const open=async()=>{mounted=renderIntoDocument(<Suspense fallback={<p>Waiting for editor</p>}><StudioDocument callback={callback}><StudioDocumentPage callback={callback}/></StudioDocument></Suspense>);await flush();expect(latest.canEdit).toBe(true);};

it('preloads the page-local module but mounts no real actor provider/storage runtime before its fresh API frame',async()=>{
 const first=deferred();mocks.opening.mockImplementationOnce(()=>first.promise.then(()=>response()));
 mounted=renderIntoDocument(<StudioDocument callback={callback}><StudioDocumentPage callback={callback}/></StudioDocument>);await flush();
 expect(mocks.leaf).toHaveBeenCalledOnce();expect(mocks.get).not.toHaveBeenCalled();expect(getLocalFirstStoreOwner()).toBeNull();expect(mocks.api).not.toHaveBeenCalled();
 await act(async()=>first.resolve());await flush();expect(getLocalFirstStoreOwner()).toBe(actor);expect(latest.canEdit).toBe(true);
});

it('does not admit a late frame after its URL is abandoned before the route effect can run',async()=>{
 const first=deferred();mocks.opening.mockImplementationOnce(()=>first.promise.then(()=>response()));mounted=renderIntoDocument(<StudioDocument callback={callback}><StudioDocumentPage callback={callback}/></StudioDocument>);await flush();
 history.replaceState({},'','/staff/projects');await act(async()=>first.resolve());await flush();
 expect(getLocalFirstStoreOwner()).toBeNull();expect(mocks.get).not.toHaveBeenCalled();expect(mocks.api).not.toHaveBeenCalled();
});

it('keeps retained ordinary commands local while accepted work is held across fresh actor admission',async()=>{
 await open();const local=deferred(),working=deferred(),fresh=deferred();let localHeld=false,workingHeld=false;
 const set=mocks.set.getMockImplementation()!,update=mocks.update.getMockImplementation()!;
 mocks.set.mockImplementation(async(key,value)=>{if(String(key).includes('local-first:v2:')&&value.queue.length){localHeld=true;await local.promise;}return set(key,value);});
 mocks.update.mockImplementation(async(key,fn)=>{if(String(key).includes('studio-working-copy')){workingHeld=true;await working.promise;}return update(key,fn);});
 let queued!:Promise<unknown>;act(()=>{queued=enqueueAndProcessLocalFirstMutation({entityKey:'project:note',mutationKey:PORTAL_LOCAL_FIRST_MUTATIONS.projectNoteDelete,payload:{projectId,noteId:'note'}});});await flush();expect(localHeld).toBe(true);
 const retained=structuredClone(getLocalFirstStoreSnapshot().state);expect(retained.queue[0]).toMatchObject({status:'queued',attempts:0});
 act(()=>{const edit=structuredClone(latest.edit!);edit.site.access='hard';latest.change(edit);});await flush();expect(workingHeld).toBe(true);
 mocks.opening.mockImplementationOnce(()=>fresh.promise.then(()=>response(other)));
 act(()=>mocks.authChanged?.('SIGNED_IN',{user:{id:other}}));expect(getLocalFirstStoreOwner()).toBe(actor);expect(latest.canEdit).toBe(false);
 await act(async()=>{local.resolve();working.resolve();await queued;});await flush();
 expect(mocks.api).not.toHaveBeenCalled();expect(getLocalFirstStoreOwner()).toBe(actor);
 await act(async()=>fresh.resolve());await flush();expect(getLocalFirstStoreOwner()).toBe(other);
 expect(db.get(localFirstStorageKey(actor))).toEqual(retained);expect(getLocalFirstStoreSnapshot().state.queue).toEqual([]);
});

it('preserves queued and previously syncing ordinary payloads/statuses/aliases across first admission and pagehide/fresh same-actor return',async()=>{
 const state=createEmptyLocalFirstState();state.queue=[{id:'ordinary-queued',entityKey:'project:note',mutationKey:PORTAL_LOCAL_FIRST_MUTATIONS.projectNoteDelete,payload:{projectId,noteId:'note'},status:'queued',attempts:0,enqueuedAt:'2026-10-26T00:00:00Z',updatedAt:'2026-10-26T00:00:00Z'},{id:'ordinary-unconfirmed',entityKey:'project:other',mutationKey:PORTAL_LOCAL_FIRST_MUTATIONS.projectNoteDelete,payload:{projectId,noteId:'other'},status:'syncing',attempts:1,enqueuedAt:'2026-10-26T00:00:00Z',updatedAt:'2026-10-26T00:00:00Z'}];state.idAliases={'local-note':'note'};db.set(localFirstStorageKey(actor),structuredClone(state));
 await open();expect(mocks.api).not.toHaveBeenCalled();expect(getLocalFirstStoreSnapshot().state).toEqual(state);
 act(()=>{const edit=structuredClone(latest.edit!);edit.site.access='hard';latest.change(edit);});await flush();
 act(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));expect(latest.canEdit).toBe(false);
 act(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await flush();
 expect(latest.edit?.site.access).toBe('hard');expect(latest.canUndo).toBe(true);expect(mocks.opening).toHaveBeenCalledTimes(2);expect(mocks.api).not.toHaveBeenCalled();
 expect(getLocalFirstStoreSnapshot().state).toEqual(state);expect(db.get(localFirstStorageKey(actor))).toEqual(state);
 act(()=>latest.undo());await flush();expect(latest.edit?.site.access).toBe('normal');
});

it.each(['SIGNED_OUT','SIGNED_IN'])('retires a response across A to %s to A even while the hidden admitted provider still belongs to A',async event=>{
 await open();const denied=deferred();mocks.opening.mockImplementationOnce(()=>denied.promise.then(()=>response(other)));mocks.opening.mockResolvedValueOnce(response());
 act(()=>mocks.authChanged?.(event,event==='SIGNED_OUT'?null:{user:{id:other}}));await flush();expect(latest.canEdit).toBe(false);
 act(()=>mocks.authChanged?.('SIGNED_IN',{user:{id:actor}}));await flush();expect(mocks.opening).toHaveBeenCalledTimes(3);
 await act(async()=>denied.resolve());await flush();expect(getLocalFirstStoreOwner()).toBe(actor);expect(latest.canEdit).toBe(true);expect(mocks.api).not.toHaveBeenCalled();
});

it.each(['pending','denied','navigation'])('retains a staged own Save but never dispatches it after %s withdrawal during IDB staging',async cause=>{
 await open();act(()=>{const edit=structuredClone(latest.edit!);edit.site.access='hard';latest.change(edit);});await flush();
 const staged=deferred(),fresh=deferred(),update=mocks.update.getMockImplementation()!;let held=false;
 mocks.update.mockImplementation(async(key,fn)=>{if(String(key).startsWith('sanctuary-studio-pending:')){held=true;await staged.promise;}return update(key,fn);});
 let saving!:Promise<void>;act(()=>{saving=latest.save();});await flush();expect(held).toBe(true);
 const expected=structuredClone(latest.session!.pending!.command);
 if(cause==='navigation')await act(async()=>navigateStudioDocument('/staff/projects',false,vi.fn()));
 else{if(cause==='denied')mocks.opening.mockRejectedValueOnce(new StudioOpeningAccessError('no_access'));else mocks.opening.mockImplementationOnce(()=>fresh.promise.then(()=>response(other)));act(()=>mocks.authChanged?.('SIGNED_IN',{user:{id:other}}));await flush();}
 await act(async()=>{staged.resolve();await saving;});expect(mocks.api).not.toHaveBeenCalled();
 const retained=[...db].find(([key])=>key.startsWith('sanctuary-studio-pending:'))![1] as {body:string;receipt:unknown};expect(JSON.parse(retained.body)).toEqual(expected);expect(retained.receipt).toBeNull();
});

it('keeps the old-controller dispatch fence while a newly admitted render is suspended before commit',async()=>{
 await open();act(()=>{const edit=structuredClone(latest.edit!);edit.site.access='hard';latest.change(edit);});await flush();
 const stage=deferred(),render=deferred(),update=mocks.update.getMockImplementation()!;let held=false;
 mocks.update.mockImplementation(async(key,fn)=>{if(String(key).startsWith('sanctuary-studio-pending:')){held=true;await stage.promise;}return update(key,fn);});
 let saving!:Promise<void>;act(()=>{saving=latest.save();});await flush();expect(held).toBe(true);
 mocks.editorBarrier=render.promise;act(()=>mocks.authChanged?.('USER_UPDATED',{user:{id:actor}}));await flush();
 expect(mocks.opening).toHaveBeenCalledTimes(2);await act(async()=>{stage.resolve();await saving;});expect(mocks.api).not.toHaveBeenCalled();
 mocks.editorBarrier=null;await act(async()=>render.resolve());await flush();expect(getLocalFirstStoreOwner()).toBe(actor);expect(mocks.api).not.toHaveBeenCalled();
});

it('withholds an unknown soft child at render while its detached editor drains under the retained provider owner',async()=>{
 await open();const hold=deferred(),update=mocks.update.getMockImplementation()!;mocks.update.mockImplementationOnce(async(key,fn)=>{await hold.promise;return update(key,fn);});
 act(()=>{const edit=structuredClone(latest.edit!);edit.site.access='hard';latest.change(edit);});
 const privateMount=vi.fn();function Private(){privateMount();return <p>Private ordinary route</p>;}
 history.replaceState({},'','/staff/projects');act(()=>mounted!.rerender(<Suspense fallback={<p>Waiting for editor</p>}><StudioDocument callback={callback}><Private/></StudioDocument></Suspense>));
 expect(privateMount).not.toHaveBeenCalled();expect(getLocalFirstStoreOwner()).toBe(actor);
 await act(async()=>hold.resolve());await flush();expect(await readStudioWorkingCopy({actorId:actor,projectId,estimateId,designId:'design'})).toMatchObject({state:'valid',session:{edit:{site:{access:'hard'}}}});expect(mocks.api).not.toHaveBeenCalled();
});

it('uses a native boundary on a retained ordinary root, without starting opening, actor storage or editor preload',async()=>{
 mounted=renderIntoDocument(<StudioDocumentPage callback={callback}/>);await flush();
 expect(mocks.opening).not.toHaveBeenCalled();expect(mocks.leaf).not.toHaveBeenCalled();expect(mocks.get).not.toHaveBeenCalled();expect(getLocalFirstStoreOwner()).toBeNull();expect(mocks.api).not.toHaveBeenCalled();
});

it('keeps normal Portal Providers default outbound behavior for its freshly admitted ordinary document',async()=>{
 const state=createEmptyLocalFirstState();state.queue=[{id:'normal-queued',entityKey:'project:note',mutationKey:PORTAL_LOCAL_FIRST_MUTATIONS.projectNoteDelete,payload:{projectId,noteId:'note'},status:'queued',attempts:0,enqueuedAt:'2026-10-26T00:00:00Z',updatedAt:'2026-10-26T00:00:00Z'}];db.set(localFirstStorageKey(actor),state);
 mounted=renderIntoDocument(<PortalAuthProvider requestAdmission={{state:{status:'authenticated',user:{id:actor,email:null},role:'staff'},invalidate:vi.fn()}}><Providers><main>Ordinary document</main></Providers></PortalAuthProvider>);await flush();
 expect(mocks.api).toHaveBeenCalledOnce();expect(getLocalFirstStoreSnapshot().state.queue).toEqual([]);
});


it('fences a staged own Save during unknown-route layout cleanup before promise continuations',async()=>{
 await open();act(()=>{const edit=structuredClone(latest.edit!);edit.site.access='hard';latest.change(edit);});await flush();
 const stage=deferred(),update=mocks.update.getMockImplementation()!;let held=false,released=false;
 mocks.update.mockImplementation(async(key,fn)=>{if(String(key).startsWith('sanctuary-studio-pending:')){held=true;await stage.promise;}return update(key,fn);});
 let saving!:Promise<void>;act(()=>{saving=latest.save();});await flush();expect(held).toBe(true);
 const expected=structuredClone(latest.session!.pending!.command);
 mocks.cleanupProbe=()=>{released=true;stage.resolve();};
 const privateMount=vi.fn();function Private(){privateMount();return <p>Unknown private route</p>;}
 // An ordinary concurrent navigation must expose the real commit-to-passive
 // interval. act/flushSync would drain both phases and hide the race.
 (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=false;
 try {
  history.replaceState({},'','/staff/projects');mounted!.root.render(<Suspense fallback={<p>Waiting</p>}><StudioDocument callback={callback}><Private/></StudioDocument></Suspense>);
  await new Promise(resolve=>setTimeout(resolve,40));await saving;
 } finally {(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;}
 expect(released).toBe(true);expect(privateMount).not.toHaveBeenCalled();expect(mocks.api).not.toHaveBeenCalled();expect(getLocalFirstStoreOwner()).toBe(actor);
 const retained=[...db].find(([key])=>key.startsWith('sanctuary-studio-pending:'))![1] as {body:string;receipt:unknown};expect(JSON.parse(retained.body)).toEqual(expected);expect(retained.receipt).toBeNull();
});


it('installs one page-local frame and keeps one opening across installer remounts',async()=>{
 mocks.opening.mockImplementation(async()=>{expect(mocks.authChanged).not.toBeNull();return response();});
 mounted=renderIntoDocument(<StudioDocumentSlot callback={callback}><StudioDocumentPage key="first" callback={callback}/></StudioDocumentSlot>);await flush();await flush();
 expect(mocks.opening).toHaveBeenCalledOnce();expect(latest.canEdit).toBe(true);expect(getLocalFirstStoreOwner()).toBe(actor);
 act(()=>mounted!.rerender(<StudioDocumentSlot callback={callback}><StudioDocumentPage key="remounted" callback={callback}/></StudioDocumentSlot>));await flush();
 expect(mocks.opening).toHaveBeenCalledOnce();expect(getLocalFirstStoreOwner()).toBe(actor);
});

it('withholds an unknown pre-install child before storage or opening',async()=>{
 history.replaceState({},'','/staff/projects');const privateMount=vi.fn();function Private(){privateMount();return <p>Private ordinary route</p>;}
 mounted=renderIntoDocument(<StudioDocumentSlot callback={callback}><Private/></StudioDocumentSlot>);await flush();
 expect(privateMount).not.toHaveBeenCalled();expect(mocks.opening).not.toHaveBeenCalled();expect(mocks.get).not.toHaveBeenCalled();expect(getLocalFirstStoreOwner()).toBeNull();
});

it('retains an installed frame and same actor while unknown soft children are withheld and accepted writes drain',async()=>{
 mounted=renderIntoDocument(<StudioDocumentSlot callback={callback}><StudioDocumentPage callback={callback}/></StudioDocumentSlot>);await flush();await flush();expect(latest.canEdit).toBe(true);
 const hold=deferred(),update=mocks.update.getMockImplementation()!;mocks.update.mockImplementationOnce(async(key,fn)=>{await hold.promise;return update(key,fn);});
 act(()=>{const edit=structuredClone(latest.edit!);edit.site.access='hard';latest.change(edit);});
 const privateMount=vi.fn();function Private(){privateMount();return <p>Private ordinary route</p>;}
 history.replaceState({},'','/staff/projects');act(()=>mounted!.rerender(<StudioDocumentSlot callback={callback}><Private/></StudioDocumentSlot>));
 expect(privateMount).not.toHaveBeenCalled();expect(getLocalFirstStoreOwner()).toBe(actor);expect(mocks.opening).toHaveBeenCalledOnce();
 await act(async()=>hold.resolve());await flush();expect(getLocalFirstStoreOwner()).toBe(actor);expect(await readStudioWorkingCopy({actorId:actor,projectId,estimateId,designId:'design'})).toMatchObject({state:'valid',session:{edit:{site:{access:'hard'}}}});expect(mocks.api).not.toHaveBeenCalled();
});


it('starts one fresh opening after real SDK recovered-session SIGNED_IN bootstrap settles',async()=>{
 const storage=deferred(),opening=deferred(),events:string[]=[],fetch=vi.fn(()=>{throw Error('No provider requests are permitted in this SDK bootstrap test.');});
 const session={access_token:'synthetic-access-token',refresh_token:'synthetic-refresh-token',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:actor}};
 vi.stubGlobal('BroadcastChannel',undefined);
 const sdk=createClient('https://sdk-bootstrap.invalid','synthetic-public-key',{global:{fetch},auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'sdk-bootstrap',storage:{getItem:async()=>{await storage.promise;return JSON.stringify(session);},setItem:async()=>{},removeItem:async()=>{}}}});
 mocks.sdk=sdk;const observer=sdk.auth.onAuthStateChange(event=>{events.push(event);});
 mocks.opening.mockImplementation(()=>opening.promise.then(()=>response()));
 mounted=renderIntoDocument(<StudioDocumentSlot callback={callback}><StudioDocumentPage callback={callback}/></StudioDocumentSlot>);await flush();
 await act(async()=>storage.resolve());await sdk.auth.initialize();await flush();
 expect(events).toContain('SIGNED_IN');expect(mocks.opening).toHaveBeenCalledOnce();expect(fetch).not.toHaveBeenCalled();
 await act(async()=>opening.resolve());await flush();expect(latest.canEdit).toBe(true);observer.data.subscription.unsubscribe();
});


it.each(['returned','rejected'])('keeps fresh API authority when SDK initialization reports a %s error',async kind=>{
 mocks.initialize.mockImplementationOnce(()=>{expect(mocks.authChanged).not.toBeNull();return kind==='returned'?Promise.resolve({error:Error('Unavailable hint')}):Promise.reject(Error('Unavailable hint'));});
 mounted=renderIntoDocument(<StudioDocumentSlot callback={callback}><StudioDocumentPage callback={callback}/></StudioDocumentSlot>);await flush();await flush();
 expect(mocks.initialize).toHaveBeenCalledOnce();expect(mocks.opening).toHaveBeenCalledOnce();expect(latest.canEdit).toBe(true);
});

it('bounds hung SDK readiness, offers retry and never dispatches its retired turn after late settlement',async()=>{
 vi.useFakeTimers();const init=deferred();mocks.initialize.mockImplementation(()=>init.promise);
 mounted=renderIntoDocument(<StudioDocumentSlot callback={callback}><StudioDocumentPage callback={callback}/></StudioDocumentSlot>);await act(async()=>{await Promise.resolve();});
 expect(mocks.opening).not.toHaveBeenCalled();expect(mocks.get).not.toHaveBeenCalled();expect(mocks.leaf).not.toHaveBeenCalled();
 await act(async()=>vi.advanceTimersByTimeAsync(STUDIO_OPENING_FIRST_MS));expect(document.querySelector('[role="alert"]')?.textContent).toContain('could not be loaded');
 act(()=>{(document.querySelector('[role="alert"] button') as HTMLButtonElement).click();});
 expect(mocks.initialize).toHaveBeenCalledOnce();expect(mocks.opening).not.toHaveBeenCalled();expect(mocks.leaf).not.toHaveBeenCalled();
 await act(async()=>{init.resolve();await vi.advanceTimersByTimeAsync(1);});
 expect(mocks.opening).toHaveBeenCalledOnce();expect(latest.canEdit).toBe(true);
});

it.each(['pagehide','unmount','URL'])('retires SDK-waiting opening before %s abandonment can later dispatch',async reason=>{
 const init=deferred();mocks.initialize.mockImplementation(()=>init.promise);
 mounted=renderIntoDocument(<StudioDocumentSlot callback={callback}><StudioDocumentPage callback={callback}/></StudioDocumentSlot>);await flush();expect(mocks.opening).not.toHaveBeenCalled();
 if(reason==='pagehide')act(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
 else if(reason==='unmount'){mounted.unmount();mounted=undefined;}
 else history.replaceState({},'','/staff/projects');
 await act(async()=>init.resolve());await flush();expect(mocks.opening).not.toHaveBeenCalled();expect(mocks.get).not.toHaveBeenCalled();expect(mocks.leaf).not.toHaveBeenCalled();expect(getLocalFirstStoreOwner()).toBeNull();
});

it('retains startup transition sequencing without using browser actor hints to veto the fresh server actor',async()=>{
 const init=deferred();mocks.initialize.mockImplementation(()=>init.promise);
 mounted=renderIntoDocument(<StudioDocumentSlot callback={callback}><StudioDocumentPage callback={callback}/></StudioDocumentSlot>);await flush();
 act(()=>{mocks.authChanged?.('SIGNED_IN',{user:{id:actor}});mocks.authChanged?.('SIGNED_OUT',null);mocks.authChanged?.('SIGNED_IN',{user:{id:other}});});
 expect(mocks.opening).not.toHaveBeenCalled();await act(async()=>init.resolve());await flush();expect(mocks.opening).toHaveBeenCalledOnce();expect(getLocalFirstStoreOwner()).toBe(actor);expect(latest.canEdit).toBe(true);
});

it('ends the outer first-frame deadline at DTO admission without cancelling an outstanding price tail',async()=>{
 vi.useFakeTimers();let signal!:AbortSignal;mocks.opening.mockImplementation(async(_url,_expected,outer)=>{signal=outer;return {...response(),openingPrice:{result:new Promise(()=>{}),binding:{}}};});
 mounted=renderIntoDocument(<StudioDocumentSlot callback={callback}><StudioDocumentPage callback={callback}/></StudioDocumentSlot>);await act(async()=>{await vi.advanceTimersByTimeAsync(1);});
 expect(mocks.opening).toHaveBeenCalledOnce();expect(latest.canEdit).toBe(true);await act(async()=>vi.advanceTimersByTimeAsync(STUDIO_OPENING_FIRST_MS));expect(signal.aborted).toBe(false);expect(document.querySelector('[role="alert"]')).toBeNull();
});


it('keeps the same first-frame deadline through the API wait after SDK readiness',async()=>{
 vi.useFakeTimers();const first=deferred();let signal!:AbortSignal;mocks.opening.mockImplementationOnce((_url,_expected,outer)=>{signal=outer;return first.promise.then(()=>response());});
 mounted=renderIntoDocument(<StudioDocumentSlot callback={callback}><StudioDocumentPage callback={callback}/></StudioDocumentSlot>);await act(async()=>{await vi.advanceTimersByTimeAsync(1);});expect(mocks.opening).toHaveBeenCalledOnce();
 await act(async()=>vi.advanceTimersByTimeAsync(STUDIO_OPENING_FIRST_MS));expect(signal.aborted).toBe(true);expect(document.querySelector('[role="alert"]')?.textContent).toContain('could not be loaded');
 await act(async()=>first.resolve());expect(getLocalFirstStoreOwner()).toBeNull();expect(mocks.get).not.toHaveBeenCalled();
});

it('starts only the fresh pagehide-return turn when SDK readiness settles later',async()=>{
 const init=deferred();mocks.initialize.mockImplementation(()=>init.promise);
 mounted=renderIntoDocument(<StudioDocumentSlot callback={callback}><StudioDocumentPage callback={callback}/></StudioDocumentSlot>);await flush();
 act(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});expect(mocks.opening).not.toHaveBeenCalled();
 await act(async()=>init.resolve());await flush();expect(mocks.initialize).toHaveBeenCalledOnce();expect(mocks.opening).toHaveBeenCalledOnce();expect(latest.canEdit).toBe(true);
});


it('keeps real SDK recovered-session notification after pagehide inactive until pageshow',async()=>{
 const storage=deferred(),opening=deferred(),events:string[]=[],fetch=vi.fn(()=>{throw Error('No provider requests are permitted in this SDK pagehide test.');});
 const session={access_token:'synthetic-access-token',refresh_token:'synthetic-refresh-token',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:actor}};
 vi.stubGlobal('BroadcastChannel',undefined);
 const sdk=createClient('https://sdk-bootstrap.invalid','synthetic-public-key',{global:{fetch},auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'sdk-pagehide',storage:{getItem:async()=>{await storage.promise;return JSON.stringify(session);},setItem:async()=>{},removeItem:async()=>{}}}});
 mocks.sdk=sdk;const observer=sdk.auth.onAuthStateChange(event=>{events.push(event);});mocks.opening.mockImplementation(()=>opening.promise.then(()=>response()));
 mounted=renderIntoDocument(<StudioDocumentSlot callback={callback}><StudioDocumentPage callback={callback}/></StudioDocumentSlot>);await flush();
 act(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));await act(async()=>storage.resolve());await sdk.auth.initialize();await flush();
 expect(events).toContain('SIGNED_IN');expect(mocks.opening).not.toHaveBeenCalled();expect(mocks.get).not.toHaveBeenCalled();expect(mocks.leaf).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
 act(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await flush();expect(mocks.opening).toHaveBeenCalledOnce();
 await act(async()=>opening.resolve());await flush();expect(latest.canEdit).toBe(true);observer.data.subscription.unsubscribe();
});


it.each(['event','button'])('keeps native-leaving inactive until explicit %s continuation restores the same working draft',async method=>{
 await open();act(()=>{const edit=structuredClone(latest.edit!);edit.site.access='hard';latest.change(edit);});await flush();
 act(()=>window.dispatchEvent(new Event('studio:document-leaving')));await flush();expect(latest.canEdit).toBe(false);
 act(()=>mocks.authChanged?.('USER_UPDATED',{user:{id:actor}}));await flush();expect(mocks.opening).toHaveBeenCalledOnce();
 if(method==='event')act(()=>window.dispatchEvent(new Event('studio:document-staying')));
 else act(()=>{const button=[...document.querySelectorAll('button')].find(button=>button.textContent?.includes('Continue editing'));expect(button).toBeTruthy();button!.click();});
 await flush();expect(mocks.opening).toHaveBeenCalledTimes(2);expect(latest.canEdit).toBe(true);expect(latest.edit?.site.access).toBe('hard');expect(latest.canUndo).toBe(true);
});


it('opens only the live turn after actual StrictMode setup-cleanup-setup and held SDK readiness',async()=>{
 const init=deferred();mocks.initialize.mockImplementation(()=>init.promise);
 mounted=renderIntoDocument(<StrictMode><StudioDocumentSlot callback={callback}><StudioDocumentPage callback={callback}/></StudioDocumentSlot></StrictMode>);await flush();expect(mocks.opening).not.toHaveBeenCalled();expect(mocks.leaf).not.toHaveBeenCalled();
 await act(async()=>init.resolve());await flush();expect(mocks.opening).toHaveBeenCalledOnce();expect(getLocalFirstStoreOwner()).toBe(actor);
});

it('does not release a retired request preload from the commit-to-passive pagehide seam',async()=>{
 const pending=deferred();mocks.opening.mockImplementation(()=>pending.promise.then(()=>response()));
 function HideBeforePreload(){
  const frame=useContext(StudioDocumentContext),hidden=useRef(false);
  useLayoutEffect(()=>{if(frame?.requestIssued?.turn!=null&&!hidden.current){hidden.current=true;window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));}},[frame?.requestIssued?.turn]);
  return <StudioDocumentPage callback={callback}/>;
 }
 mounted=renderIntoDocument(<StudioDocument callback={callback}><HideBeforePreload/></StudioDocument>);await flush();
 expect(mocks.opening).toHaveBeenCalledOnce();expect(mocks.leaf).not.toHaveBeenCalled();expect(getLocalFirstStoreOwner()).toBeNull();
 act(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await flush();
 expect(mocks.opening).toHaveBeenCalledTimes(2);expect(mocks.leaf).toHaveBeenCalledOnce();expect(getLocalFirstStoreOwner()).toBeNull();
});

it('does not mount an editor from a module completion after its issued request was synchronously withdrawn',async()=>{
 const leaf=deferred();mocks.leaf.mockImplementation(()=>leaf.promise.then(()=>Editor));
 mounted=renderIntoDocument(<StudioDocument callback={callback}><StudioDocumentPage callback={callback}/></StudioDocument>);await flush();
 expect(getLocalFirstStoreOwner()).toBe(actor);expect(mounted.container.querySelector('[data-editor]')).toBeNull();
 act(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));leaf.resolve();});await flush();
 expect(mounted.container.querySelector('[data-editor]')).toBeNull();expect(mocks.opening).toHaveBeenCalledOnce();expect(mocks.api).not.toHaveBeenCalled();
});
