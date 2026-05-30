import type { DashboardData } from '@/lib/dashboard/types';
import PageHeader from '@/components/layout/PageHeader';
import KpiStrip from './_components/KpiStrip';
import PipelineCountsCard from './_components/PipelineCountsCard';
import RecentActivityCard from './_components/RecentActivityCard';
import DashboardTasksCard from './_components/DashboardTasksCard.client';
import dash from './dashboard.module.css';

export default function DashboardView({
  data,
}: {
  data: DashboardData;
}) {
  return (
    <main className={dash.page}>
      <PageHeader title="Dashboard" />

      <div className={dash.layout}>
        <PipelineCountsCard counts={data.pipelineCounts} />

        <KpiStrip kpis={data.kpis} />

        <div className={dash.grid}>
          <RecentActivityCard items={data.recentActivity} />
          <DashboardTasksCard initialTasks={data.personalTasks} />
        </div>
      </div>
    </main>
  );
}
