import { queryOptions } from '@tanstack/react-query';
import { qk } from './keys';
import { getProject, listProjects, listProjectsForContact } from '@/lib/repo/projectsRepo';
import { apiJson } from '@/lib/repo/apiClient';
import type { ProjectPageSnapshotResponse } from '@/lib/projects/types';

export type ProjectTooltipSummary = {
  clientName: string | null;
  roofStyleLabel: 'Pitched' | 'Gable' | 'Hip' | 'Box' | 'Multiple Modules' | null;
  materialLabel: 'Acrylic' | 'Timber' | 'Both' | null;
  totalCents: number | null;
  source: 'quote' | 'estimate' | 'none';
};

const ONE_DAY = 1000 * 60 * 60 * 24;
const THIRTY_MINUTES = 1000 * 60 * 30;
const TEN_MINUTES = 1000 * 60 * 10;
const FIVE_MINUTES = 1000 * 60 * 5;

async function fetchProjectPageSnapshot(projectId: string): Promise<ProjectPageSnapshotResponse> {
  return apiJson<ProjectPageSnapshotResponse>(`/api/projects/${encodeURIComponent(projectId)}/snapshot`);
}

export const projectsListQueryOptions = (host: string, options?: { includeArchived?: boolean }) => {
  const scope = options?.includeArchived ? 'all' : 'active';
  return queryOptions({
    queryKey: qk.projects.list(host, scope),
    queryFn: () => listProjects({ includeArchived: scope === 'all' }),
    staleTime: THIRTY_MINUTES,
    gcTime: ONE_DAY,
  });
};

export const projectDetailQueryOptions = (host: string, projectId: string) =>
  queryOptions({
    queryKey: qk.projects.detail(host, projectId),
    queryFn: () => getProject(projectId),
    staleTime: TEN_MINUTES,
    gcTime: ONE_DAY,
  });

export const projectPageSnapshotQueryOptions = (host: string, projectId: string) =>
  queryOptions({
    queryKey: qk.projects.snapshot(host, projectId),
    queryFn: () => fetchProjectPageSnapshot(projectId),
    staleTime: FIVE_MINUTES,
    gcTime: ONE_DAY,
  });

export const projectTooltipSummaryQueryOptions = (host: string, projectId: string) =>
  queryOptions({
    queryKey: qk.projects.tooltipSummary(host, projectId),
    queryFn: () =>
      apiJson<ProjectTooltipSummary>(`/api/staff/v1/projects/${encodeURIComponent(projectId)}/tooltip-summary`),
    staleTime: TEN_MINUTES,
    gcTime: ONE_DAY,
  });

export const projectsByContactQueryOptions = (host: string, contactId: string) =>
  queryOptions({
    queryKey: qk.projects.byContact(host, contactId),
    queryFn: () => listProjectsForContact(contactId),
    staleTime: TEN_MINUTES,
    gcTime: ONE_DAY,
  });
