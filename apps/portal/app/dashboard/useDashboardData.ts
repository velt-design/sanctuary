'use client';

import { useSyncExternalStore } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import type { DashboardData, QueueMode } from '@/lib/dashboard/types';
import { dashboardDataQueryOptions } from '@/lib/queries/dashboard';
import { dashboardReadObservation } from './dashboardReadObservation';
import { readDashboardParts, DashboardIncompleteReadError, type DashboardPartLoader } from '@/lib/dashboard/dashboardPartTransport';
import { ApiError } from '@/lib/repo/apiClient';

type DashboardReadState =
  | 'pending'
  | 'cached'
  | 'fresh'
  | 'refresh-failed'
  | 'unavailable';

function isAccessEndingError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export function useDashboardData(queueMode: QueueMode, loader?:()=>Promise<DashboardData>, partsLoader:DashboardPartLoader=readDashboardParts) {
  const client=useQueryClient();
  const options=dashboardDataQueryOptions(queueMode);
  const owner=client.getQueryCache().build<DashboardData>(client,{queryKey:options.queryKey,gcTime:options.gcTime});
  const observation=dashboardReadObservation(owner);
  const parts=useSyncExternalStore(observation.subscribe,observation.snapshot,observation.snapshot);
  const query = useQuery({
    ...dashboardDataQueryOptions(queueMode),
    queryFn: loader ?? (({signal})=>observation.read(partsLoader,queueMode,signal,owner.state.data===undefined)),
    refetchOnMount: 'always',
    retry: (failureCount, error) => !isAccessEndingError(error) && !(error instanceof DashboardIncompleteReadError) && failureCount < 2,
  });
  const unavailable = isAccessEndingError(query.error);
  const knownData = unavailable ? undefined : query.data;

  let state: DashboardReadState;
  if (unavailable) state = 'unavailable';
  else if (query.isFetching) state = knownData || Object.keys(parts).length ? 'cached' : 'pending';
  else if (query.error) state = 'refresh-failed';
  else if (!knownData) state = 'pending';
  else state = 'fresh';

  return {
    state,
    data: knownData,
    parts: unavailable || (!query.isFetching && !(query.error instanceof DashboardIncompleteReadError)) ? {} : parts,
    error: query.error,
    retry: query.refetch,
    backgroundReady: state === 'fresh',
  };
}
