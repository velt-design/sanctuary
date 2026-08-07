import type { DashboardData } from '@/lib/dashboard/types';
import stateStyles from '@/components/page-state/PageState.module.css';
import PipelineCountsCard from './_components/PipelineCountsCard';
import RecentActivityCard from './_components/RecentActivityCard';
import DashboardTasksCard from './_components/DashboardTasksCard.client';
import dash from './dashboard.module.css';
import DashboardHero from './_components/DashboardHero';
import RecentEstimatesCard from './_components/RecentEstimatesCard';
import ProjectWorkQueueCard from './_components/ProjectWorkQueueCard';

export default function DashboardView({
  data,
  state = 'fresh',
  onRetry,
}: {
  data?: DashboardData;
  state?: 'pending' | 'cached' | 'fresh' | 'refresh-failed';
  onRetry?: () => void;
}) {
  const loading = !data;

  return (
    <main
      className={dash.page}
      data-portal-page-shell="dashboard"
      data-portal-page-shell-ready="true"
      data-ui-foundation-consumer="dashboard"
      data-dashboard-state={state}
      data-dashboard-background-ready={state === 'fresh' ? 'true' : 'false'}
    >
      <DashboardHero updatedAtIso={data?.updatedAtIso} />

      <div className={dash.content}>
        {state === 'pending' || state === 'cached' ? (
          <div className={dash.refreshStatus} role="status">
            {loading ? 'Updating dashboard values...' : 'Updating...'}
          </div>
        ) : null}
        {state === 'refresh-failed' ? (
          <div className={`${stateStyles.inlineNotice} ${dash.refreshNotice}`} role="status">
            <span>
              {data
                ? 'Could not refresh the dashboard. Showing the last saved information.'
                : 'Could not load the dashboard. Connect and retry; the workspace remains available.'}
            </span>
            {onRetry ? (
              <button type="button" className={stateStyles.secondaryAction} onClick={onRetry}>Retry</button>
            ) : null}
          </div>
        ) : null}

        <div className={dash.layout}>
          <PipelineCountsCard
            counts={data?.pipelineCounts}
            stateCounts={data?.projectStateCounts}
            stateCountsAvailable={data ? data.projectStateCountsAvailable !== false : undefined}
            loading={loading}
          />

          <div className={dash.workspaceGrid}>
            <ProjectWorkQueueCard
              items={data ? data.projectWorkQueue ?? [] : undefined}
              available={data ? data.projectWorkQueueAvailable !== false : undefined}
              loading={loading}
            />
            <RecentActivityCard items={data?.recentActivity} loading={loading} />
            <RecentEstimatesCard items={data?.recentEstimates} loading={loading} />
            <DashboardTasksCard initialTasks={data?.personalTasks} loading={loading} />
          </div>
        </div>
      </div>
    </main>
  );
}
