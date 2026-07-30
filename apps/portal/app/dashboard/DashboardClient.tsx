'use client';

import PageMessagePanel from '@/components/page-state/PageMessagePanel';
import type { QueueMode } from '@/lib/dashboard/types';
import DashboardPendingView from './DashboardPendingView';
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

  if (!dashboard.data) {
    return (
      <DashboardPendingView
        failed={dashboard.state === 'refresh-failed'}
        onRetry={dashboard.state === 'refresh-failed' ? () => void dashboard.retry() : undefined}
      />
    );
  }

  // A pending read cannot have data; this fallback only protects the view from
  // an inconsistent mocked or future query result.
  const visibleState = dashboard.state === 'pending' ? 'cached' : dashboard.state;

  return (
    <DashboardView
      data={dashboard.data}
      state={visibleState}
      onRetry={() => void dashboard.retry()}
    />
  );
}
