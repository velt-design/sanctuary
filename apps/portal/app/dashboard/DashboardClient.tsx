'use client';

import type { DashboardPartLoader } from '@/lib/dashboard/dashboardPartTransport';
import PageMessagePanel from '@/components/page-state/PageMessagePanel';
import type { DashboardData, QueueMode } from '@/lib/dashboard/types';
import type { VisitSnapshot } from '@/lib/siteVisits/contract';
import DashboardView from './DashboardView';
import { useDashboardData } from './useDashboardData';

export default function DashboardClient({
  queueMode, loader, partsLoader, visitsLoader, readOnly=false,
}: {
  queueMode: QueueMode;partsLoader?:DashboardPartLoader;loader?:()=>Promise<DashboardData>;visitsLoader?:()=>Promise<VisitSnapshot>;readOnly?:boolean;
}) {
  const dashboard = useDashboardData(queueMode,loader,partsLoader);

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
      data={dashboard.data??null} parts={dashboard.parts}
      state={dashboard.state} visitsLoader={visitsLoader} readOnly={readOnly}
      onRetry={() => void dashboard.retry()}
    />
  );
}
