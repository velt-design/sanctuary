import type { QueryClient } from '@tanstack/react-query';
import type { ProjectPageSnapshot, ProjectPageSnapshotResponse } from '@/lib/projects/types';
import { qk } from './keys';
import type { Project } from '@/lib/types/project';
import type { Contact } from '@/lib/types/contact';
import { normalizeProjectStatus } from '@/lib/types/project';
import { normalizePipelineStageKey } from '@/lib/projects/pipelineDefinition';
import {
  PROJECTS_INDEX_QUERY_SCOPE,
  type ProjectsIndexArchiveFilter,
  type ProjectsIndexResponse,
} from './projectsIndex';

function cloneProject(project: Project): Project {
  return { ...project };
}

export function buildProjectSnapshotPlaceholder(
  project: Project,
  contact?: Contact | null,
): ProjectPageSnapshotResponse {
  const normalized = normalizeProjectStatus(project.status ?? 'NEW');
  const stage = normalizePipelineStageKey(normalized.status) ?? 'new';
  const snapshot: ProjectPageSnapshot = {
    project: {
      id: project.id,
      name: project.projectName ?? project.name ?? 'Project',
      stage,
      ...(project.contactId ? { contactId: project.contactId } : {}),
      ...(contact?.displayName ?? project.clientName
        ? { contactName: contact?.displayName ?? project.clientName }
        : {}),
      ...(contact?.email ? { contactEmail: contact.email } : {}),
      ...(contact?.phone ? { contactPhone: contact.phone } : {}),
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
    notes: [],
  };

  return {
    snapshot,
    generatedAt: project.updatedAt ?? project.createdAt ?? new Date().toISOString(),
  };
}

export function getProjectSnapshotPlaceholderFromCaches(
  queryClient: QueryClient,
  host: string,
  projectId: string,
): ProjectPageSnapshotResponse | undefined {
  const project = (['active', 'all'] as const)
    .flatMap((scope) => queryClient.getQueryData<Project[]>(qk.projects.list(host, scope)) ?? [])
    .find((entry) => entry.id === projectId);
  if (!project) return undefined;

  const contacts = queryClient.getQueryData<Contact[]>(qk.contacts.list(host));
  const contact = project.contactId ? contacts?.find((entry) => entry.id === project.contactId) : undefined;
  return buildProjectSnapshotPlaceholder(project, contact);
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
  const patchRows = (current: Project[] | undefined, scope: 'active' | 'all') => {
    if (!Array.isArray(current)) return current;
    const existing = current.find((project) => project.id === projectId);
    if (!existing) return current;
    const nextProject = cloneProject(updater(existing));
    if (scope === 'active' && nextProject.isArchived) {
      return current.filter((project) => project.id !== projectId);
    }
    return current.map((project) => (project.id === projectId ? nextProject : project));
  };

  for (const scope of ['active', 'all'] as const) {
    queryClient.setQueryData<Project[] | undefined>(qk.projects.list(host, scope), (current) => patchRows(current, scope));
  }

  for (const archive of ['active', 'archived', 'all'] as const satisfies readonly ProjectsIndexArchiveFilter[]) {
    queryClient.setQueryData<ProjectsIndexResponse | undefined>(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, archive), (current) => {
      if (!current) return current;
      const existing = current.projects.rows.find((project) => project.id === projectId);
      if (!existing) return current;
      const nextProject = cloneProject(updater(existing));
      const belongs =
        archive === 'all' || (archive === 'active' ? !nextProject.isArchived : Boolean(nextProject.isArchived));
      const rows = belongs
        ? current.projects.rows.map((project) => (project.id === projectId ? nextProject : project))
        : current.projects.rows.filter((project) => project.id !== projectId);
      return { ...current, projects: { ...current.projects, rows } };
    });
  }
}

export function patchContactListItem(
  queryClient: QueryClient,
  host: string,
  contactId: string,
  updater: (contact: Contact) => Contact,
) {
  const patchRows = (current: Contact[] | undefined) => {
    if (!Array.isArray(current)) return current;
    return current.map((contact) => (contact.id === contactId ? { ...updater(contact) } : contact));
  };
  queryClient.setQueryData<Contact[] | undefined>(qk.contacts.list(host), patchRows);
  for (const archive of ['active', 'archived', 'all'] as const satisfies readonly ProjectsIndexArchiveFilter[]) {
    queryClient.setQueryData<ProjectsIndexResponse | undefined>(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, archive), (current) =>
      current
        ? { ...current, contacts: { ...current.contacts, rows: patchRows(current.contacts.rows) ?? [] } }
        : current,
    );
  }
}

export function removeProjectListItem(queryClient: QueryClient, host: string, projectId: string) {
  for (const scope of ['active', 'all'] as const) {
    queryClient.setQueryData<Project[] | undefined>(qk.projects.list(host, scope), (current) =>
      Array.isArray(current) ? current.filter((project) => project.id !== projectId) : current,
    );
  }
  for (const archive of ['active', 'archived', 'all'] as const satisfies readonly ProjectsIndexArchiveFilter[]) {
    queryClient.setQueryData<ProjectsIndexResponse | undefined>(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, archive), (current) =>
      current
        ? {
            ...current,
            projects: {
              ...current.projects,
              rows: current.projects.rows.filter((project) => project.id !== projectId),
            },
          }
        : current,
    );
  }
}

export async function invalidateProjectsIndexCaches(
  queryClient: QueryClient,
  host: string,
  options?: { includeContacts?: boolean },
) {
  await Promise.allSettled([
    queryClient.invalidateQueries({ queryKey: qk.projects.indexPrefix(PROJECTS_INDEX_QUERY_SCOPE) }),
    queryClient.invalidateQueries({ queryKey: qk.projects.listPrefix(host) }),
    options?.includeContacts
      ? queryClient.invalidateQueries({ queryKey: qk.contacts.list(host) })
      : Promise.resolve(),
  ]);
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
    includeProjectsList ? queryClient.invalidateQueries({ queryKey: qk.projects.indexPrefix(PROJECTS_INDEX_QUERY_SCOPE) }) : Promise.resolve(),
    opts?.includeQuotes ? queryClient.invalidateQueries({ queryKey: qk.quotes.versionsByProject(host, projectId) }) : Promise.resolve(),
    opts?.includeEstimates ? queryClient.invalidateQueries({ queryKey: qk.estimates.metaByProject(host, projectId) }) : Promise.resolve(),
  ]);
}
