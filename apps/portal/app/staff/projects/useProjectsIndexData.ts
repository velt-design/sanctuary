'use client';

import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/repo/apiClient';
import {
  projectsIndexPlaceholderFromCaches,
  projectsIndexQueryOptions,
  seedProjectsIndexCanonicalCaches,
  type ProjectsIndexArchiveFilter,
  type ProjectsIndexResponse,
} from '@/lib/queries/projectsIndex';

type ProjectsIndexReadState =
  | 'pending'
  | 'cached'
  | 'fresh'
  | 'refresh-failed'
  | 'unavailable';

function isAccessEndingError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export function useProjectsIndexData(host: string, archive: ProjectsIndexArchiveFilter) {
  const queryClient = useQueryClient();
  const placeholder = useMemo(
    () => projectsIndexPlaceholderFromCaches(queryClient, host, archive),
    [archive, host, queryClient],
  );
  const query = useQuery({
    ...projectsIndexQueryOptions(archive),
    placeholderData: placeholder,
    refetchOnMount: 'always',
    retry: (failureCount, error) => !isAccessEndingError(error) && failureCount < 2,
  });

  const unavailable = isAccessEndingError(query.error);
  const knownData: ProjectsIndexResponse | undefined = unavailable
    ? undefined
    : query.data ?? placeholder;

  let state: ProjectsIndexReadState;
  if (unavailable) state = 'unavailable';
  else if (query.error) state = 'refresh-failed';
  else if (!knownData) state = 'pending';
  else if (query.isFetching || query.isPlaceholderData) state = 'cached';
  else state = 'fresh';

  useEffect(() => {
    if (!query.data || query.isPlaceholderData || unavailable) return;
    seedProjectsIndexCanonicalCaches(queryClient, host, query.data);
  }, [host, query.data, query.isPlaceholderData, queryClient, unavailable]);

  return {
    state,
    data: knownData,
    error: query.error,
    retry: query.refetch,
    backgroundReady: state === 'fresh',
  };
}
