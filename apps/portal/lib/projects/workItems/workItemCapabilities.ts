import type { ProjectWorkItemSourceType } from './types';

const GENERIC_COMPLETION_SOURCES = new Set<ProjectWorkItemSourceType>([
  'MANUAL',
  'STAGE_REVIEW',
]);

export function isGenericCompletableWorkSource(
  sourceType: ProjectWorkItemSourceType | null,
): boolean {
  return Boolean(sourceType && GENERIC_COMPLETION_SOURCES.has(sourceType));
}
