import type { Estimate } from '@/lib/types/estimate';
import type { SchedulingIssue } from '@/lib/types/scheduling';

export const WORK_HOURS_PER_DAY = 9;
export const HALF_DAY_HOURS = WORK_HOURS_PER_DAY / 2; // 4.5
export const FALLBACK_CREW_HOUR_RATE_EX_GST = 110;

function roundTo2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function roundUpToHalfDayHours(hours: number): number {
  const h = Number.isFinite(hours) ? hours : 0;
  if (h <= 0) return 0;
  return roundTo2(Math.ceil(h / HALF_DAY_HOURS) * HALF_DAY_HOURS);
}

export function deriveCrewMinutesFromEstimate(estimate: Estimate): { crewMinutes: number | null; issues: SchedulingIssue[] } {
  const issues: SchedulingIssue[] = [];

  const fromTotals = (estimate.outputs as any)?.install?.totals?.crew_minutes;
  if (typeof fromTotals === 'number' && Number.isFinite(fromTotals) && fromTotals > 0) {
    return { crewMinutes: roundTo2(fromTotals), issues };
  }

  const actions = (estimate.outputs as any)?.install?.actions;
  if (Array.isArray(actions) && actions.length) {
    const sum = actions.reduce((acc: number, a: any) => acc + (typeof a?.minutes === 'number' && Number.isFinite(a.minutes) ? a.minutes : 0), 0);
    if (sum > 0) {
      issues.push({
        level: 'warning',
        estimateId: estimate.id,
        projectId: estimate.projectId,
        message: 'Crew minutes missing from estimate totals; derived from install actions list.',
      });
      return { crewMinutes: roundTo2(sum), issues };
    }
  }

  issues.push({
    level: 'warning',
    estimateId: estimate.id,
    projectId: estimate.projectId,
    message: 'Crew minutes missing from estimate; will use fallback duration.',
  });
  return { crewMinutes: null, issues };
}

export function deriveDurationHoursFromEstimate(estimate: Estimate): { durationHours: number; crewHours: number; issues: SchedulingIssue[] } {
  const issues: SchedulingIssue[] = [];

  const { crewMinutes, issues: minutesIssues } = deriveCrewMinutesFromEstimate(estimate);
  issues.push(...minutesIssues);

  let crewHours = 0;
  if (typeof crewMinutes === 'number' && Number.isFinite(crewMinutes) && crewMinutes > 0) {
    crewHours = crewMinutes / 60;
  } else {
    const payout = (estimate.outputs as any)?.install?.totals?.install_ex_gst;
    if (typeof payout === 'number' && Number.isFinite(payout) && payout > 0) {
      crewHours = payout / FALLBACK_CREW_HOUR_RATE_EX_GST;
      issues.push({
        level: 'warning',
        estimateId: estimate.id,
        projectId: estimate.projectId,
        message: `Derived crew hours from install payout using $${FALLBACK_CREW_HOUR_RATE_EX_GST}/h fallback rate.`,
      });
    } else {
      crewHours = WORK_HOURS_PER_DAY;
      issues.push({
        level: 'warning',
        estimateId: estimate.id,
        projectId: estimate.projectId,
        message: 'Missing install minutes and payout; defaulting duration to 1 day (9h).',
      });
    }
  }

  const rounded = roundUpToHalfDayHours(crewHours);
  if (rounded <= 0) {
    issues.push({
      level: 'warning',
      estimateId: estimate.id,
      projectId: estimate.projectId,
      message: 'Duration rounded to 0; defaulting to 1 day (9h).',
    });
    return { durationHours: WORK_HOURS_PER_DAY, crewHours, issues };
  }

  return { durationHours: rounded, crewHours: roundTo2(crewHours), issues };
}

