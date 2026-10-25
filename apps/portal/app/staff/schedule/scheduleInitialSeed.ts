import { ApiError } from '@/lib/repo/apiClient';
import type { SchedulePageSeed } from '@/lib/scheduling/serverSchedulePageSeed';

/** One request-owned server read, consumed only by its matching initial view. */
export function createScheduleInitialSeed(seed: Promise<SchedulePageSeed | null> | undefined, kind: 'board' | 'gantt') {
  let available = Boolean(seed);
  return {
    take(view: 'board' | 'gantt', today: string, range?: { rangeStart: string; rangeEnd: string }) {
      if (!available || view !== kind) return null;
      available = false;
      return Promise.resolve(seed).then(result => {
        if (result?.initialScheduleMode === 'legacy') {
          throw new ApiError('Schedule schema is not upgraded yet.', { status: 501, body: null });
        }
        if (result && (result.initialSeedKind !== view || result.today !== today ||
          (view === 'gantt' && (result.rangeStart !== range?.rangeStart || result.rangeEnd !== range?.rangeEnd)))) return null;
        return result?.initialV2Snapshot ?? null;
      });
    },
  };
}
