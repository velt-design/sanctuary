import {preparePipelineCounts} from './_components/PipelineCountsCard';
import type { ComponentProps } from 'react';
import type { VisitSnapshot } from '@/lib/siteVisits/contract';
import DashboardFrame from './DashboardFrame';
import {ProjectWorkQueueCardRows} from './_components/ProjectWorkQueueCard';
import {RecentActivityCardRows} from './_components/RecentActivityCard';
import {RecentEstimatesCardRows} from './_components/RecentEstimatesCard';

import DashboardTasksCard from './_components/DashboardTasksCard.client';
import TodayVisits from '@/components/site-visits/TodayVisits';

export default function DashboardView({ visitsLoader,readOnly=false,...props }:
  Omit<ComponentProps<typeof DashboardFrame>,'visits'|'tasksCard'> & {visitsLoader?:()=>Promise<VisitSnapshot>;readOnly?:boolean}) {
  const tasks=props.parts?.personalTasks??props.data;
  const work=props.parts?.projectWorkQueue??props.data,activity=props.parts?.recentActivity??props.data,estimates=props.parts?.recentEstimates??props.data;
  return <DashboardFrame {...props} portfolioCounts={(props.parts?.pipelineCounts??props.data)?preparePipelineCounts((props.parts?.pipelineCounts??props.data)!.pipelineCounts):undefined} cardRows={{work:<ProjectWorkQueueCardRows items={work?.projectWorkQueue??[]}/>,activity:<RecentActivityCardRows items={activity?.recentActivity??[]}/>,estimates:<RecentEstimatesCardRows items={estimates?.recentEstimates??[]}/>}} visits={<TodayVisits loader={visitsLoader}/>}
    tasksCard={<DashboardTasksCard initialTasks={tasks?.personalTasks??null}
      pending={!tasks&&props.state!=='refresh-failed'} readOnly={readOnly}/>}/>;
}
