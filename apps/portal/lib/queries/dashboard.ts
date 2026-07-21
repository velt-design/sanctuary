import { queryOptions } from '@tanstack/react-query';
import type { DashboardData, QueueMode } from '@/lib/dashboard/types';
import { apiJson } from '@/lib/repo/apiClient';
import { qk } from './keys';
import type { ProjectCommandExceptionsResponse } from '@/lib/projects/commandCentre/types';

const ONE_MINUTE = 1000 * 60;
const ONE_DAY = 1000 * 60 * 60 * 24;

export const dashboardDataQueryOptions = (queueMode: QueueMode) =>
  queryOptions({
    queryKey: qk.dashboard.data(queueMode),
    queryFn: () => apiJson<DashboardData>(`/api/dashboard?queue=${encodeURIComponent(queueMode)}`),
    staleTime: ONE_MINUTE,
    gcTime: ONE_DAY,
  });

export const dashboardProjectExceptionsQueryOptions = () => queryOptions({
  queryKey: qk.dashboard.projectExceptions(),
  queryFn: () => apiJson<ProjectCommandExceptionsResponse>('/api/staff/v1/dashboard/project-exceptions'),
  staleTime: ONE_MINUTE,
  gcTime: ONE_DAY,
});
