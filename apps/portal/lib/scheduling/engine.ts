import type { Estimate } from '@/lib/types/estimate';
import type { Installer, ScheduleItem, ScheduledBar, SchedulingIssue } from '@/lib/types/scheduling';
import { addWorkHours, diffDaysYmd, nextWorkdayYmd, todayYmd, type WorkCursor } from './date';
import { deriveDurationHoursFromEstimate, WORK_HOURS_PER_DAY } from './duration';

export type ScheduleProjectLike = {
  projectName?: string;
  name?: string;
  status?: string;
};

function safeProjectName(project: ScheduleProjectLike | null | undefined): string {
  return project?.projectName ?? project?.name ?? 'Untitled project';
}

function safeProjectStatus(project: ScheduleProjectLike | null | undefined): string {
  return project?.status ?? 'NEW';
}

function compareCursor(a: WorkCursor, b: WorkCursor): number {
  // Comparator: negative if a is before b.
  const day = -diffDaysYmd(a.date, b.date);
  if (day !== 0) return day;
  return a.hour - b.hour;
}

function normalizeStartOverride(override: string): string {
  return nextWorkdayYmd(override);
}

function normalizeScheduleStatus(status: unknown): string {
  if (typeof status !== 'string') return 'TENTATIVE';
  const s = status.trim().toUpperCase();
  if (s === 'TENTATIVE' || s === 'CONFIRMED' || s === 'IN_PROGRESS' || s === 'COMPLETED') return s;
  return 'TENTATIVE';
}

function isStartedOrPast(ymd: string, today: string): boolean {
  if (!ymd) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  // diffDaysYmd(a,b) = b - a, so this is true when ymd <= today.
  return diffDaysYmd(ymd, today) >= 0;
}

export type ScheduleBuildResult = {
  bars: ScheduledBar[];
  issues: SchedulingIssue[];
};

export function buildScheduleBars(input: {
  today?: string; // YYYY-MM-DD
  installers: Installer[];
  scheduleItems: ScheduleItem[];
  projectsById: Map<string, ScheduleProjectLike>;
  estimatesById: Map<string, Estimate>;
}): ScheduleBuildResult {
  const issues: SchedulingIssue[] = [];
  const bars: ScheduledBar[] = [];
  const today = input.today ?? todayYmd();

  const installers = input.installers
    .slice()
    .filter((i) => i.active)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  for (const installer of installers) {
    const laneStart = normalizeStartOverride(installer.availableFrom ?? today);
    let cursor: WorkCursor = { date: laneStart, hour: 0 };

    const laneItems = input.scheduleItems
      .filter((i) => i.installerId === installer.id)
      .slice()
      .sort((a, b) => a.sortIndex - b.sortIndex || a.updatedAt.localeCompare(b.updatedAt));

    for (const item of laneItems) {
      const project = input.projectsById.get(item.projectId) ?? null;
      const estimate = input.estimatesById.get(item.estimateId) ?? null;

      const rawStatus = normalizeScheduleStatus(item.scheduleStatus ?? (item.locked ? 'CONFIRMED' : undefined));
      const started = Boolean(item.actualStartDate && isStartedOrPast(item.actualStartDate, today)) || Boolean(item.startDateOverride && isStartedOrPast(item.startDateOverride, today));
      const effectiveStatus = rawStatus === 'COMPLETED' ? 'COMPLETED' : started ? 'IN_PROGRESS' : rawStatus === 'CONFIRMED' ? 'CONFIRMED' : 'TENTATIVE';

      let durationHours = WORK_HOURS_PER_DAY;
      if (typeof item.durationHoursOverride === 'number' && Number.isFinite(item.durationHoursOverride) && item.durationHoursOverride > 0) {
        durationHours = item.durationHoursOverride;
      } else if (estimate) {
        const derived = deriveDurationHoursFromEstimate(estimate);
        durationHours = derived.durationHours;
        for (const issue of derived.issues) {
          issues.push({ ...issue, scheduleItemId: item.id });
        }
      } else {
        issues.push({
          level: 'error',
          scheduleItemId: item.id,
          projectId: item.projectId,
          estimateId: item.estimateId,
          message: 'Estimate not found for scheduled job; defaulting duration to 1 day (9h).',
        });
      }

      let startCursor: WorkCursor = cursor;

      if (item.startDateOverride && /^\d{4}-\d{2}-\d{2}$/.test(item.startDateOverride)) {
        const overrideDate = normalizeStartOverride(item.startDateOverride);
        const candidate: WorkCursor = { date: overrideDate, hour: 0 };
        if (compareCursor(candidate, cursor) < 0) {
          if (effectiveStatus === 'IN_PROGRESS') {
            // "Assume started": once a job has reached its planned start date, never push it forward.
            startCursor = candidate;
          } else if (effectiveStatus === 'CONFIRMED') {
            // Confirmed jobs are locked: do not auto-shift, but surface a conflict warning.
            startCursor = candidate;
            issues.push({
              level: 'warning',
              scheduleItemId: item.id,
              projectId: item.projectId,
              estimateId: item.estimateId,
              message: `Confirmed start ${overrideDate} is before lane availability; review for overlap.`,
            });
          } else {
            issues.push({
              level: 'warning',
              scheduleItemId: item.id,
              projectId: item.projectId,
              estimateId: item.estimateId,
              message: `Start override ${overrideDate} is before lane availability; ignored.`,
            });
          }
        } else {
          startCursor = candidate;
        }
      } else if (item.startDateOverride) {
        issues.push({
          level: 'warning',
          scheduleItemId: item.id,
          projectId: item.projectId,
          estimateId: item.estimateId,
          message: `Invalid start date override '${item.startDateOverride}'; ignored.`,
        });
      }

      const { endCursor, endDateInclusive } = addWorkHours(startCursor.date, startCursor.hour, durationHours);

      bars.push({
        scheduleItemId: item.id,
        installerId: installer.id,
        projectId: item.projectId,
        estimateId: item.estimateId,
        projectName: safeProjectName(project),
        status: safeProjectStatus(project),
        startDate: startCursor.date,
        endDate: endDateInclusive,
        durationHours,
      });

      // Never allow the cursor to move backwards (e.g. when rendering historical jobs).
      cursor = compareCursor(endCursor, cursor) < 0 ? cursor : endCursor;
    }
  }

  return { bars, issues };
}
