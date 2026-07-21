import type { DashboardData, QueueMode } from '@/lib/dashboard/types';
import stateStyles from '@/components/page-state/PageState.module.css';
import PipelineCountsCard from './_components/PipelineCountsCard';
import RecentActivityCard from './_components/RecentActivityCard';
import DashboardTasksCard from './_components/DashboardTasksCard.client';
import dash from './dashboard.module.css';
import DashboardHero from './_components/DashboardHero';
import AttentionTodayCard from './_components/AttentionTodayCard';
import NewLeadsCard from './_components/NewLeadsCard';
import RecentEstimatesCard from './_components/RecentEstimatesCard';
import ProjectActionQueueCard from './_components/ProjectActionQueueCard';

export default function DashboardView({
  data,
  queueMode,
  state = 'fresh',
  onRetry,
}: {
  data: DashboardData;
  queueMode: QueueMode;
  state?: 'cached' | 'fresh' | 'refresh-failed';
  onRetry?: () => void;
}) {
  return (
    <main
      className={dash.page}
      data-ui-foundation-consumer="dashboard"
      data-dashboard-state={state}
      data-dashboard-background-ready={state === 'fresh' ? 'true' : 'false'}
    >
      <DashboardHero updatedAtIso={data.updatedAtIso} />

      <div className={dash.content}>
        {state === 'cached' ? (
          <div className={dash.refreshStatus} role="status">Updating...</div>
        ) : null}
        {state === 'refresh-failed' ? (
          <div className={`${stateStyles.inlineNotice} ${dash.refreshNotice}`} role="status">
            <span>Could not refresh the dashboard. Showing the last saved information.</span>
            {onRetry ? (
              <button type="button" className={stateStyles.secondaryAction} onClick={onRetry}>Retry</button>
            ) : null}
          </div>
        ) : null}

        <div className={dash.layout}>
          <PipelineCountsCard counts={data.pipelineCounts} />

          <div className={dash.overviewGrid}>
            <AttentionTodayCard items={data.attention} />
            <NewLeadsCard items={data.newLeads} totalCount={data.pipelineCounts.NEW ?? data.kpis.newLeads} />
            <RecentEstimatesCard items={data.recentEstimates} />
          </div>

          <div className={dash.operationsGrid}>
            <ProjectActionQueueCard items={data.workQueue} queueMode={queueMode} updatedAtIso={data.updatedAtIso} />
            <DashboardTasksCard initialTasks={data.personalTasks} />
          </div>

          <RecentActivityCard items={data.recentActivity} />
        </div>
      </div>
    </main>
  );
}
