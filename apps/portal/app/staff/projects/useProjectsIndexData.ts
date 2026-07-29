'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ApiError } from '@/lib/repo/apiClient';
import { projectsIndexQueryOptions } from '@/lib/queries/projectsIndex';
import type { ProjectsIndexParams } from '@/lib/projects/projectsIndexContract';

type ProjectsIndexReadState = 'pending' | 'cached' | 'fresh' | 'refresh-failed' | 'unavailable';

function isAccessEndingError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export function useProjectsIndexData(params: ProjectsIndexParams) {
  const query = useQuery({
    ...projectsIndexQueryOptions(params.archive, params),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
    retry: (failureCount, error) => !isAccessEndingError(error) && failureCount < 2,
  });

  const unavailable = isAccessEndingError(query.error);
  const responseMatchesRequest = Boolean(
    query.data
      && query.data.archive === params.archive
      && query.data.query.search === params.search.trim()
      && query.data.query.status === params.status
      && query.data.query.due === params.due
      && query.data.query.today === params.today
      && query.data.query.sort === params.sort
      && query.data.projects.page === params.page
      && query.data.projects.pageSize === params.pageSize,
  );
  const knownData = unavailable || !responseMatchesRequest ? undefined : query.data;

  let state: ProjectsIndexReadState;
  if (unavailable) state = 'unavailable';
  else if (query.error) state = 'refresh-failed';
  else if (!knownData) state = 'pending';
  else if (query.isFetching || query.isPlaceholderData) state = 'cached';
  else state = 'fresh';

  return {
    state,
    data: knownData,
    error: query.error,
    retry: query.refetch,
    backgroundReady: state === 'fresh',
  };
}
