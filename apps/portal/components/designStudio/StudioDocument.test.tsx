import {act,useEffect,useLayoutEffect} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../test/reactHarness';
import StudioDocument from './StudioDocument';
import StudioDocumentPage from './StudioDocumentPage';
import {useStudioEditingSession,type StudioEditingSessionProps} from './useStudioEditingSession';
import {usePortalSession} from '@/components/auth/PortalAuthProvider';
import {useStudioWebsitePrice} from './useStudioWebsitePrice';
import {studioOpeningPrice,studioWebsitePricePayload} from '@/lib/designStudio/studioOpening';
import {createStudioAuthoringEdit} from '@/lib/designStudio/authoringView';
import {bindLocalFirstStoreOwner,clearLocalFirstStoreOwner,getLocalFirstStoreOwner,writeLocalFirstWorkingCopy,__resetLocalFirstStoreForTests} from '@/lib/localFirst/store';
import {invalidateStudioLifecycle} from '@/lib/designStudio/studioLifecycle';
import {navigateStudioDocument} from '@/lib/designStudio/studioDocumentNavigation';

const mocks=vi.hoisted(()=>({opening:vi.fn(),leaf:vi.fn(),get:vi.fn(),set:vi.fn(),update:vi.fn(),keys:vi.fn(),role:vi.fn(),browser:'10000000-0000-4000-8000-000000000001',authChanged:null as null|((event:string,session:unknown)=>void)}));
vi.mock('next/navigation',()=>({usePathname:()=>location.pathname,useSearchParams:()=>new URLSearchParams(location.search),useRouter:()=>({replace:vi.fn()})}));
vi.mock('@/lib/designStudio/studioOpeningTransport',async load=>({...await load<typeof import('@/lib/designStudio/studioOpeningTransport')>(),readStudioOpening:mocks.opening}));
vi.mock('./studioLeafLoading',()=>({loadStudioEditor:mocks.leaf}));
vi.mock('./StudioRevisionStart',()=>({default:()=> <p>Revision required</p>}));
vi.mock('./StudioCreateAction',()=>({default:()=> <p>Recovery available</p>}));
vi.mock('./StudioNavigationCapture',()=>({default:()=>null}));
vi.mock('@/lib/queries/auth',()=>({fetchPortalRole:mocks.role}));
vi.mock('@/lib/supabase/browserClient',()=>({supabaseRuntimeUrl:()=>'',getSupabaseBrowser:()=>({auth:{initialize:async()=>({error:null}),getSession:async()=>({data:{session:{user:{id:mocks.browser}}}}),onAuthStateChange:(fn:typeof mocks.authChanged)=>{mocks.authChanged=fn;return{data:{subscription:{unsubscribe(){}}}};},signOut:vi.fn()}})}));
vi.mock('idb-keyval',()=>({get:mocks.get,set:mocks.set,update:mocks.update,keys:mocks.keys}));
vi.mock('@/app/providers',()=>({Providers:({children}:{children:React.ReactNode})=>{
 const {user}=usePortalSession();
 useLayoutEffect(()=>{if(user)bindLocalFirstStoreOwner(user.id);return()=>clearLocalFirstStoreOwner();},[user?.id]);
 return <div data-runtime-owner={user?.id}>{children}</div>;
}}));
const actor=mocks.browser,other='10000000-0000-4000-8000-000000000002',projectId='proj_20000000-0000-4000-8000-000000000001',estimateId='est_30000000-0000-4000-8000-000000000001';
const callback=`/staff/design-studio/${projectId}/${estimateId}/edit`;
const view:StudioEditingSessionProps['view']={schemaVersion:'studio_authoring_view.v1',designId:'design',revision:1,spatial:{houseAssembly:null,decks:[],openings:[],pergolas:[]},site:{access:'normal'},objectOptions:[],pricing:'unpriced'};
const authoring={state:'ready',estimate:{id:estimateId,projectId,versionLabel:'V1',updatedAt:'2026-10-20T00:00:00Z',requiresNewRevision:false},view,nextAction:'edit',reason:null};
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return{promise,resolve};}
let latest:ReturnType<typeof useStudioEditingSession>,latestPrice:ReturnType<typeof useStudioWebsitePrice>,mounts:number,db:Map<string,unknown>,transactions:Promise<unknown>;
function Editor(props:StudioEditingSessionProps&{openingPrice:ReturnType<typeof studioOpeningPrice>}) {
 latest=useStudioEditingSession(props);
 const price=useStudioWebsitePrice({...props.scope,revision:latest.edit?.revision??view.revision,design:null,composition:latest.edit,openingPrice:props.openingPrice,openingState:latest.status==='loading'?'waiting':latest.session?.dirty?'ineligible':'eligible'});
 latestPrice=price;
 useEffect(()=>{mounts++;},[]);
 return <main data-editor data-access={latest.edit?.site.access} data-price={price.price?.amount??''}>{latest.status}</main>;
}
function response(id=actor){
 const scope={actorId:id,role:'staff' as const,projectId,estimateId},payload=studioWebsitePricePayload({designId:view.designId,revision:view.revision,composition:createStudioAuthoringEdit(view),design:null});
 const tail=deferred<any>(),cancel=vi.fn();
 return{value:{scope,authoring,presentation:{theme:{'--portal-accent':'#123456'}},openingPrice:studioOpeningPrice({...scope,designId:view.designId,revision:view.revision,requestKey:payload.requestKey},tail.promise,cancel)},tail,cancel};
}
let mounted:ReturnType<typeof renderIntoDocument>|undefined;
beforeEach(()=>{
 __resetLocalFirstStoreForTests();invalidateStudioLifecycle();vi.clearAllMocks();mocks.browser=actor;mounts=0;db=new Map();transactions=Promise.resolve();history.replaceState({},'',callback);
 Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(name:string,_options:unknown,fn:(lock:unknown)=>unknown)=>fn({name})}});
 mocks.role.mockResolvedValue('admin');mocks.leaf.mockResolvedValue(Editor);
 mocks.get.mockImplementation(async key=>structuredClone(db.get(key)));
 mocks.keys.mockImplementation(async()=>[...db.keys()]);
 const transaction=(key:string,recipe:(old:unknown)=>unknown)=>{const pending=transactions.then(()=>{db.set(key,structuredClone(recipe(structuredClone(db.get(key)))));});transactions=pending.catch(()=>{});return pending;};
 mocks.set.mockImplementation((key,value)=>transaction(key,()=>value));mocks.update.mockImplementation(transaction);
 vi.stubGlobal('fetch',vi.fn(async(_url,options)=>{const body=JSON.parse(options.body);return Response.json({...body,status:'priced',amount:222});}));
});
afterEach(()=>{mounted?.unmount();mounted=undefined;clearLocalFirstStoreOwner();invalidateStudioLifecycle();vi.unstubAllGlobals();});
const open=async()=>{mounted=renderIntoDocument(<StudioDocument callback={callback}><StudioDocumentPage callback={callback}/></StudioDocument>);await act(async()=>{});return mounted.container;};

it('mounts no actor runtime/storage before the fresh frame, then uses its scope and ignores cached admin role',async()=>{
 const first=deferred<any>(),r=response();mocks.opening.mockReturnValue(first.promise);const ui=await open();
 expect(ui.querySelector('[data-runtime-owner]')).toBeNull();expect(mocks.get).not.toHaveBeenCalled();expect(getLocalFirstStoreOwner()).toBeNull();
 expect(mocks.leaf).toHaveBeenCalledOnce();
 await act(async()=>first.resolve(r.value));
 expect(ui.querySelector('[data-runtime-owner]')?.getAttribute('data-runtime-owner')).toBe(actor);expect(latest.canEdit).toBe(true);expect(mocks.role).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
 expect(document.documentElement.style.getPropertyValue('--portal-accent')).toBe('#123456');
 expect(mocks.opening.mock.calls[0][1]).toEqual({projectId,estimateId});
});

it('does not veto fresh server A/staff with an old INITIAL_SESSION hint B',async()=>{
 const first=deferred<any>();mocks.opening.mockReturnValue(first.promise);await open();
 act(()=>mocks.authChanged?.('INITIAL_SESSION',{user:{id:other}}));
 await act(async()=>first.resolve(response(actor).value));
 expect(mocks.opening).toHaveBeenCalledOnce();expect(getLocalFirstStoreOwner()).toBe(actor);expect(latest.canEdit).toBe(true);
});

it('rejects an opening response overtaken by an actual session transition, without requiring the hint to equal the later fresh response',async()=>{
 const old=deferred<any>(),fresh=deferred<any>();mocks.opening.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);await open();
 act(()=>mocks.authChanged?.('SIGNED_IN',{user:{id:other}}));
 await act(async()=>old.resolve(response(other).value));expect(getLocalFirstStoreOwner()).toBeNull();
 await act(async()=>fresh.resolve(response(actor).value));expect(getLocalFirstStoreOwner()).toBe(actor);expect(mocks.opening).toHaveBeenCalledTimes(2);
});

it('keeps a held first local persist and held price waiting without an automatic price POST',async()=>{
 const hold=deferred<void>(),r=response();mocks.opening.mockResolvedValue(r.value);
 const update=mocks.update.getMockImplementation()!;mocks.update.mockImplementation((key,fn)=>{transactions=hold.promise;return update(key,fn);});
 await open();expect(latest.status).toBe('loading');expect(fetch).not.toHaveBeenCalled();
 await act(async()=>hold.resolve());expect(latest.canEdit).toBe(true);expect(fetch).not.toHaveBeenCalled();
 await act(async()=>r.tail.resolve({ok:false,error:'Current publication unavailable'}));expect(fetch).not.toHaveBeenCalled();
 act(()=>latestPrice.retry());await act(async()=>{await new Promise(resolve=>setTimeout(resolve,1));});expect(fetch).toHaveBeenCalledOnce();expect(latestPrice.price?.amount).toBe(222);
});

it('synchronously fences pagehide while accepted IDB work drains, then fresh re-entry restores exact edit and Undo',async()=>{
 const first=response(),next=response();mocks.opening.mockResolvedValueOnce(first.value).mockResolvedValueOnce(next.value);const ui=await open();
 const hold=deferred<void>();transactions=hold.promise;
 act(()=>{const edit=structuredClone(latest.edit!);edit.site.access='hard';expect(latest.change(edit).kind).toBe('accepted');});
 act(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
 expect(latest.canEdit).toBe(false);expect(ui.querySelector('[inert]')).not.toBeNull();expect(getLocalFirstStoreOwner()).toBe(actor);
 expect(document.documentElement.style.getPropertyValue('--portal-accent')).toBe('');
 act(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
 await act(async()=>{});expect(mounts).toBe(1);expect(getLocalFirstStoreOwner()).toBe(actor);
 await act(async()=>hold.resolve());expect(mounts).toBe(2);expect(latest.edit?.site.access).toBe('hard');expect(latest.canUndo).toBe(true);
 act(()=>latest.undo());await act(async()=>{});expect(latest.edit?.site.access).toBe('normal');
});

it('does not restart or remount for routine focus, INITIAL_SESSION or same-user token refresh',async()=>{
 mocks.opening.mockResolvedValue(response().value);await open();
 act(()=>{window.dispatchEvent(new Event('focus'));mocks.authChanged?.('INITIAL_SESSION',{user:{id:actor}});mocks.authChanged?.('TOKEN_REFRESHED',{user:{id:actor}});});
 await act(async()=>{});expect(mocks.opening).toHaveBeenCalledOnce();expect(mounts).toBe(1);expect(latest.canEdit).toBe(true);
});

it('does not bind the new actor before the old actor accepted writes drain, or show an old tail afterwards',async()=>{
 const first=response(),second=response(other);mocks.opening.mockResolvedValueOnce(first.value).mockResolvedValueOnce(second.value);await open();
 const hold=deferred<void>();transactions=hold.promise;
 act(()=>{const edit=structuredClone(latest.edit!);edit.site.access='hard';latest.change(edit);mocks.browser=other;mocks.authChanged?.('SIGNED_IN',{user:{id:other}});});
 await act(async()=>{});expect(getLocalFirstStoreOwner()).toBe(actor);expect(latest.canEdit).toBe(false);
 await act(async()=>hold.resolve());expect(getLocalFirstStoreOwner()).toBe(other);expect(latest.edit?.site.access).toBe('normal');
 await act(async()=>first.tail.resolve({ok:true,price:{amount:999999,requestKey:first.value.openingPrice.binding.requestKey}}));expect(mounted!.container.querySelector('[data-price]')?.getAttribute('data-price')).not.toBe('999999');
});

it('cancels a native handoff abandoned while IDB is held, preserving its exact local edit and releasing the action fence',async()=>{
 mocks.opening.mockResolvedValue(response().value);await open();const hold=deferred<void>();transactions=hold.promise;
 act(()=>{const edit=structuredClone(latest.edit!);edit.site.access='hard';latest.change(edit);});
 const controller=new AbortController(),navigate=vi.fn();let pending!:Promise<void>;
 act(()=>{pending=navigateStudioDocument('/staff/projects',false,navigate,controller.signal);void pending.catch(()=>{});});
 expect(latest.canEdit).toBe(false);controller.abort();await act(async()=>hold.resolve());
 await expect(pending).rejects.toThrow();expect(navigate).not.toHaveBeenCalled();expect(getLocalFirstStoreOwner()).toBe(actor);expect(latest.edit?.site.access).toBe('hard');expect(latest.canEdit).toBe(true);
});

it('restores the existing usable editor after a local navigation flush fails, without a Save or permanent movement fence',async()=>{
 mocks.opening.mockResolvedValue(response().value);const ui=await open();const before=structuredClone(latest.edit);vi.spyOn(console,'error').mockImplementation(()=>{});mocks.set.mockRejectedValueOnce(Error('quota'));await writeLocalFirstWorkingCopy({entityKey:'estimate:ordinary',data:{name:'Kept'}});mocks.set.mockRejectedValueOnce(Error('quota'));
 const navigate=vi.fn();let failure:unknown;await act(async()=>{try{await navigateStudioDocument('/staff/projects',false,navigate);}catch(error){failure=error;}});
 expect(failure).toBeInstanceOf(Error);expect(navigate).not.toHaveBeenCalled();expect(latest.canEdit).toBe(true);expect(latest.edit).toEqual(before);expect(ui.querySelector('[data-editor]')?.closest('[inert]')).toBeNull();expect(fetch).not.toHaveBeenCalled();
});

it('keeps the canonical quoted/read-only revision action and does not mount an editing session',async()=>{
 const r=response();mocks.opening.mockResolvedValue({...r.value,authoring:{...authoring,nextAction:'create-revision',estimate:{...authoring.estimate,requiresNewRevision:true}}});const ui=await open();
 expect(ui.textContent).toContain('Revision required');expect(ui.querySelector('[data-editor]')).toBeNull();expect(mounts).toBe(0);expect(fetch).not.toHaveBeenCalled();
});
