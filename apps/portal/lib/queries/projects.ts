import { queryOptions } from '@tanstack/react-query';
import { qk } from './keys';
import { listProjects, listProjectsForContact } from '@/lib/repo/projectsRepo';
import { apiJson } from '@/lib/repo/apiClient';
import type { ProjectPageSnapshotResponse } from '@/lib/projects/types';
import type { ProjectCommandCentreResponse } from '@/lib/projects/commandCentre/types';

type ProjectTooltipSummary = {
  clientName: string | null;
  roofStyleLabel: 'Pitched' | 'Gable' | 'Hip' | 'Box' | 'Multiple Modules' | null;
  materialLabel: 'Acrylic' | 'Timber' | 'Both' | null;
  totalCents: number | null;
  source: 'quote' | 'none';
};

const ONE_DAY = 1000 * 60 * 60 * 24;
const THIRTY_MINUTES = 1000 * 60 * 30;
const TEN_MINUTES = 1000 * 60 * 10;
const FIVE_MINUTES = 1000 * 60 * 5;
const TEN_SECONDS = 1000 * 10;

async function fetchProjectPageSnapshot(projectId: string): Promise<ProjectPageSnapshotResponse> {
  return apiJson<ProjectPageSnapshotResponse>(`/api/projects/${encodeURIComponent(projectId)}/snapshot`);
}

async function fetchProjectPageSummary(projectId: string): Promise<ProjectPageSnapshotResponse> {
  return apiJson<ProjectPageSnapshotResponse>(
    `/api/staff/v1/projects/${encodeURIComponent(projectId)}/summary`,
  );
}

async function fetchProjectCommandCentre(projectId: string): Promise<ProjectCommandCentreResponse> {
  return apiJson<ProjectCommandCentreResponse>(
    `/api/staff/v1/projects/${encodeURIComponent(projectId)}/command-centre`,
  );
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

export const projectPageSnapshotQueryOptions = (host: string, projectId: string) =>
  queryOptions({
    queryKey: qk.projects.snapshot(host, projectId),
    queryFn: () => fetchProjectPageSnapshot(projectId),
    staleTime: FIVE_MINUTES,
    gcTime: ONE_DAY,
  });

export const projectPageSummaryQueryOptions = (host: string, projectId: string) =>
  queryOptions({
    queryKey: qk.projects.summary(host, projectId),
    queryFn: () => fetchProjectPageSummary(projectId),
    staleTime: FIVE_MINUTES,
    gcTime: ONE_DAY,
  });

export const projectCommandCentreQueryOptions = (host: string, projectId: string) =>
  queryOptions({
    queryKey: qk.projects.commandCentre(host, projectId),
    queryFn: () => fetchProjectCommandCentre(projectId),
    staleTime: TEN_SECONDS,
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
