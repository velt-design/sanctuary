'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {QueryClient,QueryClientProvider,useQueryClient} from '@tanstack/react-query';
import {readDashboardPartsFrom,type DashboardPartLoader} from '@/lib/dashboard/dashboardPartTransport';
import DashboardClient from '@/app/dashboard/DashboardClient';
import CalculatorJourney from './CalculatorJourney';
import ProjectJourney from './ProjectJourney';
import OperationalJourney from './OperationalJourney';
import type {OperationalReads} from './operationalData';
import RunningJobsClient from '@/app/staff/projects/running-jobs/RunningJobsClient';
import {PortalRouteTransitionProvider,PortalInstantRouteContent,usePortalRouteTransition} from '@/components/page-state/PortalRouteTransition';
import {visitsFixture,sheetFixture} from './data';
function delayed<T>(read:()=>T,delay:number,failures:number){return async()=>{await new Promise(resolve=>setTimeout(resolve,failures?200:delay));if(failures>0){failures--;throw new Error('Synthetic read failure. Retry reads the same fictional source.');}return read();};}
export default function Fixture({dashboardFailure=false,sheetFailure=false,visitsFailure=false,operationalReads={}}:{operationalReads?:OperationalReads;dashboardFailure?:boolean;sheetFailure?:boolean;visitsFailure?:boolean}){
 const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:false,retryDelay:10}}}));
 const [loaders]=useState(()=>{let failures=dashboardFailure?1:0;const dashboardParts:DashboardPartLoader=(queue,signal,publish)=>readDashboardPartsFrom(`/qa/portal-progressive-fixture/dashboard-read?queue=${queue}${failures-->0?'&failure=1':''}`,queue,signal,publish);return {dashboardParts,visits:delayed(visitsFixture,650,visitsFailure?1:0),sheet:delayed(sheetFixture,1800,sheetFailure?1:0)};});
 return <QueryClientProvider client={client}><PortalRouteTransitionProvider><Workspace loaders={loaders} operationalReads={operationalReads}/></PortalRouteTransitionProvider></QueryClientProvider>;
}
function Workspace({loaders,operationalReads}:{operationalReads:OperationalReads;loaders:{dashboardParts:DashboardPartLoader;visits:()=>Promise<ReturnType<typeof visitsFixture>>;sheet:()=>Promise<ReturnType<typeof sheetFixture>>}}){
 const client=useQueryClient();
 const params=useSearchParams(),operational=['costing','mapping','payout'].includes(params.get('view')??''),sheet=params.get('view')==='sheet',project=params.get('view')==='project',calculator=params.get('view')==='calculator',transition=usePortalRouteTransition();
 return <><aside id="fictional-record-notice" style={{padding:16}}><p>Fictional, read-only data. No customer systems or mutations. Controlled server stream delays: portfolio 350 ms, states 600 ms, tasks 900 ms, secondary reads up to 2200 ms. Visits 650 ms, Running Jobs 1800 ms. Operational reads use fictional 700 ms invoice context and 1200–1800 ms sources. All operational commands are disabled. Domain links retain their protected destinations.</p><button type="button" onClick={()=>void client.invalidateQueries({queryKey:["dashboard","data"]})}>Refresh fictional Dashboard read</button><nav aria-label="Progressive fixture views">{(['dashboard','sheet','project','calculator','costing','mapping','payout'] as const).map(view=>{const query=new URLSearchParams(params);query.set('view',view);if(view==='calculator')query.set('editEstimateId','fictional-saved-design');else query.delete('editEstimateId');const href='/qa/portal-progressive-fixture?'+query;return <Link key={view} style={{marginRight:24}} href={href} aria-current={(params.get('view')??'dashboard')===view?'page':undefined} onClick={event=>{transition.beginRouteTransition({href,label:view==='sheet'?'Running Jobs':view==='project'?'Project detail':view==='calculator'?'Calculator':view==='costing'?'Pricing':view==='mapping'?'Mapping':view==='payout'?'Payout':'Dashboard',control:event.currentTarget});transition.beginInstantRoute(view==='sheet'?'running-jobs':view==='project'?'project-detail':'dashboard');}}>{view==='sheet'?'Running Jobs':view==='project'?'Project detail':view==='calculator'?'Calculator':view==='costing'?'Pricing':view==='mapping'?'Mapping':view==='payout'?'Payout':'Dashboard'}</Link>;})}</nav></aside><PortalInstantRouteContent>{operational?<OperationalJourney key={`${params.get('view')}:${params.get('operationalFailure')}`} reads={operationalReads}/>:calculator?<CalculatorJourney/>:project?<ProjectJourney/>:sheet?<RunningJobsClient loader={loaders.sheet} readOnly/>:<DashboardClient queueMode="today" partsLoader={loaders.dashboardParts} visitsLoader={loaders.visits} readOnly/>}</PortalInstantRouteContent></>;
}
