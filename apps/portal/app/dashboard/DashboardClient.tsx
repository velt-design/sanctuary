'use client';

import PageMessagePanel from '@/components/page-state/PageMessagePanel';
import type { QueueMode } from '@/lib/dashboard/types';
import DashboardView from './DashboardView';
import { useDashboardData } from './useDashboardData';

export default function DashboardClient({
  queueMode,
}: {
  queueMode: QueueMode;
}) {
  const dashboard = useDashboardData(queueMode);

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
      data={dashboard.data}
      state={dashboard.state}
      onRetry={() => void dashboard.retry()}
    />
  );
}
