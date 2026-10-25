'use client';

import GuardedGlobalPortalSearch from '@/components/layout/GuardedGlobalPortalSearch';
import {GlobalPortalSearchStateProvider} from '@/components/layout/GlobalPortalSearchState';

import { Suspense, use, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalQueryClientScope } from '@/lib/react-query/PortalQueryClientContext';
import DashboardClient from '@/app/dashboard/DashboardClient';
import ProjectInstantNavigationProvider from '@/app/staff/projects/ProjectInstantNavigation';
import ProjectsIndexClient from '@/app/staff/projects/ProjectsIndexClient';
import WorkQueueClient from '@/app/staff/projects/work-queue/WorkQueueClient';
import DesignPackagesClient from '@/app/staff/projects/design-packages/DesignPackagesClient';
import RunningJobsClient from '@/app/staff/projects/running-jobs/RunningJobsClient';
import {projectsFixture,draftingFixture,sheetFixture,visitsFixture} from './data';
import {workQueueFixtureEntries,workQueueFixtureStaff} from '../project-work-queue-fixture/fixtures';
import {readDashboardPartsFrom} from '@/lib/dashboard/dashboardPartTransport';
import ContactsIndexClient from '@/app/staff/contacts/GuardedContactsIndexClient';
import ScheduleClient from '@/app/staff/schedule/ScheduleClient';
import type { ContactsIndexLoader } from '@/app/staff/contacts/useContactsIndexData';
import { PortalGuardedPage, PortalPageSourceProvider, usePortalPageSourceController } from '@/components/page-state/PortalPageSource';
import PortalActualFrames from '@/components/page-state/PortalActualFrames';
import { progressiveScheduleSnapshot } from '../schedule-progressive-fixture/snapshot';

export type FictionalFrameGuard = { unavailable: boolean; completion: Record<string, never> };
export type Route = 'contacts' | 'schedule' | 'dashboard' | 'projects' | 'work-queue' | 'drafting' | 'running';
const routePaths:Record<Route,string>={contacts:'/staff/contacts',schedule:'/staff/schedule',dashboard:'/dashboard',projects:'/staff/projects','work-queue':'/staff/projects/work-queue',drafting:'/staff/projects/design-packages',running:'/staff/projects/running-jobs'};
const routeFrom=(value:string|null):Route=>value&&Object.hasOwn(routePaths,value)?value as Route:'contacts';
const pathFor = (route: Route) => routePaths[route];

/** Existing gated QA lane. The public selection and server-adopted selection are deliberately separate. */
export default function GuardedFrameFixture({ route, guard }: {
  route: Route; guard: Promise<FictionalFrameGuard>;
}) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retryDelay: 25 } } }));
  return <QueryClientProvider client={client}><PortalQueryClientScope client={client}><Journey route={route} guard={guard} /></PortalQueryClientScope></QueryClientProvider>;
}

function Journey({ route, guard }: { route: Route; guard: Promise<FictionalFrameGuard> }) {
  const params = useSearchParams();
  const router = useRouter();
  const selectedRoute=routeFrom(params.get('route'));
  const selection = new URLSearchParams(params);
  selection.delete('fixture');selection.delete('route');selection.delete('guard');selection.delete('readFailure');
  if (selectedRoute === 'contacts'||selectedRoute==='projects') selection.set('q', params.get('q') ?? 'Alpha');
  else if(selectedRoute==='schedule')selection.set('view', params.get('view') === 'gantt' ? 'gantt' : 'board');
  const source = usePortalPageSourceController(pathFor(selectedRoute), pathFor(route), selection.toString());
  useEffect(() => {
    window.addEventListener('popstate', source.cancel);
    return () => window.removeEventListener('popstate', source.cancel);
  }, [source.cancel]);
  const navigate = (nextRoute: Route, scenario: string, replace = false, q = 'Alpha', scheduleView = 'board') => {
    const query = new URLSearchParams(params);
    query.set('fixture', 'guarded-frames'); query.set('view', nextRoute === 'schedule' ? scheduleView : 'contacts'); query.set('route', nextRoute); query.set('guard', scenario);
    query.set('q', q);
    const nextSelection=new URLSearchParams(query);
    for(const key of ['fixture','route','guard','readFailure'])nextSelection.delete(key);
    if(nextRoute!=='schedule')nextSelection.delete('view');
    source.begin(`${pathFor(nextRoute)}?${nextSelection}`);
    const href = `/qa/portal-progressive-fixture?${query}`;
    if (!replace) window.history.pushState(window.history.state, '', href);
    // Router owns the actual request/recovery; no local fabricated ready state.
    router.replace(href, { scroll: false });
  };
  const retry = () => navigate(selectedRoute, 'complete', true, params.get('q') ?? 'Alpha', params.get('view') ?? 'board');
  return <PortalPageSourceProvider value={{ ...source, retry }}>
    <GlobalPortalSearchStateProvider><aside style={{ padding: 16 }}>
      <p>Fictional read-only frame proof. Controlled server guard: 1800 ms. Record reads: 700 ms.
        This models guarded source adoption; the QA pathname is not a production route timing.
        Do not invoke Schedule record commands. There is no synthetic mutation backend.</p>
      <nav aria-label="Guarded frame scenarios">
        <button onClick={() => navigate('contacts', 'complete')}>Contacts A</button>
        <button onClick={() => navigate('contacts', 'complete', false, 'Beta')}>Contacts B</button>
        {(['dashboard','projects','work-queue','drafting','running'] as const).map(route=><button key={route} onClick={()=>navigate(route,'complete')}>{route}</button>)}
        <button onClick={() => navigate('schedule', 'complete')}>Board</button>
        <button onClick={() => navigate('schedule', 'complete', false, 'Alpha', 'gantt')}>Gantt</button>
        <button onClick={() => navigate(selectedRoute, 'denied', false, params.get('q') ?? 'Alpha', params.get('view') ?? 'board')}>Deny selected read</button>
        <button onClick={() => navigate(selectedRoute, 'complete', false, params.get('q') ?? 'Alpha', params.get('view') ?? 'board')}>Fresh selected read</button>
      </nav>
    </aside>
    <PortalActualFrames navigationPath="/qa/portal-progressive-fixture"><Suspense fallback={null}>
      <GuardedLeaf route={route} guard={guard} failure={params.get('readFailure') === '1'} />
    </Suspense></PortalActualFrames>
  </GlobalPortalSearchStateProvider></PortalPageSourceProvider>;
}

function GuardedLeaf({ route, guard, failure }: { route: Route; guard: Promise<FictionalFrameGuard>; failure: boolean }) {
  const result = use(guard);
  const loaders = useMemo(() => {
    let contactFailures = failure ? 3 : 0;
    let scheduleFailures = failure ? 2 : 0;
    const contacts: ContactsIndexLoader = async params => {
      await new Promise(resolve => setTimeout(resolve, 700));
      if (contactFailures-- > 0) throw new Error('Fictional contact read failed. Retry uses this same read owner.');
      const rows = ['Alpha', 'Beta'].map(name => ({ id: `ct_fictional_${name.toLowerCase()}`, displayName: `Fixture ${name}`,
        email: `${name.toLowerCase()}@example.test`, phone: '', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' }))
        .filter(contact => contact.displayName.toLowerCase().includes(params.search.trim().toLowerCase()));
      return { contacts: { rows,
      totalCount: rows.length, truncated: false, page: params.page, pageSize: params.pageSize, totalPages: 1 },
      query: { search: params.search.trim(), sort: params.sort }, generatedAt: new Date().toISOString() };
    };
    const schedule = async (signal: AbortSignal) => {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 700);
        signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Aborted')); }, { once: true });
      });
      if (scheduleFailures-- > 0) throw new Error('Fictional schedule read failed. Retry uses this same read owner.');
      return progressiveScheduleSnapshot();
    };
    let attempts=failure?(route==='drafting'||route==='running'?4:3):0;
    const read=async<T,>(value:()=>T)=>{await new Promise(resolve=>setTimeout(resolve,700));if(attempts-->0)throw new Error('Fictional selected read failed. Retry uses the same read owner.');return value();};
    let dashboardFailures=failure?1:0;
    return {contacts,schedule:{board:schedule,gantt:schedule},projects:(params:Parameters<typeof projectsFixture>[0])=>read(()=>projectsFixture(params)),
      queue:()=>read(()=>({entries:workQueueFixtureEntries,generatedAt:new Date().toISOString()})),staff:async()=>workQueueFixtureStaff,
      drafting:()=>read(draftingFixture),running:()=>read(sheetFixture),visits:()=>read(visitsFixture),
      dashboard:(queue:import('@/lib/dashboard/types').QueueMode,signal:AbortSignal,publish:Parameters<import('@/lib/dashboard/dashboardPartTransport').DashboardPartLoader>[2])=>readDashboardPartsFrom('/qa/portal-progressive-fixture/dashboard-read?queue='+queue+(dashboardFailures-->0?'&failure=1':''),queue,signal,publish)};
  }, [failure,result.completion,route]);
  return <PortalGuardedPage pathname={pathFor(route)} completion={result.completion} unavailable={result.unavailable}><GuardedGlobalPortalSearch/>
    {route === 'contacts' ? <ContactsIndexClient readLoader={loaders.contacts} readOnly />
      :route==='dashboard'?<DashboardClient queueMode="today" partsLoader={loaders.dashboard} visitsLoader={loaders.visits} readOnly/>
      :route==='projects'?<ProjectInstantNavigationProvider><ProjectsIndexClient readLoader={loaders.projects} readOnly/></ProjectInstantNavigationProvider>
      :route==='work-queue'?<WorkQueueClient queueLoader={loaders.queue} staffLoader={loaders.staff} readOnly/>
      :route==='drafting'?<DesignPackagesClient loader={loaders.drafting} readOnly/>
      :route==='running'?<RunningJobsClient loader={loaders.running} readOnly/>
      : <ScheduleClient navigationPath="/qa/portal-progressive-fixture" snapshotLoaders={loaders.schedule} />}
  </PortalGuardedPage>;
}
