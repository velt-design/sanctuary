import 'server-only';

import { loadScheduleBoardResponse, isScheduleSchemaNotReadyError } from '@/lib/scheduling/scheduleBoardServer';
import { resolveScheduleTodayYmd } from '@/lib/scheduling/scheduleClock';
import { mapScheduleBoardResponseToV2Snapshot, type ScheduleV2Snapshot } from '@/lib/scheduling/scheduleV2Snapshot';

export type SchedulePageSeed =
  | { initialScheduleMode: 'legacy'; initialV2Snapshot: null }
  | { initialScheduleMode: 'v2'; initialV2Snapshot: ScheduleV2Snapshot };

export async function loadSchedulePageSeed(): Promise<SchedulePageSeed> {
  try {
    const board = await loadScheduleBoardResponse({ today: resolveScheduleTodayYmd() });
    return {
      initialScheduleMode: 'v2',
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
