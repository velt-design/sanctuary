import type { QueryClient } from '@tanstack/react-query';
import { qk } from '../queries/keys';
import { patchProjectListItem, patchProjectSnapshot } from '../queries/projectCache';
import type { Project } from '../types/project';

export type PortalProjectDetailsDraft = {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  projectName: string;
  siteAddress: string;
  region: string;
  quoteRef: string;
};

export type PortalProjectDetailsUpdateMutationPayload = {
  projectId: string;
  contactId: string | null;
  draft: PortalProjectDetailsDraft;
  previousDraft: PortalProjectDetailsDraft;
};

export function buildProjectDetailsEntityKey(projectId: string): string {
  return `project:details:${projectId}`;
}

export function normalizeProjectDetailsDraft(draft: PortalProjectDetailsDraft): PortalProjectDetailsDraft {
  return {
    contactName: draft.contactName.trim(),
    contactEmail: draft.contactEmail.trim(),
    contactPhone: draft.contactPhone.trim(),
    projectName: draft.projectName.trim(),
    siteAddress: draft.siteAddress.trim(),
    region: draft.region.trim(),
    quoteRef: draft.quoteRef.trim(),
  };
}

export function patchProjectDetailsCaches(
  queryClient: QueryClient,
  hostKey: string,
  projectId: string,
  draft: PortalProjectDetailsDraft,
  options?: { contactId?: string | null },
) {
  const normalized = normalizeProjectDetailsDraft(draft);

  patchProjectSnapshot(queryClient, hostKey, projectId, (currentSnapshot) => {
    if (!currentSnapshot) return currentSnapshot;
    return {
      ...currentSnapshot,
      generatedAt: new Date().toISOString(),
      snapshot: {
        ...currentSnapshot.snapshot,
        project: {
          ...currentSnapshot.snapshot.project,
          name: normalized.projectName || currentSnapshot.snapshot.project.name,
          contactName: normalized.contactName || undefined,
          contactEmail: normalized.contactEmail || undefined,
          contactPhone: normalized.contactPhone || undefined,
          siteAddress: normalized.siteAddress || undefined,
          region: normalized.region || undefined,
          quoteRef: normalized.quoteRef || undefined,
        },
      },
    };
  });

  queryClient.setQueryData<Project | null | undefined>(qk.projects.detail(hostKey, projectId), (currentProject) => {
    if (!currentProject) return currentProject;
    return {
      ...currentProject,
      projectName: normalized.projectName || currentProject.projectName || currentProject.name,
      name: normalized.projectName || currentProject.projectName || currentProject.name,
      region: normalized.region || undefined,
      quoteRef: normalized.quoteRef || undefined,
      siteAddress: normalized.siteAddress || undefined,
      address: normalized.siteAddress || undefined,
      clientName: normalized.contactName || currentProject.clientName,
      email: normalized.contactEmail || currentProject.email,
      phone: normalized.contactPhone || currentProject.phone,
    };
  });

  patchProjectListItem(queryClient, hostKey, projectId, (currentProject) => ({
    ...currentProject,
    projectName: normalized.projectName || currentProject.projectName || currentProject.name,
    name: normalized.projectName || currentProject.projectName || currentProject.name,
    region: normalized.region || undefined,
    quoteRef: normalized.quoteRef || undefined,
    siteAddress: normalized.siteAddress || undefined,
    address: normalized.siteAddress || undefined,
    clientName: normalized.contactName || currentProject.clientName,
    email: normalized.contactEmail || currentProject.email,
    phone: normalized.contactPhone || currentProject.phone,
  }));

  const contactId = options?.contactId ?? null;
  if (!contactId) return;

  queryClient.setQueryData<Project[] | undefined>(qk.projects.byContact(hostKey, contactId), (currentProjects) => {
    if (!Array.isArray(currentProjects)) return currentProjects;
    return currentProjects.map((project) =>
      project.id === projectId
        ? {
            ...project,
            projectName: normalized.projectName || project.projectName || project.name,
            name: normalized.projectName || project.projectName || project.name,
            region: normalized.region || undefined,
            quoteRef: normalized.quoteRef || undefined,
            siteAddress: normalized.siteAddress || undefined,
            address: normalized.siteAddress || undefined,
            clientName: normalized.contactName || project.clientName,
          }
        : project,
    );
  });
}
