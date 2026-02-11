import { queryOptions } from '@tanstack/react-query';
import type { DashboardData, QueueMode } from '@/lib/dashboard/types';
import { apiJson } from '@/lib/repo/apiClient';
import { qk } from './keys';

export const dashboardDataQueryOptions = (queueMode: QueueMode) =>
  queryOptions({
    queryKey: qk.dashboard.data(queueMode),
    queryFn: () => apiJson<DashboardData>(`/api/dashboard?queue=${encodeURIComponent(queueMode)}`),
  });
