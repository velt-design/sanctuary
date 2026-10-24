import { createScheduleOpsFixture } from '../schedule-ops-fixture/fixtures';
import type { ScheduleV2Snapshot } from '@/lib/scheduling/scheduleV2Snapshot';
import { resolveScheduleTodayYmd } from '@/lib/scheduling/scheduleClock';
import { addDaysYmd } from '@/lib/scheduling/date';
import { WORK_HOURS_PER_DAY } from '@/lib/scheduling/duration';

export function progressiveScheduleSnapshot(): ScheduleV2Snapshot {
  const source = createScheduleOpsFixture('standard'), today = resolveScheduleTodayYmd();
  const offset = Math.round((Date.parse(today) - Date.parse(source.today)) / 86400000);
  const shift = (day: string | null | undefined) => day ? addDaysYmd(day, offset) : day;
  return {
    generatedAt: new Date().toISOString(), installers: source.installers,
    projects: [...source.projectsById.values()],
    scheduleItems: [...source.scheduleItemById.values()].map(item => ({ ...item,
      forecastStart: shift(item.forecastStart), forecastEndExclusive: shift(item.forecastEndExclusive),
      plannedStart: shift(item.plannedStart), plannedWeekStart: shift(item.plannedWeekStart),
    })),
    unscheduledJobs: source.unscheduledJobs.map(job => ({projectId:job.projectId, estimateId:job.estimateId,
      projectName:job.projectName,customerName:job.customerName,siteAddress:job.siteAddress,status:job.status,durationDays:job.durationHours/WORK_HOURS_PER_DAY})),
    conflicts: [], nextAvailableByInstallerId: Object.fromEntries([...source.nextAvailableByInstallerId].map(([id,day])=>[id,shift(day)!])),
    holidays: [], closures: [],
  };
}
