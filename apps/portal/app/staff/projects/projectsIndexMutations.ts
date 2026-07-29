import type { QueryClient } from '@tanstack/react-query';
import type { Contact } from '@/lib/types/contact';
import type { Project, ProjectStatus } from '@/lib/types/project';
import type { ProjectPageSnapshotResponse } from '@/lib/projects/types';
import {
  normalizePipelineStageKey,
  stageKeyToStatus,
  type PipelineStageKey,
} from '@/lib/projects/pipelineDefinition';
import { apiJson } from '@/lib/repo/apiClient';
import { correctProjectStage } from '@/lib/repo/projectsRepo';
import { qk } from '@/lib/queries/keys';
import {
  invalidateProjectReadCaches,
  invalidateProjectsIndexCaches,
  patchContactListItem,
  upsertProjectListItem,
} from '@/lib/queries/projectCache';
import { PROJECTS_INDEX_QUERY_SCOPE, type ProjectsIndexResponse } from '@/lib/queries/projectsIndex';

export type ProjectIndexEditableField = 'name' | 'phone' | 'address';

export type ProjectIndexStageCorrection = {
  projectId: string;
  nextStage: PipelineStageKey;
  reason: string | null;
};

function cachedProject(queryClient: QueryClient, host: string, projectId: string): Project | undefined {
  for (const scope of ['all', 'active'] as const) {
    const project = queryClient
      .getQueryData<Project[]>(qk.projects.list(host, scope))
      ?.find((entry) => entry.id === projectId);
    if (project) return project;
  }

  for (const archive of ['all', 'active', 'archived'] as const) {
    const matches = queryClient.getQueriesData<ProjectsIndexResponse>({
      queryKey: qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, archive),
    });
    for (const [, response] of matches) {
      const project = response?.projects.rows.find((entry) => entry.id === projectId);
      if (project) return project;
    }
  }

  return undefined;
}

function patchProjectReadModels(
  queryClient: QueryClient,
  host: string,
  projectId: string,
  updater: (current: ProjectPageSnapshotResponse) => ProjectPageSnapshotResponse,
) {
  for (const key of [qk.projects.summary(host, projectId), qk.projects.snapshot(host, projectId)] as const) {
    queryClient.setQueryData<ProjectPageSnapshotResponse | undefined>(key, (current) =>
      current ? updater(current) : current,
    );
  }
}

function patchInlineValue(args: {
  queryClient: QueryClient;
  host: string;
  project: Project;
  contact: Contact | null;
  field: ProjectIndexEditableField;
  value: string;
}) {
  const { queryClient, host, project, contact, field, value } = args;
  const current = cachedProject(queryClient, host, project.id) ?? project;

  if (field === 'phone') {
    if (contact) {
      patchContactListItem(queryClient, host, contact.id, (entry) => ({
        ...entry,
        phone: value,
      }));
    }
  } else {
    upsertProjectListItem(queryClient, host, {
      ...current,
      ...(field === 'name' ? { projectName: value, name: value } : { siteAddress: value, address: value }),
    });
  }

  queryClient.setQueryData<Project | null | undefined>(qk.projects.detail(host, project.id), (entry) => {
    if (!entry) return entry;
    if (field === 'name') return { ...entry, projectName: value, name: value };
    if (field === 'address') return { ...entry, siteAddress: value, address: value };
    return { ...entry, phone: value };
  });

  if (project.contactId) {
    queryClient.setQueryData<Project[] | undefined>(qk.projects.byContact(host, project.contactId), (entries) =>
      Array.isArray(entries)
        ? entries.map((entry) => {
            if (entry.id !== project.id) return entry;
            if (field === 'name') return { ...entry, projectName: value, name: value };
            if (field === 'address') return { ...entry, siteAddress: value, address: value };
            return { ...entry, phone: value };
          })
        : entries,
    );
  }

  patchProjectReadModels(queryClient, host, project.id, (response) => ({
    ...response,
    snapshot: {
      ...response.snapshot,
      project: {
        ...response.snapshot.project,
        ...(field === 'name'
          ? { name: value }
          : field === 'address'
            ? { siteAddress: value || undefined }
            : { contactPhone: value || undefined }),
      },
    },
  }));
}

export async function saveProjectIndexInlineEdit(args: {
  queryClient: QueryClient;
  host: string;
  project: Project;
  contact: Contact | null;
  field: ProjectIndexEditableField;
  value: string;
}): Promise<void> {
  const { queryClient, host, project, contact, field, value } = args;
  const previousValue =
    field === 'name'
      ? (project.projectName ?? project.name ?? '').trim()
      : field === 'address'
        ? (project.siteAddress ?? project.address ?? '').trim()
        : (contact?.phone ?? (project as { phone?: string }).phone ?? '').trim();

  patchInlineValue(args);

  const body =
    field === 'name'
      ? { project: { projectName: value } }
      : field === 'address'
        ? { project: { siteAddress: value } }
        : { contact: { phone: value } };

  try {
    await apiJson(`/api/projects/${encodeURIComponent(project.id)}/details`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  } catch (error) {
    patchInlineValue({ ...args, value: previousValue });
    throw error;
  }

  void invalidateProjectsIndexCaches(queryClient, host, { includeContacts: field === 'phone' });
  void invalidateProjectReadCaches(queryClient, host, project.id, { includeProjectsList: false });
}

function patchStage(
  queryClient: QueryClient,
  host: string,
  fallbackProject: Project,
  status: ProjectStatus,
) {
  const current = cachedProject(queryClient, host, fallbackProject.id) ?? fallbackProject;
  upsertProjectListItem(queryClient, host, { ...current, status });

  const stage = normalizePipelineStageKey(status) ?? 'new';
  patchProjectReadModels(queryClient, host, fallbackProject.id, (response) => ({
    ...response,
    snapshot: {
      ...response.snapshot,
      project: { ...response.snapshot.project, stage },
      pipeline: { ...response.snapshot.pipeline, stage },
      tasks: { ...response.snapshot.tasks, stage },
    },
  }));
}

export async function correctProjectIndexStage(args: {
  queryClient: QueryClient;
  host: string;
  project: Project;
  correction: ProjectIndexStageCorrection;
}) {
  const { queryClient, host, project, correction } = args;
  const previousStatus = (project.status ?? 'NEW') as ProjectStatus;
  const nextStatus = stageKeyToStatus(correction.nextStage) as ProjectStatus;
  patchStage(queryClient, host, project, nextStatus);

  try {
    const result = await correctProjectStage(project.id, nextStatus, { reason: correction.reason });
    void invalidateProjectsIndexCaches(queryClient, host);
    void invalidateProjectReadCaches(queryClient, host, project.id, { includeProjectsList: false });
    return result;
  } catch (error) {
    patchStage(queryClient, host, project, previousStatus);
    throw error;
  }
}

function patchArchiveState(
  queryClient: QueryClient,
  host: string,
  fallbackProject: Project,
  isArchived: boolean,
) {
  const current = cachedProject(queryClient, host, fallbackProject.id) ?? fallbackProject;
  upsertProjectListItem(queryClient, host, {
    ...current,
    isArchived,
  });
}

export async function setProjectIndexArchived(args: {
  queryClient: QueryClient;
  host: string;
  project: Project;
  isArchived: boolean;
}): Promise<void> {
  const { queryClient, host, project, isArchived } = args;
  const previousArchived = Boolean(project.isArchived);
  patchArchiveState(queryClient, host, project, isArchived);

  try {
    await apiJson(`/api/projects/${encodeURIComponent(project.id)}/details`, {
      method: 'PATCH',
      body: JSON.stringify({
        project: { archivedAt: isArchived ? new Date().toISOString() : null },
      }),
    });
  } catch (error) {
    patchArchiveState(queryClient, host, project, previousArchived);
    throw error;
  }

  void invalidateProjectsIndexCaches(queryClient, host);
  void invalidateProjectReadCaches(queryClient, host, project.id, { includeProjectsList: false });
}
