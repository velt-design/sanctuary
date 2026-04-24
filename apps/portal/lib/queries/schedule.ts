import { queryOptions } from '@tanstack/react-query';
import { fetchScheduleBoard, fetchScheduleGantt } from '@/lib/repo/scheduleV2Repo';
import { resolveDefaultScheduleGanttRange } from '@/lib/scheduling/scheduleGanttRange';
import { mapScheduleBoardResponseToV2Snapshot, mapScheduleGanttResponseToV2Snapshot, type ScheduleV2Snapshot } from '@/lib/scheduling/scheduleV2Snapshot';
import { qk } from './keys';
export type { ScheduleProjectSummary, ScheduleV2Snapshot } from '@/lib/scheduling/scheduleV2Snapshot';

export const SCHEDULE_BOARD_STALE_TIME_MS = 30_000;
export const SCHEDULE_GANTT_STALE_TIME_MS = 30_000;

async function fetchScheduleV2Snapshot(today: string): Promise<ScheduleV2Snapshot> {
  const board = await fetchScheduleBoard({ today });
  return mapScheduleBoardResponseToV2Snapshot(board);
}

export const scheduleV2SnapshotQueryOptions = (host: string, today: string) =>
  queryOptions({
    queryKey: qk.schedule.board(host, today),
    queryFn: () => fetchScheduleV2Snapshot(today),
    staleTime: SCHEDULE_BOARD_STALE_TIME_MS,
  });

async function fetchScheduleGanttV2Snapshot(input: { today: string; rangeStart: string; rangeEnd: string }): Promise<ScheduleV2Snapshot> {
  const gantt = await fetchScheduleGantt({
    today: input.today,
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
  });
  return mapScheduleGanttResponseToV2Snapshot(gantt);
}

export const scheduleGanttV2SnapshotQueryOptions = (
  host: string,
  today: string,
  range: { rangeStart: string; rangeEnd: string } = resolveDefaultScheduleGanttRange(today),
) =>
  queryOptions({
    queryKey: qk.schedule.gantt(host, range.rangeStart, range.rangeEnd, today),
    queryFn: () => fetchScheduleGanttV2Snapshot({ today, rangeStart: range.rangeStart, rangeEnd: range.rangeEnd }),
    staleTime: SCHEDULE_GANTT_STALE_TIME_MS,
  });
