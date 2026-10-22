import type { VisitSnapshot } from '@/lib/siteVisits/contract';
import type { DashboardParts } from '@/lib/dashboard/dashboardParts';
import type { DashboardData } from '@/lib/dashboard/types';
import stateStyles from '@/components/page-state/PageState.module.css';
import PipelineCountsCard from './_components/PipelineCountsCard';
import RecentActivityCard from './_components/RecentActivityCard';
import DashboardTasksCard from './_components/DashboardTasksCard.client';
import dash from './dashboard.module.css';
import DashboardHero from './_components/DashboardHero';
import RecentEstimatesCard from './_components/RecentEstimatesCard';
import ProjectWorkQueueCard from './_components/ProjectWorkQueueCard';
import TodayVisits from '@/components/site-visits/TodayVisits';

export default function DashboardView({
  data, parts={},
  state = 'fresh',
  onRetry,visitsLoader,readOnly=false,
}: {
  data: DashboardData|null;parts?:Partial<DashboardParts>;visitsLoader?:()=>Promise<VisitSnapshot>;readOnly?:boolean;
  state?: 'pending' | 'cached' | 'fresh' | 'refresh-failed';
  onRetry?: () => void;
}) {
  const pipeline=parts.pipelineCounts??data;
  const states=parts.projectStateCounts??data;
  const work=parts.projectWorkQueue??data;
  const activity=parts.recentActivity??data;
  const estimates=parts.recentEstimates??data;
  const tasks=parts.personalTasks??data;
  const pending=(known:unknown)=>!known&&state!=='refresh-failed';
  return (
    <main
      className={dash.page}
      data-ui-foundation-consumer="dashboard"
      data-dashboard-state={state}
      data-dashboard-background-ready={state === 'fresh' ? 'true' : 'false'}
    >
      <DashboardHero updatedAtIso={parts.snapshot?.updatedAtIso??data?.updatedAtIso??new Date().toISOString()} />

      <div className={dash.content}>
        {state === 'cached' ? (
          <div className={dash.refreshStatus} role="status">Updating...</div>
        ) : null}
        {state === 'refresh-failed' ? (
          <div className={`${stateStyles.inlineNotice} ${dash.refreshNotice}`} role="status">
            <span>{Object.keys(parts).length?'Some Dashboard sections could not load. Complete sections remain available.':data?'Could not refresh the dashboard. Showing the last saved information.':'Could not load the dashboard. Retry to read the current information.'}</span>
            {onRetry ? (
              <button type="button" className={stateStyles.secondaryAction} onClick={onRetry}>Retry</button>
            ) : null}
          </div>
        ) : null}

        <div className={dash.layout}>
          <PipelineCountsCard
            counts={pipeline?.pipelineCounts??{}} pending={pending(pipeline)} statePending={pending(states)}
            countsAvailable={(state !== 'refresh-failed' || Boolean(parts.pipelineCounts)) && pipeline?.pipelineCountsScope === 'open_enquiry_proposal_v1' && pipeline?.pipelineCountsAvailable === true}
            stateCounts={states?.projectStateCounts}
            stateCountsAvailable={Boolean(states)&&states?.projectStateCountsAvailable !== false}
          />

          <div className={dash.workspaceGrid}>
            <TodayVisits loader={visitsLoader}/>
            <ProjectWorkQueueCard
              items={work?.projectWorkQueue??[]} pending={pending(work)}
              available={Boolean(work)&&work?.projectWorkQueueAvailable !== false}
            />
            <RecentActivityCard items={activity?.recentActivity??null} pending={pending(activity)} />
            <RecentEstimatesCard items={estimates?.recentEstimates??null} pending={pending(estimates)} />
            <DashboardTasksCard initialTasks={tasks?.personalTasks??null} pending={pending(tasks)} readOnly={readOnly} />
          </div>
        </div>
      </div>
    </main>
  );
}
