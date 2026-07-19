import type { DashboardData } from '@/lib/dashboard/types';
import PageHeader from '@/components/layout/PageHeader';
import stateStyles from '@/components/page-state/PageState.module.css';
import KpiStrip from './_components/KpiStrip';
import PipelineCountsCard from './_components/PipelineCountsCard';
import RecentActivityCard from './_components/RecentActivityCard';
import DashboardTasksCard from './_components/DashboardTasksCard.client';
import dash from './dashboard.module.css';

export default function DashboardView({
  data,
  state = 'fresh',
  onRetry,
}: {
  data: DashboardData;
  state?: 'cached' | 'fresh' | 'refresh-failed';
  onRetry?: () => void;
}) {
  return (
    <main
      className={dash.page}
      data-dashboard-state={state}
      data-dashboard-background-ready={state === 'fresh' ? 'true' : 'false'}
    >
      <PageHeader title="Dashboard" />

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

          <KpiStrip kpis={data.kpis} />

          <div className={dash.grid}>
            <RecentActivityCard items={data.recentActivity} />
            <DashboardTasksCard initialTasks={data.personalTasks} />
          </div>
        </div>
      </div>
    </main>
  );
}
