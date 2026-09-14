import type { Installer, ScheduleItem } from '@/lib/types/scheduling';
import { recomputeCrewSchedule, type ScheduledJob } from '@/lib/scheduling/recompute';
import { buildWorkingDayIndex } from '@/lib/scheduling/workingDays';

// The preview shares the scheduling engine, but owns only in-memory sample rows.
export function recomputePreviewSchedule(
  lanes: Map<string, ScheduleItem[]>, installers: Installer[], today: string,
) {
  const laneItems = new Map<string, ScheduleItem[]>();
  const scheduleItemById = new Map<string, ScheduleItem>();
  const nextAvailableByInstallerId = new Map<string, string>();
  for (const crew of installers) {
    const rows = lanes.get(crew.id) ?? [];
    const jobsById = new Map<string, ScheduledJob>(rows.map((item) => [item.id, {
      id: item.id, jobId: item.projectId, crewId: crew.id,
      mode: item.mode ?? 'floating', status: item.jobStatus,
      forecastStart: item.forecastStart, forecastEndExclusive: item.forecastEndExclusive,
      forecastDurationDays: item.forecastDurationDays ?? 1,
      actualStart: item.actualStartDate, actualFinish: item.actualEndDate,
    }]));
    const result = recomputeCrewSchedule({
      crew: { id: crew.id, region: crew.calendarRegion ?? 'Auckland', anchorDate: crew.baseAvailableDate ?? today },
      items: rows.map((item, position) => ({ id: item.id, crewId: crew.id, itemType: 'job', jobId: item.id, position })),
      jobsById, downtimesById: new Map(), today, calendar: buildWorkingDayIndex(),
    });
    const forecasts = new Map(result.job_updates.map((update) => [update.id, update]));
    laneItems.set(crew.id, rows.map((item, sortIndex) => {
      const forecast = forecasts.get(item.id)!;
      const updated = { ...item, sortIndex, installerId: crew.id,
        forecastStart: forecast.forecast_start, forecastEndExclusive: forecast.forecast_end_exclusive,
        forecastDurationDays: forecast.forecast_duration_days };
      scheduleItemById.set(item.id, updated);
      return updated;
    }));
    nextAvailableByInstallerId.set(crew.id, result.next_available_date);
  }
  return { laneItems, scheduleItemById, nextAvailableByInstallerId };
}
