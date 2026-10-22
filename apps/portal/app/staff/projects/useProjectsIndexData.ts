'use client';

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/repo/apiClient';
import { projectsIndexQueryOptions } from '@/lib/queries/projectsIndex';
import type {
  ProjectsIndexParams,
  ProjectsIndexResponse,
} from '@/lib/projects/projectsIndexContract';
import { projectsIndexReadFunction, type ProjectsIndexInitialRead } from './projectsIndexInitialRead';

type ProjectsIndexReadState = 'pending' | 'cached' | 'fresh' | 'refresh-failed' | 'unavailable';

function isAccessEndingError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export function projectsIndexResponseMatchesRequest(
  response: ProjectsIndexResponse,
  params: ProjectsIndexParams,
): boolean {
  return response.archive === params.archive
    && response.query.search === params.search.trim()
    && response.query.status === params.status
    && response.query.journey === params.journey
    && response.query.state === params.state
    && response.query.owner === params.owner
    && response.query.sort === params.sort
    && response.projects.page === params.page
    && response.projects.pageSize === params.pageSize;
}

export function useProjectsIndexData(params: ProjectsIndexParams, initial?: {
  ownerId: string | null;
  initialRead?: ProjectsIndexInitialRead;
  loader?:(params:ProjectsIndexParams)=>Promise<ProjectsIndexResponse>;
}) {
  const client = useQueryClient();
  const query = useQuery({
    ...projectsIndexQueryOptions(params.archive, params),
    queryFn: initial?.loader?()=>initial.loader!(params):projectsIndexReadFunction(client, params, initial?.ownerId ?? null, initial?.initialRead),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
    retry: (failureCount, error) => !isAccessEndingError(error) && failureCount < 2,
  });

  const unavailable = isAccessEndingError(query.error);
  const responseMatchesRequest = Boolean(
    query.data && projectsIndexResponseMatchesRequest(query.data, params),
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
