import type { ScheduleV2Snapshot } from '@/lib/queries/schedule';

export type ScheduleBoardPlacementIntent = {
  projectId: string;
  scheduleItemId?: string;
  laneId: string | null;
  insertionIndex: number | null;
};

function matchesTarget(item: ScheduleV2Snapshot['scheduleItems'][number], intent: ScheduleBoardPlacementIntent): boolean {
  return intent.scheduleItemId ? item.id === intent.scheduleItemId : item.projectId === intent.projectId;
}

export function scheduleSnapshotMatchesBoardPlacement(
  snapshot: ScheduleV2Snapshot,
  intent: ScheduleBoardPlacementIntent,
): boolean {
  const matchingScheduledItems = snapshot.scheduleItems.filter((item) => matchesTarget(item, intent));

  if (intent.laneId === null) {
    return matchingScheduledItems.length === 0
      && snapshot.unscheduledJobs.some((job) => job.projectId === intent.projectId);
  }

  if (matchingScheduledItems.length !== 1) return false;
  const target = matchingScheduledItems[0];
  if (target.installerId !== intent.laneId || intent.insertionIndex === null) return false;

  const lane = snapshot.scheduleItems
    .filter((item) => item.installerId === intent.laneId)
    .slice()
    .sort((a, b) => a.sortIndex - b.sortIndex || a.id.localeCompare(b.id));

  return lane.findIndex((item) => matchesTarget(item, intent)) === intent.insertionIndex;
}
