import { normalizeProjectStatus, type ProjectStatus } from '@/lib/types/project';

export const SCHEDULING_READY_PROJECT_STATUS: ProjectStatus = 'DEPOSIT';

export function normalizeSchedulingProjectStatus(raw: unknown): ProjectStatus {
  return normalizeProjectStatus(raw).status;
}

export function isSchedulingReadyProjectStatus(raw: unknown): boolean {
  return normalizeSchedulingProjectStatus(raw) === SCHEDULING_READY_PROJECT_STATUS;
}
