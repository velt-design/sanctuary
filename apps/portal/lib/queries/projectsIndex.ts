import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { Contact } from '@/lib/types/contact';
import type { Project } from '@/lib/types/project';
import { apiJson } from '@/lib/repo/apiClient';
import { qk } from './keys';
import type { ProjectsIndexArchiveFilter, ProjectsIndexResponse } from '@/lib/projects/projectsIndexContract';
export type { ProjectsIndexArchiveFilter, ProjectsIndexResponse } from '@/lib/projects/projectsIndexContract';

const ONE_DAY = 1000 * 60 * 60 * 24;
const FIVE_MINUTES = 1000 * 60 * 5;
export const PROJECTS_INDEX_QUERY_SCOPE = 'staff-api';

export function projectsIndexQueryOptions(archive: ProjectsIndexArchiveFilter) {
  return queryOptions({
    queryKey: qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, archive),
    queryFn: () =>
      apiJson<ProjectsIndexResponse>(
        `/api/staff/v1/projects/index?archive=${encodeURIComponent(archive)}`,
        { cache: 'no-store' },
      ),
    staleTime: FIVE_MINUTES,
    gcTime: ONE_DAY,
  });
}

function cachedProjectRows(
  queryClient: QueryClient,
  host: string,
  archive: ProjectsIndexArchiveFilter,
): Project[] | undefined {
  const active = queryClient.getQueryData<Project[]>(qk.projects.list(host, 'active'));
  const all = queryClient.getQueryData<Project[]>(qk.projects.list(host, 'all'));

  if (archive === 'all') return all;
  if (archive === 'archived') return all?.filter((project) => Boolean(project.isArchived));
  return active ?? all?.filter((project) => !project.isArchived);
}

export function projectsIndexPlaceholderFromCaches(
  queryClient: QueryClient,
  host: string,
  archive: ProjectsIndexArchiveFilter,
): ProjectsIndexResponse | undefined {
  const indexData = queryClient.getQueryData<ProjectsIndexResponse>(
    qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, archive),
  );
  if (indexData) return indexData;

  const projects = cachedProjectRows(queryClient, host, archive);
  const contacts = queryClient.getQueryData<Contact[]>(qk.contacts.list(host));
  if (!projects && !contacts) return undefined;

  return {
    archive,
    projects: {
      rows: projects ?? [],
      totalCount: null,
      truncated: false,
    },
    contacts: {
      rows: contacts ?? [],
      totalCount: null,
      truncated: false,
    },
    generatedAt: 'cached',
  };
}

export function seedProjectsIndexCanonicalCaches(
  queryClient: QueryClient,
  host: string,
  response: ProjectsIndexResponse,
) {
  queryClient.setQueryData<Contact[]>(qk.contacts.list(host), response.contacts.rows);

  if (response.archive === 'active') {
    queryClient.setQueryData<Project[]>(qk.projects.list(host, 'active'), response.projects.rows);
    return;
  }

  if (response.archive === 'all') {
    queryClient.setQueryData<Project[]>(qk.projects.list(host, 'all'), response.projects.rows);
    queryClient.setQueryData<Project[]>(
      qk.projects.list(host, 'active'),
      response.projects.rows.filter((project) => !project.isArchived),
    );
  }
}
