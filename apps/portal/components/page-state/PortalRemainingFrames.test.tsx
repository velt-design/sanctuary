import {act,useEffect,type ReactNode} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {renderIntoDocument as renderView} from '../../../../test/reactHarness';
import PortalActualFrames from './PortalActualFrames';
import {PortalGuardedPage,PortalPageSourceProvider,usePortalPageSourceController} from './PortalPageSource';
import DashboardClient from '@/app/dashboard/DashboardClient';
import ProjectInstantNavigationProvider from '@/app/staff/projects/ProjectInstantNavigation';
import ProjectsIndexClient from '@/app/staff/projects/ProjectsIndexClient';
import WorkQueueClient from '@/app/staff/projects/work-queue/WorkQueueClient';
import DesignPackagesClient from '@/app/staff/projects/design-packages/DesignPackagesClient';
import RunningJobsClient from '@/app/staff/projects/running-jobs/RunningJobsClient';
import {dashboardPartsResponse} from '@/lib/dashboard/dashboardPartResponse.server';
import {dashboardPartNames,type DashboardParts} from '@/lib/dashboard/dashboardParts';
import type {DashboardPartReads} from '@/lib/dashboard/getDashboardData';
import {dashboardFixture,visitsFixture,projectsFixture,draftingFixture,sheetFixture} from '@/app/qa/portal-progressive-fixture/data';
import {workQueueFixtureEntries,workQueueFixtureStaff} from '@/app/qa/project-work-queue-fixture/fixtures';
import {qk} from '@/lib/queries/keys';
import {defaultProjectsIndexParams,projectsIndexQueryOptions} from '@/lib/queries/projectsIndex';
import {projectIndexSessionKey,rememberProjectIndexPosition} from '@/lib/projects/projectIndexSession';

const api=vi.fn();
const views:Array<ReturnType<typeof renderView>>=[];
function renderIntoDocument(ui:Parameters<typeof renderView>[0]){const view=renderView(ui);views.push(view);return view;}
vi.mock('@/lib/repo/apiClient',async original=>({...await original<typeof import('@/lib/repo/apiClient')>(),apiJson:(...args:unknown[])=>api(...args)}));
vi.mock('next/link',()=>({default:({children,prefetch:_prefetch,...props}:any)=><a {...props}>{children}</a>}));
vi.mock('next/navigation',()=>({useRouter:()=>({replace:vi.fn(),prefetch:vi.fn(),push:vi.fn()}),usePathname:()=>window.location.pathname,useSearchParams:()=>new URLSearchParams(window.location.search)}));
vi.mock('@/components/auth/PortalAuthProvider',()=>({usePortalSession:()=>({role:'admin',user:{id:'fictional-staff'}})}));
vi.mock('@/components/ui/toast/ToastProvider',()=>({useToast:()=>({error:vi.fn(),info:vi.fn(),success:vi.fn()})}));
vi.mock('@/components/layout/GlobalPortalSearch.client',()=>({default:()=>null}));
vi.mock('@/lib/supabase/browserClient',()=>({supabaseRuntimeUrl:()=> 'https://fictional.invalid',supabaseHostFromUrl:()=> 'fictional'}));
const flush=()=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,30));});
function deferred<T>(){let resolve!:(value:T)=>void;return {promise:new Promise<T>(yes=>{resolve=yes;}),resolve};}
function input(node:HTMLInputElement,value:string){act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));});}
function Host({canonical,href,leaf}:{canonical:string;href:string;leaf:ReactNode}){
 const source=usePortalPageSourceController(window.location.pathname,canonical,window.location.search.slice(1));
 useEffect(()=>{window.addEventListener('popstate',source.cancel);return()=>window.removeEventListener('popstate',source.cancel);},[source.cancel]);
 return <PortalPageSourceProvider value={source}><button data-navigate onClick={()=>{source.begin(href);window.history.pushState(null,'',href);}}>Accepted navigation</button><PortalActualFrames><ProjectInstantNavigationProvider>{leaf}</ProjectInstantNavigationProvider></PortalActualFrames></PortalPageSourceProvider>;
}
let client:QueryClient;
beforeEach(()=>{client=new QueryClient({defaultOptions:{queries:{retry:false}}});window.history.replaceState(null,'','/staff/contacts');window.sessionStorage.clear();api.mockReset();api.mockImplementation(()=>new Promise(()=>{}));Element.prototype.scrollIntoView=vi.fn();});
afterEach(()=>{for(const view of views.splice(0))view.unmount();client.clear();document.body.innerHTML='';vi.restoreAllMocks();vi.unstubAllGlobals();});
const routes=[
 {name:'Dashboard',path:'/dashboard',field:'[aria-label="New dashboard task"]',fact:'Review fictional courtyard plan'},
 {name:'Projects',path:'/staff/projects',field:'#projectSearch',fact:'Fixture Alpha'},
 {name:'Work Queue',path:'/staff/projects/work-queue',field:'#workQueueSearch',fact:workQueueFixtureEntries[0].projectName},
 {name:'Drafting Queue',path:'/staff/projects/design-packages',field:'[placeholder="Search jobs"]',fact:'Fixture Alpha'},
 {name:'Running Jobs',path:'/staff/projects/running-jobs',field:'[placeholder="Search jobs"]',fact:'Demo courtyard'},
];
for(const route of routes)it('keeps the actual '+route.name+' controls before authority, through a genuine read and denial without cached private facts',async()=>{
 const params=defaultProjectsIndexParams('active');
 client.setQueryData(qk.dashboard.data('today'),dashboardFixture());
 client.setQueryData(projectsIndexQueryOptions('active',params).queryKey,projectsFixture(params));
 client.setQueryData(qk.projectWork.queue('fictional'),{entries:workQueueFixtureEntries,generatedAt:new Date().toISOString()});
 client.setQueryData(qk.designPackages.list('fictional'),draftingFixture());
 client.setQueryData(qk.runningJobs.list('fictional'),sheetFixture());
 await client.invalidateQueries({refetchType:'none'});
 const read=vi.fn(async()=>{if(route.name==='Dashboard')return dashboardFixture();if(route.name==='Work Queue')return {entries:workQueueFixtureEntries,generatedAt:new Date().toISOString()};if(route.name==='Drafting Queue')return draftingFixture();return sheetFixture();});
 const projectRead=vi.fn(async(p:Parameters<typeof projectsFixture>[0])=>projectsFixture(p));
 const visits=vi.fn(async()=>visitsFixture()),staff=vi.fn(async()=>workQueueFixtureStaff);
 const privateView=route.name==='Dashboard'?<DashboardClient queueMode="today" loader={read as any} visitsLoader={visits} readOnly/>:
   route.name==='Projects'?<ProjectsIndexClient readLoader={projectRead} readOnly/>:
   route.name==='Work Queue'?<WorkQueueClient queueLoader={read as any} staffLoader={staff} readOnly/>:
   route.name==='Drafting Queue'?<DesignPackagesClient loader={read as any} readOnly/>:<RunningJobsClient loader={read as any} readOnly/>;
 const root=(canonical:string,leaf:ReactNode)=><QueryClientProvider client={client}><Host canonical={canonical} href={route.path} leaf={leaf}/></QueryClientProvider>;
 const view=renderIntoDocument(root('/staff/contacts',<PortalGuardedPage pathname="/staff/contacts" completion={{}}><p>Outgoing private reader</p></PortalGuardedPage>));
 act(()=>view.container.querySelector<HTMLButtonElement>('[data-navigate]')!.click());await flush();
 const heading=view.container.querySelector('h1'),field=view.container.querySelector<HTMLInputElement>(route.field)!;
 const cards=route.name==='Dashboard'?['Work Queue','Recent Activity','Recent Estimates'].map(label=>{const card=view.container.querySelector('[aria-label="'+label+'"]')!;return {label,card,body:card.lastElementChild};}):[];
 const table=view.container.querySelector('table'),thead=view.container.querySelector('thead'),zoom=view.container.querySelector('[aria-label="Sheet zoom"]');
 expect(heading?.textContent).toBe(route.name);expect(field).not.toBeNull();
 expect(view.container.textContent).not.toContain(route.fact);expect(view.container.textContent).not.toContain('Outgoing private reader');
 expect(read).not.toHaveBeenCalled();expect(projectRead).not.toHaveBeenCalled();expect(visits).not.toHaveBeenCalled();expect(staff).not.toHaveBeenCalled();expect(api).not.toHaveBeenCalled();
 input(field,route.name==='Dashboard'?'Early reminder':route.name==='Projects'?'Fixture':' ');
 if(zoom)act(()=>{const preset=view.container.querySelector<HTMLSelectElement>('[aria-label="Zoom preset"]')!;preset.value='125';preset.dispatchEvent(new Event('change',{bubbles:true}));});
 // Next may adopt the original Flight entry URL after a pending public filter edit.
 if(route.name==='Projects')window.history.replaceState(window.history.state,'',route.path);
 field.focus();
 const completion={};const leaf=(unavailable=false,token=completion)=><PortalGuardedPage pathname={route.path} completion={token} unavailable={unavailable}>{privateView}</PortalGuardedPage>;
 await act(async()=>{view.root.render(root(route.path,leaf()));await new Promise(resolve=>setTimeout(resolve,220));});await flush();
 expect(document.activeElement).toBe(field);expect(view.container.querySelector('h1')).toBe(heading);expect(view.container.querySelector(route.field)).toBe(field);expect(field.value).toBe(route.name==='Dashboard'?'Early reminder':route.name==='Projects'?'Fixture':' ');
 expect(view.container.textContent).toContain(route.fact);
 for(const {label,card,body} of cards){expect(view.container.querySelector('[aria-label="'+label+'"]')).toBe(card);expect(card.lastElementChild).toBe(body);}
 if(route.name==='Projects'){expect(projectRead).toHaveBeenCalledTimes(1);expect(projectRead.mock.calls[0][0].search).toBe('Fixture');expect(new URLSearchParams(window.location.search).get('q')).toBe('Fixture');}else expect(read).toHaveBeenCalledTimes(1);
 if(table){expect(view.container.querySelector('table')).toBe(table);expect(view.container.querySelector('thead')).toBe(thead);}
 if(zoom){expect(view.container.querySelector('[aria-label="Sheet zoom"]')).toBe(zoom);expect(view.container.querySelector<HTMLSelectElement>('[aria-label="Zoom preset"]')?.value).toBe('125');}
 await act(async()=>{view.root.render(root(route.path,leaf(true)));});await flush();
 expect(view.container.querySelector('h1')).toBe(heading);expect(view.container.querySelector(route.field)).toBe(field);expect(view.container.textContent).not.toContain(route.fact);
 expect(field.value).toBe(route.name==='Dashboard'?'Early reminder':route.name==='Projects'?'Fixture':' ');
 for(const {label,card,body} of cards){expect(view.container.querySelector('[aria-label="'+label+'"]')).toBe(card);expect(card.lastElementChild).toBe(body);}
 expect(view.container.querySelector('[data-cell-id]')).toBeNull();expect(view.container.querySelector('[aria-label="Cell editor"]')).toBeNull();
 await act(async()=>{view.root.render(root(route.path,leaf(false,{})));});await flush();
 expect(view.container.querySelector(route.field)).toBe(field);expect(field.value).toBe(route.name==='Dashboard'?'Early reminder':route.name==='Projects'?'Fixture':' ');expect(view.container.textContent).toContain(route.fact);
 view.unmount();
});

it('does not read saved per-user row anchors before authority or restore them over an early Projects filter',async()=>{
 const key=projectIndexSessionKey('fictional-staff','https://fictional.invalid');rememberProjectIndexPosition('/staff/projects',840,key,false);
 const get=vi.spyOn(Storage.prototype,'getItem'),scroll=vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
 const read=vi.fn(async(params:Parameters<typeof projectsFixture>[0])=>projectsFixture(params));
 const root=(canonical:string,leaf:ReactNode)=><QueryClientProvider client={client}><Host canonical={canonical} href="/staff/projects" leaf={leaf}/></QueryClientProvider>;
 const view=renderIntoDocument(root('/staff/contacts',null));act(()=>view.container.querySelector<HTMLButtonElement>('[data-navigate]')!.click());await flush();
 expect(get.mock.calls.some(([value])=>value===key)).toBe(false);
 const field=view.container.querySelector<HTMLInputElement>('#projectSearch')!;input(field,'Fixture');
 await act(async()=>{view.root.render(root('/staff/projects',<PortalGuardedPage pathname="/staff/projects" completion={{}}><ProjectsIndexClient readLoader={read} readOnly/></PortalGuardedPage>));await new Promise(resolve=>setTimeout(resolve,220));});await flush();
 expect(scroll.mock.calls).not.toContainEqual([{top:840,behavior:'instant'}]);expect(field.value).toBe('Fixture');expect(read.mock.calls[0][0].search).toBe('Fixture');view.unmount();
});

it('keeps a returned Dashboard composer independent of an older in-flight task completion',async()=>{
 const completion={},write=deferred<Response>();const fetcher=vi.fn(()=>write.promise);vi.stubGlobal('fetch',fetcher);
 const leaf=<PortalGuardedPage pathname="/dashboard" completion={completion}><DashboardClient queueMode="today" loader={async()=>dashboardFixture()} visitsLoader={async()=>visitsFixture()}/></PortalGuardedPage>;
 const root=(canonical:string,body:ReactNode)=><QueryClientProvider client={client}><Host canonical={canonical} href="/staff/projects" leaf={body}/></QueryClientProvider>;
 window.history.replaceState(null,'','/dashboard');const view=renderIntoDocument(root('/dashboard',leaf));await flush();
 input(view.container.querySelector<HTMLInputElement>('[aria-label="New dashboard task"]')!,'Old request');
 act(()=>view.container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await flush();expect(fetcher).toHaveBeenCalledTimes(1);
 act(()=>view.container.querySelector<HTMLButtonElement>('[data-navigate]')!.click());await flush();expect(view.container.querySelector('h1')?.textContent).toBe('Projects');
 act(()=>{window.history.replaceState(null,'','/dashboard');window.dispatchEvent(new PopStateEvent('popstate'));});
 await act(async()=>{view.root.render(root('/dashboard',leaf));});await flush();
 const field=view.container.querySelector<HTMLInputElement>('[aria-label="New dashboard task"]')!;input(field,'Keep this new title');
 await act(async()=>write.resolve(new Response(JSON.stringify({task:{id:'fictional-created',title:'Old request',completedAt:null,createdAt:'2026-10-23T00:00:00Z',updatedAt:'2026-10-23T00:00:00Z'}}),{status:200})));await flush();
 expect(field.value).toBe('Keep this new title');expect(fetcher).toHaveBeenCalledTimes(1);view.unmount();
});

it('restores a verified saved Projects reading position when no early filter overrides it',async()=>{
 const key=projectIndexSessionKey('fictional-staff','https://fictional.invalid');rememberProjectIndexPosition('/staff/projects',840,key,false);
 const scroll=vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
 const root=(canonical:string,leaf:ReactNode)=><QueryClientProvider client={client}><Host canonical={canonical} href="/staff/projects" leaf={leaf}/></QueryClientProvider>;
 const view=renderIntoDocument(root('/staff/contacts',null));act(()=>view.container.querySelector<HTMLButtonElement>('[data-navigate]')!.click());await flush();
 await act(async()=>{view.root.render(root('/staff/projects',<PortalGuardedPage pathname="/staff/projects" completion={{}}><ProjectsIndexClient readLoader={async p=>projectsFixture(p)} readOnly/></PortalGuardedPage>));});await flush();
 expect(scroll).toHaveBeenCalledWith({top:840,behavior:'instant'});view.unmount();
});

it('fills complete Dashboard sections independently in the same guarded frame and retains them through secondary failure and Retry',async()=>{
 const d=dashboardFixture();const values:DashboardParts={snapshot:{updatedAtIso:d.updatedAtIso,kpis:d.kpis,schedule:d.schedule,siteVisits:d.siteVisits},pipelineCounts:{pipelineCounts:d.pipelineCounts,pipelineCountsScope:d.pipelineCountsScope,pipelineCountsAvailable:d.pipelineCountsAvailable},projectStateCounts:{projectStateCounts:d.projectStateCounts,projectStateCountsAvailable:d.projectStateCountsAvailable},projectWorkQueue:{projectWorkQueue:d.projectWorkQueue,projectWorkQueueAvailable:d.projectWorkQueueAvailable},recentEstimates:{recentEstimates:d.recentEstimates},recentActivity:{recentActivity:d.recentActivity},personalTasks:{personalTasks:d.personalTasks}};
 let reject!:(reason:Error)=>void;const slow=new Promise<DashboardParts['snapshot']>((_,no)=>{reject=no;});const portfolio=deferred<DashboardParts['pipelineCounts']>();let failed=true;
 const fetcher=vi.fn(async(_path,init:RequestInit)=>dashboardPartsResponse(new Request('http://localhost/api/dashboard',{signal:init.signal}),'today',()=>Object.fromEntries(dashboardPartNames.map(name=>[name,failed&&name==='snapshot'?slow:failed&&name==='pipelineCounts'?portfolio.promise:Promise.resolve(values[name])])) as DashboardPartReads));vi.stubGlobal('fetch',fetcher);
 const root=(canonical:string,leaf:ReactNode)=><QueryClientProvider client={client}><Host canonical={canonical} href="/dashboard" leaf={leaf}/></QueryClientProvider>;
 const view=renderIntoDocument(root('/staff/contacts',null));act(()=>view.container.querySelector<HTMLButtonElement>('[data-navigate]')!.click());await flush();
 const card=view.container.querySelector('[aria-label="Project portfolio"]'),field=view.container.querySelector('[aria-label="New dashboard task"]');expect(fetcher).not.toHaveBeenCalled();
 await act(async()=>{view.root.render(root('/dashboard',<PortalGuardedPage pathname="/dashboard" completion={{}}><DashboardClient queueMode="today" visitsLoader={async()=>visitsFixture()} readOnly/></PortalGuardedPage>));});await flush();
 await act(async()=>portfolio.resolve(values.pipelineCounts));await flush();
 expect(view.container.querySelector('[data-dashboard-portfolio="ready"]')).toBe(card);expect(view.container.querySelector('[data-dashboard-background-ready="false"]')).not.toBeNull();expect(client.getQueryData(qk.dashboard.data('today'))).toBeUndefined();
 await act(async()=>reject(new Error('Synthetic secondary failure')));await flush();
 expect(view.container.textContent).toContain('Some Dashboard sections could not load');expect(view.container.querySelector('[data-dashboard-portfolio="ready"]')).toBe(card);expect(view.container.querySelector('[aria-label="New dashboard task"]')).toBe(field);
 failed=false;act(()=>[...view.container.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Retry')!.click());await flush();
 expect(view.container.querySelector('[data-dashboard-background-ready="true"]')).not.toBeNull();expect(fetcher).toHaveBeenCalledTimes(2);expect(client.getQueryData(qk.dashboard.data('today'))).toEqual(d);view.unmount();
});

 it('continues to adopt genuine same-path Projects search after preserving the first held entry selection',async()=>{
  const read=vi.fn(async(p:Parameters<typeof projectsFixture>[0])=>projectsFixture(p));const completion={};
  const leaf=<PortalGuardedPage pathname="/staff/projects" completion={completion}><ProjectsIndexClient readLoader={read} readOnly/></PortalGuardedPage>;
  const root=(canonical:string,body:ReactNode)=><QueryClientProvider client={client}><Host canonical={canonical} href="/staff/projects" leaf={body}/></QueryClientProvider>;
  const view=renderIntoDocument(root('/staff/contacts',null));act(()=>view.container.querySelector<HTMLButtonElement>('[data-navigate]')!.click());await flush();
  const field=view.container.querySelector<HTMLInputElement>('#projectSearch')!;input(field,'Fixture');
  window.history.replaceState(window.history.state,'','/staff/projects');
  await act(async()=>{view.root.render(root('/staff/projects',leaf));await new Promise(resolve=>setTimeout(resolve,220));});await flush();
  expect(field.value).toBe('Fixture');expect(new URLSearchParams(window.location.search).get('q')).toBe('Fixture');expect(read).toHaveBeenCalledTimes(1);
  // A subsequent history/search selection owns the URL. It is not another adoption of the old entry.
  window.history.replaceState(window.history.state,'','/staff/projects?q=Beta');
  await act(async()=>{view.root.render(root('/staff/projects',leaf));await new Promise(resolve=>setTimeout(resolve,220));});await flush();
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,200));});
  expect(view.container.querySelector('#projectSearch')).toBe(field);expect(field.value).toBe('Beta');expect(new URLSearchParams(window.location.search).get('q')).toBe('Beta');expect(read.mock.calls.at(-1)?.[0].search).toBe('Beta');view.unmount();
 });
