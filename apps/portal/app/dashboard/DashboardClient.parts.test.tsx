import {act, StrictMode} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {renderIntoDocument} from '../../../../test/reactHarness';
import DashboardClient from './DashboardClient';
import {dashboardFixture,visitsFixture} from '@/app/qa/portal-progressive-fixture/data';
import {dashboardPartsResponse} from '@/lib/dashboard/dashboardPartResponse.server';
import type {DashboardPartReads} from '@/lib/dashboard/getDashboardData';
import {dashboardPartNames,type DashboardParts} from '@/lib/dashboard/dashboardParts';
import {qk} from '@/lib/queries/keys';
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn()}),usePathname:()=>'/dashboard',useSearchParams:()=>new URLSearchParams()}));
vi.mock('@/components/layout/GlobalPortalSearch.client',()=>({default:()=>null}));
function deferred<T>(){let resolve!:(value:T)=>void;return {promise:new Promise<T>(yes=>{resolve=yes;}),resolve:(value:T)=>resolve(value)};}
function parts():DashboardParts{
 const d=dashboardFixture();return {snapshot:{updatedAtIso:d.updatedAtIso,kpis:d.kpis,schedule:d.schedule,siteVisits:d.siteVisits},pipelineCounts:{pipelineCounts:d.pipelineCounts,pipelineCountsScope:d.pipelineCountsScope,pipelineCountsAvailable:d.pipelineCountsAvailable},projectStateCounts:{projectStateCounts:d.projectStateCounts,projectStateCountsAvailable:d.projectStateCountsAvailable},projectWorkQueue:{projectWorkQueue:d.projectWorkQueue,projectWorkQueueAvailable:d.projectWorkQueueAvailable},recentEstimates:{recentEstimates:d.recentEstimates},recentActivity:{recentActivity:d.recentActivity},personalTasks:{personalTasks:d.personalTasks}};
}
const flush=()=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,30));});
async function until(assertion:()=>void){let last:unknown;for(let attempt=0;attempt<30;attempt++){try{assertion();return;}catch(error){last=error;}await flush();}throw last;}
afterEach(()=>{vi.unstubAllGlobals();document.body.innerHTML='';});
it('delivers complete portfolio and state counts before independent secondary data through the real parser and response, including StrictMode and Refresh',async()=>{
 const data=parts(),slow=deferred<DashboardParts['snapshot']>();let count=0;
 const fetcher=vi.fn(async(_path:string,init:RequestInit)=>{
  count++;
  const reads=Object.fromEntries(dashboardPartNames.map(name=>[name,name==='snapshot'?slow.promise:Promise.resolve(data[name])])) as DashboardPartReads;
  return dashboardPartsResponse(new Request('http://localhost/api/dashboard',{signal:init.signal}), 'today',()=>reads);
 });vi.stubGlobal('fetch',fetcher);
 const client=new QueryClient({defaultOptions:{queries:{retryDelay:0}}});
 const view=renderIntoDocument(<StrictMode><QueryClientProvider client={client}><DashboardClient queueMode="today" visitsLoader={async()=>visitsFixture()} readOnly/></QueryClientProvider></StrictMode>);
 const portfolio=view.container.querySelector('[aria-label="Project portfolio"]'),field=view.container.querySelector('[aria-label="New dashboard task"]');
 await flush();expect(count).toBe(1);expect(view.container.querySelector('[data-dashboard-portfolio="ready"]')).toBe(portfolio);
 expect(view.container.querySelector('[data-project-state-counts="ready"]')).not.toBeNull();
 expect(view.container.querySelector('[data-dashboard-background-ready="false"]')).not.toBeNull();
 expect(view.container.textContent).toContain('Review fictional courtyard plan');
 expect(client.getQueryData(qk.dashboard.data('today'))).toBeUndefined();
 await act(async()=>slow.resolve(data.snapshot));await flush();expect(view.container.querySelector('[data-dashboard-background-ready="true"]')).not.toBeNull();
 expect(view.container.querySelector('[aria-label="Project portfolio"]')).toBe(portfolio);expect(view.container.querySelector('[aria-label="New dashboard task"]')).toBe(field);
 await act(async()=>{await client.invalidateQueries({queryKey:qk.dashboard.data('today')});});
 expect(fetcher).toHaveBeenCalledTimes(2);expect(client.getQueryData(qk.dashboard.data('today'))).toEqual(Object.assign({},...dashboardPartNames.map(name=>data[name])));
 view.unmount();client.clear();
});
it('discards streamed values after a terminal truncated response and retries the actual query',async()=>{
 const data=parts();let healthy=false;
 vi.stubGlobal('fetch',vi.fn(async(_path,init:RequestInit)=>{
  if(healthy)return dashboardPartsResponse(new Request('http://localhost/api/dashboard',{signal:init.signal}),'today',()=>Object.fromEntries(dashboardPartNames.map(name=>[name,Promise.resolve(data[name])])) as DashboardPartReads);
  return new Response(JSON.stringify({part:'pipelineCounts',queue:'today',value:data.pipelineCounts})+'\n',{headers:{'content-type':'application/x-ndjson'}});
 }));
 const client=new QueryClient({defaultOptions:{queries:{retryDelay:0}}});
 const view=renderIntoDocument(<QueryClientProvider client={client}><DashboardClient queueMode="today" visitsLoader={async()=>visitsFixture()} readOnly/></QueryClientProvider>);
 const portfolio=view.container.querySelector('[aria-label="Project portfolio"]');await until(()=>expect(view.container.textContent).toContain('Could not load the dashboard'));
 expect(view.container.textContent).toContain('Could not load the dashboard');expect(view.container.querySelector('[data-dashboard-portfolio="ready"]')).toBeNull();
 healthy=true;act(()=>[...view.container.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Retry')!.click());await flush();
 expect(view.container.querySelector('[data-dashboard-portfolio="ready"]')).toBe(portfolio);expect(view.container.textContent).toContain('Review fictional courtyard plan');view.unmount();client.clear();
});
it('aborts the old queue read and rejects late frames when selection changes',async()=>{
 const first=deferred<DashboardParts['pipelineCounts']>(),data=parts();let oldSignal:AbortSignal|null=null;
 vi.stubGlobal('fetch',vi.fn(async(path:string,init:RequestInit)=>{
  const queue=new URL(path,'http://localhost').searchParams.get('queue')==='next7'?'next7':'today';
  if(queue==='today')oldSignal=init.signal!;
  const reads=Object.fromEntries(dashboardPartNames.map(name=>[name,queue==='today'&&name==='pipelineCounts'?first.promise:Promise.resolve(data[name])])) as DashboardPartReads;
  return dashboardPartsResponse(new Request('http://localhost/api/dashboard',{signal:init.signal}),queue,()=>reads);
 }));
 const client=new QueryClient({defaultOptions:{queries:{retryDelay:0}}});
 const ui=(queue:'today'|'next7')=><QueryClientProvider client={client}><DashboardClient queueMode={queue} visitsLoader={async()=>visitsFixture()} readOnly/></QueryClientProvider>;
 const view=renderIntoDocument(ui('today'));await until(()=>expect(oldSignal).not.toBeNull());view.rerender(ui('next7'));await until(()=>expect(oldSignal!.aborted).toBe(true));
 await until(()=>expect(client.getQueryData(qk.dashboard.data('next7'))).toBeDefined());
 const selected=client.getQueryData(qk.dashboard.data('next7'));
 await act(async()=>first.resolve({...data.pipelineCounts,pipelineCounts:{NEW:999}}));await flush();expect(client.getQueryData(qk.dashboard.data('next7'))).toBe(selected);
 expect(view.container.textContent).not.toContain('999');view.unmount();client.clear();
});

it('keeps complete same-request portfolio counts when only a secondary source fails, then retries without faking complete cache data',async()=>{
 const data=parts();let fail=true;const calls=vi.fn(async(_path,init:RequestInit)=>dashboardPartsResponse(new Request('http://localhost/api/dashboard',{signal:init.signal}),'today',()=>Object.fromEntries(dashboardPartNames.map(name=>[name,name==='snapshot'&&fail?Promise.reject(new Error('Synthetic secondary failure')):Promise.resolve(data[name])])) as DashboardPartReads));vi.stubGlobal('fetch',calls);
 const client=new QueryClient({defaultOptions:{queries:{retryDelay:0}}});
 const view=renderIntoDocument(<QueryClientProvider client={client}><DashboardClient queueMode="today" visitsLoader={async()=>visitsFixture()} readOnly/></QueryClientProvider>);
 await until(()=>expect(view.container.textContent).toContain('Some Dashboard sections could not load'));
 expect(view.container.textContent).toContain('Some Dashboard sections could not load');expect(view.container.querySelector('[data-dashboard-portfolio="ready"]')).not.toBeNull();expect(view.container.querySelector('[data-project-state-counts="ready"]')).not.toBeNull();expect(client.getQueryData(qk.dashboard.data('today'))).toBeUndefined();expect(calls).toHaveBeenCalledTimes(1);
 fail=false;act(()=>[...view.container.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Retry')!.click());await flush();expect(view.container.querySelector('[data-dashboard-background-ready="true"]')).not.toBeNull();expect(calls).toHaveBeenCalledTimes(2);view.unmount();client.clear();
});

it.each(['projectStateCounts','pipelineCounts'] as const)('shows each source by its own readiness when %s arrives first',async first=>{
 const data=parts(),pipeline=deferred<DashboardParts['pipelineCounts']>(),states=deferred<DashboardParts['projectStateCounts']>();
 vi.stubGlobal('fetch',vi.fn(async(_path,init:RequestInit)=>dashboardPartsResponse(new Request('http://localhost/api/dashboard',{signal:init.signal}),'today',()=>Object.fromEntries(dashboardPartNames.map(name=>[name,name==='pipelineCounts'?pipeline.promise:name==='projectStateCounts'?states.promise:Promise.resolve(data[name])])) as DashboardPartReads)));
 const client=new QueryClient({defaultOptions:{queries:{retryDelay:0}}});
 const view=renderIntoDocument(<QueryClientProvider client={client}><DashboardClient queueMode="today" visitsLoader={async()=>visitsFixture()} readOnly/></QueryClientProvider>);
 const active=view.container.querySelector('[data-project-state-counts] strong');
 const enquiry=view.container.querySelector('[data-dashboard-portfolio] a span:last-child');
 await act(async()=>{if(first==='projectStateCounts')states.resolve(data.projectStateCounts);else pipeline.resolve(data.pipelineCounts);});
 await until(()=>expect(view.container.querySelector(first==='projectStateCounts'?'[data-project-state-counts="ready"]':'[data-dashboard-portfolio="ready"]')).not.toBeNull());
 expect(active?.textContent).toBe(first==='projectStateCounts'?'13':'Reading…');
 expect(enquiry?.textContent).toBe(first==='pipelineCounts'?'7':'Reading…');
 await act(async()=>{states.resolve(data.projectStateCounts);pipeline.resolve(data.pipelineCounts);});
 await until(()=>expect(view.container.querySelector('[data-dashboard-background-ready="true"]')).not.toBeNull());
 expect(view.container.querySelector('[data-project-state-counts] strong')).toBe(active);expect(active?.textContent).toBe('13');expect(enquiry?.textContent).toBe('7');view.unmount();client.clear();
});
