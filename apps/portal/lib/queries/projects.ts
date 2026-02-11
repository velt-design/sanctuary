import { queryOptions } from '@tanstack/react-query';
import { qk } from './keys';
import { getProject, listProjects, listProjectsForContact } from '@/lib/repo/projectsRepo';

export const projectsListQueryOptions = (host: string) =>
  queryOptions({
    queryKey: qk.projects.list(host),
    queryFn: listProjects,
  });

export const projectDetailQueryOptions = (host: string, projectId: string) =>
  queryOptions({
    queryKey: qk.projects.detail(host, projectId),
    queryFn: () => getProject(projectId),
  });

export const projectsByContactQueryOptions = (host: string, contactId: string) =>
  queryOptions({
    queryKey: qk.projects.byContact(host, contactId),
    queryFn: () => listProjectsForContact(contactId),
  });
