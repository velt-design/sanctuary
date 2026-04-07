import { queryOptions } from '@tanstack/react-query';
import { fetchScheduleBoard } from '@/lib/repo/scheduleV2Repo';
import { mapScheduleBoardResponseToV2Snapshot, type ScheduleV2Snapshot } from '@/lib/scheduling/scheduleV2Snapshot';
import { qk } from './keys';
export type { ScheduleProjectSummary, ScheduleV2Snapshot } from '@/lib/scheduling/scheduleV2Snapshot';

async function fetchScheduleV2Snapshot(today: string): Promise<ScheduleV2Snapshot> {
  const board = await fetchScheduleBoard({ today });
  return mapScheduleBoardResponseToV2Snapshot(board);
}

export const scheduleV2SnapshotQueryOptions = (host: string, today: string) =>
  queryOptions({
    queryKey: qk.schedule.board(host, today),
    queryFn: () => fetchScheduleV2Snapshot(today),
  });
