'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { DashboardData, QueueMode } from '@/lib/dashboard/types';
import { dashboardDataQueryOptions } from '@/lib/queries/dashboard';
import { qk } from '@/lib/queries/keys';

export default function DashboardClient({
  queueMode,
  initialData,
}: {
  queueMode: QueueMode;
  initialData: DashboardData;
}) {
  const queryClient = useQueryClient();
  const queryKey = qk.dashboard.data(queueMode);
  useQuery({
    ...dashboardDataQueryOptions(queueMode),
    initialData,
    refetchOnMount: false,
  });

  useEffect(() => {
    queryClient.setQueryData(queryKey, initialData);
    void queryClient.invalidateQueries({ queryKey, refetchType: 'active' });
  }, [initialData, queryClient, queryKey]);

  return null;
}
