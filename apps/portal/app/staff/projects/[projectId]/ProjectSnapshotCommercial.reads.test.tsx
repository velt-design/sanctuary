import {act,createContext} from 'react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../../../test/reactHarness';
import {PortalQueryClientScope} from '@/lib/react-query/PortalQueryClientContext';
import {PortalRouteTransitionProvider,PortalInstantRouteContent} from '@/components/page-state/PortalRouteTransition';
import {PortalGuardedPage,usePortalPageSource} from '@/components/page-state/PortalPageSource';
import Provider,{useOptionalProjectWorkspace} from '../ProjectInstantNavigation';
import Snapshot from './ProjectSnapshotPageClient';
import {quotes,invoice,schedule,projectId} from '@/app/qa/project-page-shell-fixture/commercialClarityData';
import {__setLocalFirstStorageAdapterForTests,__resetLocalFirstStoreForTests,bindLocalFirstStoreOwner} from '@/lib/localFirst/store';

const state=vi.hoisted(()=>({canonical:'/staff/projects',path:'/staff/projects',completion:{} as Record<string,never>,quotes:vi.fn(),invoices:vi.fn(),schedule:vi.fn(),estimates:vi.fn()}));
const router=vi.hoisted(()=>({replace:vi.fn(),prefetch:vi.fn(),refresh:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>router,usePathname:()=>state.path,useSelectedLayoutSegments:()=>state.canonical.split('/').filter(Boolean),useSearchParams:()=>new URLSearchParams(window.location.search)}));
vi.mock('next/dynamic',async()=>{const {default:Loadable}=await vi.importActual<typeof import('next/dist/shared/lib/lazy-dynamic/loadable')>('next/dist/shared/lib/lazy-dynamic/loadable');return {default:(loader:()=>Promise<any>,options?:object)=>Loadable({loader,...options})};});
vi.mock('@/components/auth/PortalAuthProvider',()=>({PortalAuthContext:createContext(null),usePortalSession:()=>({user:{id:'staff-fictional'},role:'staff',isAdmin:false})}));
vi.mock('@/components/ui/toast/ToastProvider',()=>({useToast:()=>({success:vi.fn(),error:vi.fn()})}));
vi.mock('@/lib/supabase/browserClient',()=>({supabaseRuntimeUrl:()=> 'https://fixture.invalid',supabaseHostFromUrl:()=> 'host'}));
vi.mock('@/components/layout/GlobalPortalSearchRead',()=>({default:()=>null}));
vi.mock('@/components/projects/ProjectPage/ProjectHeaderOwnerControl',()=>({default:()=>null}));
vi.mock('@/components/projects/ProjectPage/ProjectHeaderPrivateActions',()=>({default:()=>null}));
// Optional file warming is independently tested with its real import/metadata ownership.
vi.mock('@/components/projects/ProjectPage/useProjectFilesPreparation',()=>({useProjectFilesPreparation:()=>undefined}));
vi.mock('@/lib/localFirst/useResolvedLocalFirstId',()=>({useResolvedLocalFirstId:(id:string)=>id}));
vi.mock('@/lib/queries/projectEstimates',async(original)=>({...await original<typeof import('@/lib/queries/projectEstimates')>(),estimateMetasByProjectQueryOptions:()=>({queryKey:['fixture-estimates'],queryFn:state.estimates})}));
vi.mock('@/lib/queries/quotes',async(original)=>({...await original<typeof import('@/lib/queries/quotes')>(),quoteVersionsByProjectQueryOptions:()=>({queryKey:['fixture-quotes'],queryFn:state.quotes})}));
vi.mock('@/lib/queries/invoices',async(original)=>({...await original<typeof import('@/lib/queries/invoices')>(),depositInvoicesByProjectQueryOptions:()=>({queryKey:['fixture-invoices'],queryFn:state.invoices})}));
vi.mock('@/lib/repo/invoicesRepo',async(original)=>({...await original<typeof import('@/lib/repo/invoicesRepo')>(),loadProjectInvoiceSchedule:(...args:unknown[])=>state.schedule(...args)}));

function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(accept=>{resolve=accept;});return {promise,resolve};}
let client:QueryClient,view:ReturnType<typeof renderIntoDocument>|undefined;
const summary=vi.fn(),snapshot=vi.fn();
const loaders={summary,snapshot,command:vi.fn(),payment:vi.fn()};
const index={};
function Controls(){const workspace=useOptionalProjectWorkspace(),source=usePortalPageSource();return <><button data-open onClick={()=>workspace!.showProject(`/staff/projects/${projectId}`)}>Open</button><button data-deny onClick={()=>source!.deny(`/staff/projects/${projectId}`)}>Deny</button></>;}
function Outlet(){usePortalPageSource();return state.canonical==='/staff/projects'?<PortalGuardedPage pathname="/staff/projects" completion={index}><p data-index>Genuine index</p></PortalGuardedPage>:<PortalGuardedPage pathname={state.canonical} completion={state.completion} publicFrame={false}><Snapshot projectId={projectId} tab="activity" estimateId={null} debugExportEnabled={false} readLoaders={loaders}/></PortalGuardedPage>;}
const outlet=<Outlet/>;
function tree(){return <QueryClientProvider client={client}><PortalQueryClientScope client={client}><PortalRouteTransitionProvider><PortalInstantRouteContent><Provider><Controls/>{outlet}</Provider></PortalInstantRouteContent></PortalRouteTransitionProvider></PortalQueryClientScope></QueryClientProvider>;}
function click(label:string){act(()=>[...view!.container.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(button=>button.textContent===label)!.click());}
async function settle(){for(let n=0;n<4;n++)await act(async()=>{await vi.dynamicImportSettled();await new Promise(resolve=>setTimeout(resolve,5));});}
beforeEach(()=>{state.path=state.canonical='/staff/projects';state.completion={};window.history.replaceState(null,'','/staff/projects');client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 __setLocalFirstStorageAdapterForTests({get:async()=>undefined,set:async()=>undefined});bindLocalFirstStoreOwner('staff-fictional');
 for(const fn of [summary,snapshot,state.quotes,state.invoices,state.schedule,state.estimates])fn.mockReset();state.estimates.mockResolvedValue([]);
 vi.stubGlobal('fetch',vi.fn(()=>Promise.reject(new Error('Unexpected fictional request'))));vi.spyOn(window,'scrollTo').mockImplementation(()=>undefined);
});
afterEach(()=>{view?.unmount();view=undefined;client.clear();__resetLocalFirstStoreForTests();__setLocalFirstStorageAdapterForTests(null);vi.unstubAllGlobals();vi.restoreAllMocks();});

it.each(['Quotes','Invoices'])('keeps the actual %s list through held fresh authority, genuine SnapshotRead/controller arrival, independent pending facts and denial',async(tab)=>{
 const projectRead=deferred<any>(),quoteRead=deferred<any>(),invoiceRead=deferred<any>();summary.mockReturnValue(projectRead.promise);snapshot.mockReturnValue(projectRead.promise);
 state.quotes.mockReturnValue(quoteRead.promise);state.invoices.mockReturnValue(invoiceRead.promise);state.schedule.mockResolvedValue(schedule);
 view=renderIntoDocument(tree());act(()=>view!.container.querySelector<HTMLButtonElement>('[data-open]')!.click());click('Commercial');click(tab);
 const id=tab==='Quotes'?'quote-search':'invoice-search',input=view.container.querySelector<HTMLInputElement>(`#${id}`)!,table=view.container.querySelector('table'),head=table?.querySelector('thead'),body=table?.querySelector('tbody'),toolbar=view.container.querySelector('[aria-label="Commercial sections"]');
 expect(input.disabled).toBe(false);expect(summary).not.toHaveBeenCalled();expect(snapshot).not.toHaveBeenCalled();expect(state.quotes).not.toHaveBeenCalled();expect(state.invoices).not.toHaveBeenCalled();
 act(()=>{input.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'CLARITY');input.dispatchEvent(new Event('input',{bubbles:true}));});
 state.path=state.canonical=`/staff/projects/${projectId}`;view.rerender(tree());await settle();
 expect(summary).toHaveBeenCalledOnce();expect(snapshot).toHaveBeenCalledOnce();expect(tab==='Quotes'?state.quotes:state.invoices).toHaveBeenCalledOnce();
 expect(view.container.querySelector(`#${id}`)).toBe(input);expect(view.container.querySelector('table')).toBe(table);expect(view.container.querySelector('[aria-label="Commercial sections"]')).toBe(toolbar);
 expect(table?.textContent).not.toContain(tab==='Quotes'?'Q-CLARITY':'INV-CLARITY');
 await act(async()=>{quoteRead.resolve(quotes);invoiceRead.resolve([invoice]);});await settle();
 expect(table?.textContent).toContain(tab==='Quotes'?'Q-CLARITY':'INV-CLARITY');expect(view.container.querySelector('[data-project-snapshot-state=pending]')).not.toBeNull();
 expect(view.container.querySelector('thead')).toBe(head);expect(view.container.querySelector('tbody')).toBe(body);expect(document.activeElement).toBe(input);expect(input.value).toBe('CLARITY');
 act(()=>view!.container.querySelector<HTMLButtonElement>('[data-deny]')!.click());expect(table?.textContent).not.toContain('Q-CLARITY');expect(table?.textContent).not.toContain('INV-CLARITY');expect(view.container.querySelector(`#${id}`)).toBe(input);
 await act(async()=>projectRead.resolve({snapshot:{project:{id:projectId,name:'Late forbidden project',stage:'new',hasJobPacks:true},workModel:'legacy',pipeline:{stage:'new'},notes:[],emails:[],activity:[]}}));await settle();
 expect(view.container.textContent).not.toContain('Late forbidden project');expect(table?.textContent).not.toContain('CLARITY');
});

it('publishes the actual closed-project notice with its ORIGINAL guarded review acknowledgement and resets it after denial',async()=>{
 const work={projectId,modelVersion:2,effectiveState:'CLOSED',operationalState:'CLOSED',closedOutcome:'CANCELLED',stateRowVersion:1,generatedAt:'2026-09-16T01:00:00Z',openItems:[],blockedItems:[],confirmedFacts:[]};
 const current={snapshot:{project:{id:projectId,name:'Fictional closed project',stage:'new',hasJobPacks:true},workModel:'v2',projectWork:work,pipeline:{stage:'new'},notes:[],emails:[],activity:[]}};
 summary.mockResolvedValue(current);snapshot.mockResolvedValue(current);state.quotes.mockResolvedValue(quotes);state.invoices.mockResolvedValue([invoice]);state.schedule.mockResolvedValue(schedule);
 view=renderIntoDocument(tree());act(()=>view!.container.querySelector<HTMLButtonElement>('[data-open]')!.click());click('Commercial');click('Quotes');
 const input=view.container.querySelector('#quote-search'),table=view.container.querySelector('table');
 expect(view.container.textContent).not.toContain('Review commercial actions');
 state.path=state.canonical=`/staff/projects/${projectId}`;view.rerender(tree());await settle();
 const review=()=>[...view!.container.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Review commercial actions');
 expect(review()).toBeDefined();
 const notice=review()!.parentElement!;
 act(()=>[...notice.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Details')!.click());
 expect(document.body.textContent).toContain('Closing the project does not cancel an invoice');
 act(()=>review()!.click());await settle();expect(document.body.textContent).toContain('Commercial actions are available for this review');expect(review()).toBeUndefined();
 expect(view.container.querySelector('#quote-search')).toBe(input);expect(view.container.querySelector('table')).toBe(table);
 act(()=>view!.container.querySelector<HTMLButtonElement>('[data-deny]')!.click());expect(document.body.textContent).not.toContain('Commercial actions are available for this review');
 state.completion={};view.rerender(tree());await settle();expect(review()).toBeDefined();expect(view.container.textContent).not.toContain('Commercial actions are available for this review');
 expect(view.container.querySelector('#quote-search')).toBe(input);expect(view.container.querySelector('table')).toBe(table);
});
