'use client';

import { useQuery } from '@tanstack/react-query';
import type { QueueMode } from '@/lib/dashboard/types';
import { dashboardDataQueryOptions } from '@/lib/queries/dashboard';
import { ApiError } from '@/lib/repo/apiClient';

export type DashboardReadState =
  | 'pending'
  | 'cached'
  | 'fresh'
  | 'refresh-failed'
  | 'unavailable';

function isAccessEndingError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export function useDashboardData(queueMode: QueueMode) {
  const query = useQuery({
    ...dashboardDataQueryOptions(queueMode),
    refetchOnMount: 'always',
    retry: (failureCount, error) => !isAccessEndingError(error) && failureCount < 2,
  });
  const unavailable = isAccessEndingError(query.error);
  const knownData = unavailable ? undefined : query.data;

  let state: DashboardReadState;
  if (unavailable) state = 'unavailable';
  else if (query.error) state = 'refresh-failed';
  else if (!knownData) state = 'pending';
  else if (query.isFetching) state = 'cached';
  else state = 'fresh';

  return {
    state,
    data: knownData,
    error: query.error,
    retry: query.refetch,
    backgroundReady: state === 'fresh',
  };
}
