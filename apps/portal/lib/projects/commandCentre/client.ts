import { apiJson } from '@/lib/repo/apiClient';
import type { ProjectCommandCentreResponse, ProjectCommandStaffSummary, ProjectOwnerKey } from './types';

export type ProjectCommandMutationResponse = {
  command: { id: string; committed: true; replayed?: boolean };
  commandCentre?: ProjectCommandCentreResponse;
  refreshRequired?: boolean;
};

export async function fetchProjectStaffDirectory(): Promise<ProjectCommandStaffSummary[]> {
  const response = await apiJson<{ staff: ProjectCommandStaffSummary[] }>('/api/staff/v1/staff-directory');
  return response.staff;
}

export function fetchProjectCommandCentre(projectId: string): Promise<ProjectCommandCentreResponse> {
  return apiJson<ProjectCommandCentreResponse>(
    `/api/staff/v1/projects/${encodeURIComponent(projectId)}/command-centre`,
  );
}

export function setProjectCommandOwner(projectId: string, input: {
  ownerKey: ProjectOwnerKey | null;
  expectedVersion: string | null;
  commandId: string;
}) {
  return apiJson<ProjectCommandMutationResponse>(
    `/api/staff/v1/projects/${encodeURIComponent(projectId)}/command-centre/owners`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function runProjectActionCommand(projectId: string, input: Record<string, unknown>) {
  return apiJson<ProjectCommandMutationResponse>(
    `/api/staff/v1/projects/${encodeURIComponent(projectId)}/command-centre/primary-action/commands`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}
