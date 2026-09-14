import type { ScheduleItem, SchedulingIssue } from '@/lib/types/scheduling';
import type { ScheduleProjectSummary } from '@/lib/queries/schedule';
import type { PinnedConflict } from '@/lib/scheduling/recompute';

export function buildScheduleConflictIssues(conflicts: PinnedConflict[], items: ScheduleItem[], projects: Map<string, ScheduleProjectSummary>): SchedulingIssue[] {
  const byJob = new Map(items.filter((item) => item.scheduledJobId).map((item) => [item.scheduledJobId, item]));
  const name = (item: ScheduleItem) => projects.get(item.projectId)?.projectName ?? projects.get(item.projectId)?.name ?? 'Scheduled job';
  return conflicts.flatMap((conflict) => {
    const primary = byJob.get(conflict.job_id);
    const secondary = byJob.get(conflict.conflicting_job_id);
    const item = primary ?? secondary;
    if (!item) return [];
    const other = primary ? secondary : undefined;
    return [{
      level: 'error' as const, scheduleItemId: item.id, relatedScheduleItemId: other?.id, overlapKey: conflict.overlap_key,
      message: `${name(item)} overlaps ${other ? name(other) : 'another fixed job'} by ${conflict.overlap_days} working day${conflict.overlap_days === 1 ? '' : 's'}.`,
    }];
  });
}
