import { queryOptions } from '@tanstack/react-query';
import { apiJson } from '@/lib/repo/apiClient';
import { qk } from './keys';
import type {
  ProjectsIndexArchiveFilter,
  ProjectsIndexParams,
  ProjectsIndexResponse,
} from '@/lib/projects/projectsIndexContract';
export type {
  ProjectsIndexArchiveFilter,
  ProjectsIndexResponse,
} from '@/lib/projects/projectsIndexContract';

const ONE_DAY = 1000 * 60 * 60 * 24;
const FIVE_MINUTES = 1000 * 60 * 5;
export const PROJECTS_INDEX_QUERY_SCOPE = 'staff-api';

export function defaultProjectsIndexParams(archive: ProjectsIndexArchiveFilter): ProjectsIndexParams {
  return {
    archive,
    search: '',
    status: 'all',
    page: 1,
    pageSize: 50,
    sort: 'newest',
  };
}

function stableParams(params: ProjectsIndexParams) {
  return {
    search: params.search.trim(),
    status: params.status,
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort,
  };
}

export function projectsIndexQueryOptions(
  archive: ProjectsIndexArchiveFilter,
  params: ProjectsIndexParams = defaultProjectsIndexParams(archive),
) {
  const stable = stableParams({ ...params, archive });
  const searchParams = new URLSearchParams({
    archive,
    q: stable.search,
    status: stable.status,
    page: String(stable.page),
    pageSize: String(stable.pageSize),
    sort: stable.sort,
  });
  return queryOptions({
    queryKey: qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, archive, stable),
    queryFn: () =>
      apiJson<ProjectsIndexResponse>(
        `/api/staff/v1/projects/index?${searchParams.toString()}`,
        { cache: 'no-store' },
      ),
    staleTime: FIVE_MINUTES,
    gcTime: ONE_DAY,
  });
}
