import type { QueryClient } from '@tanstack/react-query';
import type { ProjectPageSnapshot, ProjectPageSnapshotResponse } from '@/lib/projects/types';
import { qk } from './keys';
import type { Project } from '@/lib/types/project';
import type { Contact } from '@/lib/types/contact';
import {
  CONTACTS_INDEX_QUERY_SCOPE,
  patchContactAcrossIndexCaches,
} from './contactsIndex';
import { normalizeProjectStatus } from '@/lib/types/project';
import { normalizePipelineStageKey } from '@/lib/projects/pipelineDefinition';
import { invalidatePortalSearchQueries } from './portalSearch';
import {
  PROJECTS_INDEX_QUERY_SCOPE,
  type ProjectsIndexArchiveFilter,
  type ProjectsIndexResponse,
} from './projectsIndex';
import { invalidateProjectWorkReads } from './projectWorkCache';

function cloneProject(project: Project): Project {
  return { ...project };
}

function sortProjects(projects: Project[]): Project[] {
  return projects
    .slice()
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

function withProjectMembership(
  rows: Project[],
  project: Project,
  belongs: boolean,
): { rows: Project[]; countDelta: number } {
  const existingIndex = rows.findIndex((entry) => entry.id === project.id);
  if (!belongs) {
    return existingIndex >= 0
      ? { rows: rows.filter((entry) => entry.id !== project.id), countDelta: -1 }
      : { rows, countDelta: 0 };
  }

  if (existingIndex >= 0) {
    return {
      rows: rows.map((entry) => (entry.id === project.id ? cloneProject(project) : entry)),
      countDelta: 0,
    };
  }

  return { rows: sortProjects([...rows, cloneProject(project)]), countDelta: 1 };
}

function adjustKnownCount(totalCount: number | null, delta: number): number | null {
  return totalCount === null || delta === 0 ? totalCount : Math.max(0, totalCount + delta);
}

function canOptimisticallyEnterFirstProjectPage(current: ProjectsIndexResponse): boolean {
  return current.projects.page === 1
    && current.query.search === ''
    && current.query.status === 'all'
    && current.query.journey === 'all'
    && current.query.state === 'all'
    && current.query.sort === 'newest';
}

function canOptimisticallyPatchExistingProject(
  current: ProjectsIndexResponse,
): boolean {
  return current.query.search === ''
    && current.query.status === 'all'
    && current.query.journey === 'all'
    && current.query.state === 'all';
}

export function buildProjectSnapshotPlaceholder(
  project: Project,
  contact?: Contact | null,
): ProjectPageSnapshotResponse {
  const normalized = normalizeProjectStatus(project.status ?? 'NEW');
  const stage = normalizePipelineStageKey(normalized.status) ?? 'new';
  const snapshot: ProjectPageSnapshot = {
    workModel: 'legacy',
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
  const indexMatch = queryClient
    .getQueriesData<ProjectsIndexResponse>({
      queryKey: qk.projects.indexPrefix(PROJECTS_INDEX_QUERY_SCOPE),
    })
    .map(([, response]) => response)
    .filter((response): response is ProjectsIndexResponse => Boolean(response))
    .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))
    .map((response) => {
      const project = response.projects.rows.find((entry) => entry.id === projectId);
      if (!project) return null;
      const contact = project.contactId
        ? response.contacts.rows.find((entry) => entry.id === project.contactId)
        : undefined;
      return { project, contact };
    })
    .find((match) => match !== null);
  if (indexMatch) {
    return buildProjectSnapshotPlaceholder(indexMatch.project, indexMatch.contact);
  }

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
    queryClient.setQueriesData<ProjectsIndexResponse>(
      { queryKey: qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, archive) },
      (current) => {
      if (!current) return current;
      if (!canOptimisticallyPatchExistingProject(current)) return current;
      const existing = current.projects.rows.find((project) => project.id === projectId);
      if (!existing) return current;
      const nextProject = cloneProject(updater(existing));
      const belongs =
        archive === 'all' || (archive === 'active' ? !nextProject.isArchived : Boolean(nextProject.isArchived));
      const rows = belongs
        ? current.projects.rows.map((project) => (project.id === projectId ? nextProject : project))
        : current.projects.rows.filter((project) => project.id !== projectId);
      const removed = existing && !belongs ? 1 : 0;
      return {
        ...current,
        projects: {
          ...current.projects,
          rows,
          totalCount: adjustKnownCount(current.projects.totalCount, -removed),
        },
      };
    });
  }
  void invalidatePortalSearchQueries(queryClient, 'none');
}

/**
 * Inserts or replaces one project across every canonical/index cache and moves
 * it between active/archived scopes. This is the reversible owner used by
 * optimistic archive changes and provisional project creation.
 */
export function upsertProjectListItem(
  queryClient: QueryClient,
  host: string,
  project: Project,
) {
  for (const scope of ['active', 'all'] as const) {
    queryClient.setQueryData<Project[] | undefined>(qk.projects.list(host, scope), (current) => {
      if (!Array.isArray(current)) return current;
      const belongs = scope === 'all' || !project.isArchived;
      return withProjectMembership(current, project, belongs).rows;
    });
  }

  for (const archive of ['active', 'archived', 'all'] as const satisfies readonly ProjectsIndexArchiveFilter[]) {
    queryClient.setQueriesData<ProjectsIndexResponse>(
      { queryKey: qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, archive) },
      (current) => {
      if (!current) return current;
      const belongs = archive === 'all' || (archive === 'active' ? !project.isArchived : Boolean(project.isArchived));
      const existing = current.projects.rows.find((entry) => entry.id === project.id);
      if (existing && !canOptimisticallyPatchExistingProject(current)) {
        return current;
      }
      if (!existing && (!belongs || !canOptimisticallyEnterFirstProjectPage(current))) return current;
      const next = withProjectMembership(current.projects.rows, project, belongs);
      const rows = next.rows.slice(0, current.projects.pageSize);
      return {
        ...current,
        projects: {
          ...current.projects,
          rows,
          totalCount: adjustKnownCount(current.projects.totalCount, next.countDelta),
        },
      };
    });
  }
  void invalidatePortalSearchQueries(queryClient, 'none');
}

export function patchContactListItem(
  queryClient: QueryClient,
  host: string,
  contactId: string,
  updater: (contact: Contact) => Contact,
) {
  patchContactAcrossIndexCaches(queryClient, host, contactId, updater);
}

export function removeProjectListItem(queryClient: QueryClient, host: string, projectId: string) {
  for (const scope of ['active', 'all'] as const) {
    queryClient.setQueryData<Project[] | undefined>(qk.projects.list(host, scope), (current) =>
      Array.isArray(current) ? current.filter((project) => project.id !== projectId) : current,
    );
  }
  for (const archive of ['active', 'archived', 'all'] as const satisfies readonly ProjectsIndexArchiveFilter[]) {
    queryClient.setQueriesData<ProjectsIndexResponse>(
      { queryKey: qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, archive) },
      (current) => {
        if (!current) return current;
        const removed = current.projects.rows.some((project) => project.id === projectId);
        if (!removed) return current;
        return {
          ...current,
          projects: {
            ...current.projects,
            rows: current.projects.rows.filter((project) => project.id !== projectId),
            totalCount: adjustKnownCount(current.projects.totalCount, -1),
          },
        };
      },
    );
  }
  void invalidatePortalSearchQueries(queryClient, 'none');
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
      ? Promise.all([
          queryClient.invalidateQueries({ queryKey: qk.contacts.list(host) }),
          queryClient.invalidateQueries({ queryKey: qk.contacts.indexPrefix(CONTACTS_INDEX_QUERY_SCOPE) }),
        ])
      : Promise.resolve(),
    invalidatePortalSearchQueries(queryClient),
    invalidateProjectWorkReads(queryClient, host),
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
    invalidateProjectWorkReads(queryClient, host, projectId),
    includeProjectDetail ? queryClient.invalidateQueries({ queryKey: qk.projects.detail(host, projectId) }) : Promise.resolve(),
    includeProjectsList ? queryClient.invalidateQueries({ queryKey: qk.projects.listPrefix(host) }) : Promise.resolve(),
    includeProjectsList ? queryClient.invalidateQueries({ queryKey: qk.projects.indexPrefix(PROJECTS_INDEX_QUERY_SCOPE) }) : Promise.resolve(),
    includeProjectsList ? invalidatePortalSearchQueries(queryClient) : Promise.resolve(),
    opts?.includeQuotes ? queryClient.invalidateQueries({ queryKey: qk.quotes.versionsByProject(host, projectId) }) : Promise.resolve(),
    opts?.includeEstimates ? queryClient.invalidateQueries({ queryKey: qk.estimates.metaByProject(host, projectId) }) : Promise.resolve(),
  ]);
}
