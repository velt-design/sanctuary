'use client';
import {preparePipelineCounts} from './_components/PipelineCountsCard';

import type { DashboardPartLoader } from '@/lib/dashboard/dashboardPartTransport';
import PageMessagePanel from '@/components/page-state/PageMessagePanel';
import type { DashboardData, QueueMode } from '@/lib/dashboard/types';
import type { VisitSnapshot } from '@/lib/siteVisits/contract';
import DashboardView from './DashboardView';
import {ProjectWorkQueueCardRows} from './_components/ProjectWorkQueueCard';
import {RecentActivityCardRows} from './_components/RecentActivityCard';
import {RecentEstimatesCardRows} from './_components/RecentEstimatesCard';

import { useDashboardData } from './useDashboardData';
import {useLayoutEffect} from 'react';
import {useDashboardWorkspace} from './DashboardWorkspace';
import TodayVisits from '@/components/site-visits/TodayVisits';
import DashboardTasksCard from './_components/DashboardTasksCard.client';

export default function DashboardClient({
  queueMode, loader, partsLoader, visitsLoader, readOnly=false,
}: {
  queueMode: QueueMode;partsLoader?:DashboardPartLoader;loader?:()=>Promise<DashboardData>;visitsLoader?:()=>Promise<VisitSnapshot>;readOnly?:boolean;
}) {
  const dashboard = useDashboardData(queueMode,loader,partsLoader);
  const workspace=useDashboardWorkspace();
  const source=dashboard.state==='unavailable'?null:dashboard.data;
  const work=dashboard.parts?.projectWorkQueue??source,activity=dashboard.parts?.recentActivity??source,estimates=dashboard.parts?.recentEstimates??source;
  const pipeline=dashboard.parts?.pipelineCounts??source;
  const evidence={portfolioCounts:workspace&&pipeline?preparePipelineCounts(pipeline.pipelineCounts):undefined,cardRows:{work:<ProjectWorkQueueCardRows items={work?.projectWorkQueue??[]}/>,activity:<RecentActivityCardRows items={activity?.recentActivity??[]}/>,estimates:<RecentEstimatesCardRows items={estimates?.recentEstimates??[]}/>},data:dashboard.state==='unavailable'?null:dashboard.data??null,parts:dashboard.state==='unavailable'?{}:dashboard.parts,
    state:dashboard.state,onRetry:()=>void dashboard.retry()};
  useLayoutEffect(()=>{workspace?.publishData(evidence);});
  useLayoutEffect(()=>()=>workspace?.publishData(null),[workspace?.publishData]);
  if(workspace){
    if(dashboard.state==='unavailable')return null;
    const tasks=dashboard.parts.personalTasks??dashboard.data;
    return <><TodayVisits loader={visitsLoader}/><DashboardTasksCard initialTasks={tasks?.personalTasks??null}
      pending={!tasks&&dashboard.state!=='refresh-failed'} readOnly={readOnly}/></>;
  }

  if (dashboard.state === 'unavailable') {
    return (
      <div
        data-ui-foundation-consumer="dashboard"
        data-dashboard-state="unavailable"
        data-dashboard-background-ready="false"
      >
        <PageMessagePanel
          title="Dashboard unavailable"
          description="Your current session cannot access the Dashboard."
        />
      </div>
    );
  }

  return (
    <DashboardView
      data={dashboard.data??null} parts={dashboard.parts}
      state={dashboard.state} visitsLoader={visitsLoader} readOnly={readOnly}
      onRetry={() => void dashboard.retry()}
    />
  );
}
