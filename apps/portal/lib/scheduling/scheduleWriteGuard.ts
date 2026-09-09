import 'server-only';
import { buildCrewContext } from './scheduleV2Server';

export type ScheduleWriteGuard = Record<string, { revision: number; anchor_date: string }>;

export function scheduleWriteGuard(context: Parameters<typeof buildCrewContext>[0], crewIds: Array<string | null | undefined>): ScheduleWriteGuard {
  return Object.fromEntries([...new Set(crewIds.filter((id): id is string => Boolean(id)))].map((id) => {
    const revision = context.crews.find((crew) => crew.id === id)?.schedule_revision;
    // Missing revisions deliberately fail closed at the guarded RPC boundary.
    return [id, { revision: typeof revision === 'number' && Number.isSafeInteger(revision) && revision >= 0 ? revision : -1, anchor_date: buildCrewContext(context, id)?.recompute.anchor_date ?? context.today }];
  }));
}
