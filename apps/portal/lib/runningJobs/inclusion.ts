import { normalizeProjectStatus, type ProjectStatus } from '@/lib/types/project';

const INCLUDED_RUNNING_JOB_STAGES: ReadonlySet<ProjectStatus> = new Set(['DEPOSIT', 'SCHEDULED', 'COMPLETED', 'PAID']);

export function shouldIncludeRunningJob(stageRaw: unknown, hasScheduledJob: boolean): boolean {
  const normalizedStage = normalizeProjectStatus(stageRaw).status;
  return INCLUDED_RUNNING_JOB_STAGES.has(normalizedStage) || hasScheduledJob;
}
