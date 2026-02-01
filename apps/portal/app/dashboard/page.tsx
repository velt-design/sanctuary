import type { QueueMode } from '@/lib/dashboard/types';
import { getDashboardData } from '@/lib/dashboard/getDashboardData';
import { dashboardHref } from '@/lib/dashboard/links';
import PageHeader from '@/components/layout/PageHeader';
import KpiStrip from './_components/KpiStrip';
import AttentionCard from './_components/AttentionCard';
import WorkQueueCard from './_components/WorkQueueCard';
import InstallScheduleCard from './_components/InstallScheduleCard';
import SiteVisitsCard from './_components/SiteVisitsCard';
import PipelineCountsCard from './_components/PipelineCountsCard';
import dash from './dashboard.module.css';

export const dynamic = 'force-dynamic';

function parseQueueMode(value: unknown): QueueMode {
  if (value === 'next7' || value === 'alldue') return value;
  return 'today';
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const queue = parseQueueMode(searchParams?.queue);
  const data = await getDashboardData({ queueMode: queue });

  return (
    <main className={dash.page}>
      <PageHeader title="Dashboard" />

      <div className={dash.stack}>
        <KpiStrip kpis={data.kpis} />

        <div className={dash.grid}>
          <div className={dash.stack}>
            <AttentionCard items={data.attention} />
            <WorkQueueCard
              mode={queue}
              items={data.workQueue}
              hrefToday={dashboardHref('today')}
              hrefNext7={dashboardHref('next7')}
              hrefAllDue={dashboardHref('alldue')}
            />
          </div>

          <div className={dash.stack}>
            <InstallScheduleCard schedule={data.schedule} />
            <SiteVisitsCard siteVisits={data.siteVisits} />
          </div>
        </div>

        <PipelineCountsCard counts={data.pipelineCounts} />
      </div>
    </main>
  );
}
