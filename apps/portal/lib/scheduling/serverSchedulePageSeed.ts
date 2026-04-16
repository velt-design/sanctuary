import 'server-only';

import { loadScheduleBoardResponse, isScheduleSchemaNotReadyError } from '@/lib/scheduling/scheduleBoardServer';
import { resolveScheduleTodayYmd } from '@/lib/scheduling/scheduleClock';
import { resolveDefaultScheduleGanttRange } from '@/lib/scheduling/scheduleGanttRange';
import { loadScheduleGanttResponse } from '@/lib/scheduling/scheduleGanttServer';
import { mapScheduleBoardResponseToV2Snapshot, mapScheduleGanttResponseToV2Snapshot, type ScheduleV2Snapshot } from '@/lib/scheduling/scheduleV2Snapshot';

export type SchedulePageSeed =
  | { initialScheduleMode: 'legacy'; initialV2Snapshot: null }
  | { initialScheduleMode: 'v2'; initialSeedKind: 'board' | 'gantt'; initialV2Snapshot: ScheduleV2Snapshot };

export async function loadSchedulePageSeed(input?: { view?: 'board' | 'gantt' }): Promise<SchedulePageSeed> {
  const view = input?.view === 'gantt' ? 'gantt' : 'board';
  const today = resolveScheduleTodayYmd();
  try {
    if (view === 'gantt') {
      const range = resolveDefaultScheduleGanttRange(today);
      const gantt = await loadScheduleGanttResponse({
        today,
        rangeStart: range.rangeStart,
        rangeEnd: range.rangeEnd,
      });
      return {
        initialScheduleMode: 'v2',
        initialSeedKind: 'gantt',
        initialV2Snapshot: mapScheduleGanttResponseToV2Snapshot(gantt),
      };
    }

    const board = await loadScheduleBoardResponse({ today });
    return {
      initialScheduleMode: 'v2',
      initialSeedKind: 'board',
      initialV2Snapshot: mapScheduleBoardResponseToV2Snapshot(board),
    };
  } catch (error) {
    if (isScheduleSchemaNotReadyError(error)) {
      return {
        initialScheduleMode: 'legacy',
        initialV2Snapshot: null,
      };
    }
    throw error;
  }
}
