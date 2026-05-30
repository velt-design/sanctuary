import type { DashboardData, QueueMode } from '@/lib/dashboard/types';
import { dashboardHref } from '@/lib/dashboard/links';
import PageHeader from '@/components/layout/PageHeader';
import KpiStrip from './_components/KpiStrip';
import AttentionCard from './_components/AttentionCard';
import WorkQueueCard from './_components/WorkQueueCard';
import InstallScheduleCard from './_components/InstallScheduleCard';
import SiteVisitsCard from './_components/SiteVisitsCard';
import PipelineCountsCard from './_components/PipelineCountsCard';
import dash from './dashboard.module.css';

export default function DashboardView({
  data,
  queueMode,
}: {
  data: DashboardData;
  queueMode: QueueMode;
}) {
  return (
    <main className={dash.page}>
      <PageHeader title="Dashboard" />

      <div className={dash.layout}>
        <PipelineCountsCard counts={data.pipelineCounts} />

        <KpiStrip kpis={data.kpis} />

        <div className={dash.grid}>
          <div className={`${dash.columnStack} ${dash.primaryStack}`}>
            <AttentionCard items={data.attention} />
            <WorkQueueCard
              mode={queueMode}
              items={data.workQueue}
              hrefToday={dashboardHref('today')}
              hrefNext7={dashboardHref('next7')}
              hrefAllDue={dashboardHref('alldue')}
            />
          </div>

          <div className={`${dash.columnStack} ${dash.sideStack}`}>
            <InstallScheduleCard schedule={data.schedule} />
            <SiteVisitsCard siteVisits={data.siteVisits} />
          </div>
        </div>
      </div>
    </main>
  );
}
