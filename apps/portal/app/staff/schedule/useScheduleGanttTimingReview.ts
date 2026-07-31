'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ScheduleItem } from '@/lib/types/scheduling';
import type { ScheduleGanttBar } from './ScheduleGanttModel';

export type ScheduleGanttTimingRequest = {
  mode: 'move' | 'resize';
  scheduleItemId: string;
  itemUpdatedAt: string;
  projectName: string;
  identityDetail: string | null;
  crewName: string;
  currentStart: string;
  currentEnd: string;
  currentDurationDays: number;
  requestedStart: string;
  requestedDurationDays: number;
};

function isScheduleGanttTimingRequestStale(input: {
  request: ScheduleGanttTimingRequest | null;
  scheduleItemById: ReadonlyMap<string, ScheduleItem>;
  scheduleBarById: ReadonlyMap<string, ScheduleGanttBar>;
}): boolean {
  const { request, scheduleItemById, scheduleBarById } = input;
  if (!request) return false;
  const item = scheduleItemById.get(request.scheduleItemId) ?? null;
  const bar = scheduleBarById.get(request.scheduleItemId) ?? null;
  return (
    !item ||
    !bar ||
    item.updatedAt !== request.itemUpdatedAt ||
    bar.startDate !== request.currentStart ||
    bar.endDate !== request.currentEnd
  );
}

export function useScheduleGanttTimingReview(input: {
  scheduleItemById: ReadonlyMap<string, ScheduleItem>;
  scheduleBarById: ReadonlyMap<string, ScheduleGanttBar>;
  onMovePin: (scheduleItemId: string, requestedStart: string, durationDays: number) => void;
  onResizePin: (scheduleItemId: string, requestedStart: string, durationDays: number) => void;
}) {
  const [request, setRequest] = useState<ScheduleGanttTimingRequest | null>(null);
  const stale = useMemo(
    () => isScheduleGanttTimingRequestStale({
      request,
      scheduleItemById: input.scheduleItemById,
      scheduleBarById: input.scheduleBarById,
    }),
    [input.scheduleBarById, input.scheduleItemById, request],
  );
  const cancel = useCallback(() => setRequest(null), []);
  const confirm = useCallback(() => {
    if (!request || stale) return;
    setRequest(null);
    const callback = request.mode === 'move' ? input.onMovePin : input.onResizePin;
    callback(request.scheduleItemId, request.requestedStart, request.requestedDurationDays);
  }, [input.onMovePin, input.onResizePin, request, stale]);

  return {
    request,
    stale,
    open: setRequest,
    cancel,
    confirm,
  };
}
