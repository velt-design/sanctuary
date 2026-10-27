import { aucklandDay } from './contract';
import { designerPerformance, visitIssueLabels } from './designer';
import type { DesignerReport, DesignerVisit } from './designerContract';
import { designerSales, type DesignerSaleJob } from './designerSales';

export const visitCoverageBuckets = [
  ['initial_win', 'Accepted initial job after a recorded original'],
  ['add_on_only', 'Add-on acceptance only'],
  ['outside_period', 'Recorded original outside visit dates'],
  ['needs_review', 'Linked visit needs checking'],
  ['no_record', 'No linked retained visit record'],
] as const;
export type VisitCoverageBucket = typeof visitCoverageBuckets[number][0];
export type VisitCoverageJob = {
  job: DesignerSaleJob;
  bucket: VisitCoverageBucket;
  reasons: string[];
  visits: DesignerVisit[];
  original: DesignerVisit | null;
};
type VisitPerformance = ReturnType<typeof designerPerformance>;

function reviewReasons(visits: DesignerVisit[], performance: VisitPerformance): string[] {
  const active = visits.filter(v => !v.removed && !v.withdrawn && v.kind !== 'excluded');
  if (!active.length) return ['Only removed, withdrawn or excluded visit records remain.'];
  const originals = active.filter(v => v.status === 'attended' && v.purpose === 'initial' && !v.cancelled);
  if (!originals.length) {
    return [active.some(v => v.status === 'attended' && !v.cancelled)
      ? 'Attendance is recorded, but no attended original sales visit is confirmed.'
      : 'No linked record confirms an attended original sales visit. A booking does not prove attendance.'];
  }
  const reasons = [...new Set(originals.flatMap(v => performance.issues.get(v.id) ?? []))];
  return reasons.length ? reasons.map(reason => visitIssueLabels[reason] ?? reason) : ['Original-visit evidence is not eligible for conversion.'];
}

/** Team sales reconciliation is deliberately independent of the selected visitor. */
export function siteVisitCoverage(report: DesignerReport, projectIds: Set<string> | null, allDates: boolean, performance: VisitPerformance) {
  const sales = designerSales(report, projectIds, '', allDates).total;
  const unavailable = !report.source.enabled ? 'Calendar history is withheld while the source is disabled.'
    : report.source.failed ? 'The latest calendar read failed. Missing-history counts are unavailable.'
    : !report.source.lastSuccess ? 'No successful calendar read is recorded.'
    : Date.parse(report.asOf) - Date.parse(report.source.lastSuccess) > 1800000 ? 'Calendar history needs a fresh read before checking missing records.'
    : null;
  const grouped = new Map<string, DesignerVisit[]>();
  for (const visit of report.visits) if (visit.projectId && (!projectIds || projectIds.has(visit.projectId))) {
    const visits = grouped.get(visit.projectId);
    if (visits) visits.push(visit); else grouped.set(visit.projectId, [visit]);
  }
  const originalByProject = new Map(performance.retainedOriginals.map(outcome => [outcome.visit.projectId!, outcome]));
  const jobs: VisitCoverageJob[] = unavailable ? [] : sales.goingAhead.map(job => {
    const visits = grouped.get(job.projectId) ?? [];
    const outcome = originalByProject.get(job.projectId);
    const original = outcome?.visit ?? null;
    if (!visits.length) return { job, visits, original, bucket: 'no_record', reasons: ['No visit is linked to this job in the available retained history. This does not establish that no visit occurred.'] };
    if (!original || !outcome) return { job, visits, original, bucket: 'needs_review', reasons: reviewReasons(visits, performance) };
    // These are acceptance-cohort differences, not missing-history failures.
    if (job.goingAhead.every(scope => scope.addOn)) return { job, visits, original, bucket: 'add_on_only', reasons: ['The selected acceptance period contains add-on work only. Add-ons do not count as a new job won from a visit.'] };
    if (original.day! < report.start || original.day! > report.end) return { job, visits, original, bucket: 'outside_period', reasons: [`The recorded original is dated ${original.day}, outside the selected visit dates ${report.start} to ${report.end}.`] };
    if (outcome.accepted.some(scope => job.goingAhead.some(selected => selected.id === scope.id))) return { job, visits, original, bucket: 'initial_win', reasons: ['A currently accepted initial scope in this acceptance cohort follows the qualifying recorded original visit.'] };
    return { job, visits, original, bucket: 'needs_review', reasons: ['The accepted initial scope has no verified acceptance date after the recorded original visit. Check acceptance timing; a sale alone does not establish visit conversion.'] };
  });
  const observedDays = report.visits.filter(v => v.day && v.day <= aucklandDay(new Date(report.asOf)) && (!projectIds || v.projectId && projectIds.has(v.projectId))).map(v => v.day!).sort();
  return { sales, jobs, unavailable, firstObservedDay: report.source.enabled ? observedDays[0] ?? null : null };
}
