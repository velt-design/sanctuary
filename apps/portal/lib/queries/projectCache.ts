import type { QueryClient } from '@tanstack/react-query';
import type { ProjectPageSnapshot, ProjectPageSnapshotResponse } from '@/lib/projects/types';
import { qk } from './keys';
import type { Project } from '@/lib/types/project';
import { normalizeProjectStatus } from '@/lib/types/project';
import { normalizePipelineStageKey } from '@/lib/projects/pipelineDefinition';

function cloneProject(project: Project): Project {
  return { ...project };
}

export function buildProjectSnapshotPlaceholder(project: Project): ProjectPageSnapshotResponse {
  const normalized = normalizeProjectStatus(project.status ?? 'NEW');
  const stage = normalizePipelineStageKey(normalized.status) ?? 'new';
  const snapshot: ProjectPageSnapshot = {
    project: {
      id: project.id,
      name: project.projectName ?? project.name ?? 'Project',
      stage,
      ...(project.contactId ? { contactId: project.contactId } : {}),
      ...(project.clientName ? { contactName: project.clientName } : {}),
      ...(project.region ? { region: project.region } : {}),
      ...(project.quoteRef ? { quoteRef: project.quoteRef } : {}),
      ...(project.siteAddress ?? project.address ? { siteAddress: project.siteAddress ?? project.address ?? undefined } : {}),
      ...(project.nextActionDate ?? project.followUpDate
        ? { nextActionDate: (project.nextActionDate ?? project.followUpDate) || undefined }
        : {}),
    },
    pipeline: {
      stage,
    },
    tasks: {
      stage,
      items: [],
    },
    activity: [],
    emails: [],
  };

  return {
    snapshot,
    generatedAt: project.updatedAt ?? project.createdAt ?? new Date().toISOString(),
  };
}

export function getProjectSnapshotPlaceholderFromList(
  queryClient: QueryClient,
  host: string,
  projectId: string,
): ProjectPageSnapshotResponse | undefined {
  const cached = queryClient.getQueryData<Project[]>(qk.projects.list(host));
  if (!Array.isArray(cached)) return undefined;
  const project = cached.find((entry) => entry.id === projectId);
  if (!project) return undefined;
  return buildProjectSnapshotPlaceholder(project);
}

export function patchProjectSnapshot(
  queryClient: QueryClient,
  host: string,
  projectId: string,
  updater: (current: ProjectPageSnapshotResponse | undefined) => ProjectPageSnapshotResponse | undefined,
) {
  queryClient.setQueryData<ProjectPageSnapshotResponse | undefined>(qk.projects.snapshot(host, projectId), updater);
}

export function patchProjectListItem(
  queryClient: QueryClient,
  host: string,
  projectId: string,
  updater: (project: Project) => Project,
) {
  queryClient.setQueryData<Project[] | undefined>(qk.projects.list(host), (current) => {
    if (!Array.isArray(current)) return current;
    let changed = false;
    const next = current.map((project) => {
      if (project.id !== projectId) return project;
      changed = true;
      return cloneProject(updater(project));
    });
    return changed ? next : current;
  });
}

export async function invalidateProjectReadCaches(
  queryClient: QueryClient,
  host: string,
  projectId: string,
  opts?: {
    includeQuotes?: boolean;
    includeEstimates?: boolean;
    includeProjectsList?: boolean;
    includeProjectDetail?: boolean;
  },
) {
  const includeProjectDetail = opts?.includeProjectDetail ?? true;
  const includeProjectsList = opts?.includeProjectsList ?? true;

  await Promise.allSettled([
    queryClient.invalidateQueries({ queryKey: qk.projects.snapshot(host, projectId) }),
    includeProjectDetail ? queryClient.invalidateQueries({ queryKey: qk.projects.detail(host, projectId) }) : Promise.resolve(),
    includeProjectsList ? queryClient.invalidateQueries({ queryKey: qk.projects.listPrefix(host) }) : Promise.resolve(),
    opts?.includeQuotes ? queryClient.invalidateQueries({ queryKey: qk.quotes.versionsByProject(host, projectId) }) : Promise.resolve(),
    opts?.includeEstimates ? queryClient.invalidateQueries({ queryKey: qk.estimates.metaByProject(host, projectId) }) : Promise.resolve(),
  ]);
}
