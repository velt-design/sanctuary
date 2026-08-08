import { queryOptions } from '@tanstack/react-query';
import type { DashboardData, QueueMode } from '@/lib/dashboard/types';
import { apiJson } from '@/lib/repo/apiClient';
import { qk } from './keys';
import type { ProjectWorkQueueResponse } from './projectWorkQueue';

const ONE_MINUTE = 1000 * 60;
const ONE_DAY = 1000 * 60 * 60 * 24;

export const dashboardDataQueryOptions = (queueMode: QueueMode) =>
  queryOptions({
    queryKey: qk.dashboard.data(queueMode),
    queryFn: () => apiJson<DashboardData>(`/api/dashboard?queue=${encodeURIComponent(queueMode)}`),
    staleTime: ONE_MINUTE,
    gcTime: ONE_DAY,
  });

export const dashboardWorkQueueQueryOptions = () =>
  queryOptions({
    queryKey: qk.dashboard.workQueue(),
    queryFn: () => apiJson<ProjectWorkQueueResponse>('/api/staff/v1/work-items/queue?limit=5'),
    staleTime: ONE_MINUTE,
    gcTime: ONE_DAY,
  });
