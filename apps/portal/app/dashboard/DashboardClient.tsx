'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { QueueMode } from '@/lib/dashboard/types';
import { dashboardHref } from '@/lib/dashboard/links';
import { dashboardDataQueryOptions } from '@/lib/queries/dashboard';
import PageHeader from '@/components/layout/PageHeader';
import KpiStrip from './_components/KpiStrip';
import AttentionCard from './_components/AttentionCard';
import WorkQueueCard from './_components/WorkQueueCard';
import InstallScheduleCard from './_components/InstallScheduleCard';
import SiteVisitsCard from './_components/SiteVisitsCard';
import PipelineCountsCard from './_components/PipelineCountsCard';
import dash from './dashboard.module.css';
import DashboardLoading from './loading';
import PageMessagePanel from '@/components/page-state/PageMessagePanel';
import stateStyles from '@/components/page-state/PageState.module.css';

function parseQueueMode(value: string | null): QueueMode {
  if (value === 'next7' || value === 'alldue') return value;
  return 'today';
}

export default function DashboardClient() {
  const searchParams = useSearchParams();
  const queue = useMemo(() => parseQueueMode(searchParams.get('queue')), [searchParams]);
  const { data, error, isLoading } = useQuery(dashboardDataQueryOptions(queue));

  if (isLoading && !data) {
    return <DashboardLoading />;
  }

  if (error && !data) {
    const msg = error instanceof Error ? error.message : 'Failed to load dashboard.';
    return (
      <PageMessagePanel
        title="Dashboard unavailable"
        description={msg}
        actions={
          <button
            type="button"
            className={stateStyles.primaryAction}
            onClick={() => {
              window.location.reload();
            }}
          >
            Try again
          </button>
        }
      />
    );
  }

  if (!data) return <DashboardLoading />;

  return (
    <main className={dash.page}>
      <PageHeader title="Dashboard" />

      <div className={dash.layout}>
        <KpiStrip kpis={data.kpis} />

        <div className={dash.grid}>
          <div className={dash.columnStack}>
            <AttentionCard items={data.attention} />
            <WorkQueueCard
              mode={queue}
              items={data.workQueue}
              hrefToday={dashboardHref('today')}
              hrefNext7={dashboardHref('next7')}
              hrefAllDue={dashboardHref('alldue')}
            />
          </div>

          <div className={dash.columnStack}>
            <InstallScheduleCard schedule={data.schedule} />
            <SiteVisitsCard siteVisits={data.siteVisits} />
          </div>
        </div>

        <PipelineCountsCard counts={data.pipelineCounts} />
      </div>
    </main>
  );
}
