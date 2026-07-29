import { apiJson } from '@/lib/repo/apiClient';
import type { ProjectWorkProjection } from './types';

export type ProjectWorkMutationResponse = {
  command: {
    id: string;
    committed: true;
    replayed: boolean;
    rowVersion: number | null;
  };
  projectWork?: ProjectWorkProjection;
  refreshRequired?: boolean;
};

export function runProjectWorkItemCommand(
  projectId: string,
  input: Record<string, unknown>,
): Promise<ProjectWorkMutationResponse> {
  return apiJson(
    `/api/staff/v1/projects/${encodeURIComponent(projectId)}/work-items/commands`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function runProjectStateCommand(
  projectId: string,
  input: Record<string, unknown>,
): Promise<ProjectWorkMutationResponse> {
  return apiJson(
    `/api/staff/v1/projects/${encodeURIComponent(projectId)}/state/commands`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function runProjectConfirmationCommand(
  projectId: string,
  input: Record<string, unknown>,
): Promise<ProjectWorkMutationResponse> {
  return apiJson(
    `/api/staff/v1/projects/${encodeURIComponent(projectId)}/confirmations/commands`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}
