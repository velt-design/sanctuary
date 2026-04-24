'use client';

import { useQuery } from '@tanstack/react-query';
import type { DashboardData, QueueMode } from '@/lib/dashboard/types';
import { dashboardDataQueryOptions } from '@/lib/queries/dashboard';

export default function DashboardClient({
  queueMode,
  initialData,
}: {
  queueMode: QueueMode;
  initialData: DashboardData;
}) {
  useQuery({
    ...dashboardDataQueryOptions(queueMode),
    initialData,
    refetchOnMount: 'always',
  });

  return null;
}
