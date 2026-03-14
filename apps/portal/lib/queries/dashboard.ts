import { queryOptions } from '@tanstack/react-query';
import type { DashboardData, QueueMode } from '@/lib/dashboard/types';
import { apiJson } from '@/lib/repo/apiClient';
import { qk } from './keys';

const ONE_MINUTE = 1000 * 60;
const ONE_DAY = 1000 * 60 * 60 * 24;

export const dashboardDataQueryOptions = (queueMode: QueueMode) =>
  queryOptions({
    queryKey: qk.dashboard.data(queueMode),
    queryFn: () => apiJson<DashboardData>(`/api/dashboard?queue=${encodeURIComponent(queueMode)}`),
    staleTime: ONE_MINUTE,
    gcTime: ONE_DAY,
  });
