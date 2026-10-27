import { aucklandDay } from './contract';
import { designerPerformance } from './designer';
import { isTestSalesProject } from './designerSales';
import type { DesignerReport, DesignerVisit } from './designerContract';
import type { HubReport } from './hub';
import { salesDesignerOption, unassignedDesigner, type SalesDesigner } from './salesDesigner';

export const provisionalAssignmentPrefix = 'Provisional reporting assignment:';
export const isProvisionalAssignment = (value: SalesDesigner) => Boolean(value.basis?.startsWith(provisionalAssignmentPrefix));
export type JobAttribution = {
  projectId: string;
  designerKey: NonNullable<SalesDesigner['designerKey']>;
  saved: SalesDesigner;
  provisional: boolean;
  persisted: boolean;
  basis: string;
};

/** Responsibility suggestions never create attendance, dates, acceptance or money. */
export function jobAttributions(report: DesignerReport, hub: HubReport, projectIds: Set<string> | null = null) {
  const saved = new Map(report.assignments.map(value => [value.projectId, value]));
  const performance = designerPerformance(report, projectIds);
  const originals = new Map(performance.retainedOriginals.map(outcome => [outcome.visit.projectId!, outcome.visit]));
  const relevant = new Set(report.scopes.filter(scope => scope.firstSentAt || scope.undatedSend || scope.everAccepted).map(scope => scope.projectId));
  const visits = new Map<string, DesignerVisit[]>();
  const today = aucklandDay(new Date(report.asOf));
  for (const visit of report.visits) {
    if (!visit.projectId || visit.removed || visit.withdrawn || visit.kind === 'excluded') continue;
    relevant.add(visit.projectId);
    const list = visits.get(visit.projectId) ?? []; list.push(visit); visits.set(visit.projectId, list);
  }
  const result = new Map<string, JobAttribution>();
  for (const project of hub.projects) {
    if (!relevant.has(project.id) || project.knownTest || isTestSalesProject(report, project.id) || projectIds && !projectIds.has(project.id)) continue;
    const current = saved.get(project.id) ?? unassignedDesigner(project.id);
    // A saved sales role can intentionally differ from the original visitor.
    if (current.designerKey) {
      result.set(project.id, { projectId: project.id, designerKey: current.designerKey, saved: current, provisional: isProvisionalAssignment(current), persisted: true, basis: current.basis ?? 'Saved sales assignment; attendance is separate.' });
      continue;
    }
    const original = originals.get(project.id);
    const usable = report.source.enabled && !report.source.failed && report.source.lastSuccess && Date.parse(report.asOf) - Date.parse(report.source.lastSuccess) <= 1800000;
    const candidates = usable ? (visits.get(project.id) ?? []).filter(visit => !visit.cancelled && visit.status !== 'not_attended' && visit.status !== 'cancelled' && !visit.changed && !visit.duplicate && visit.kind !== 'review' && !visit.questions && !(performance.issues.get(visit.id)?.length) && visit.day && visit.day <= today && visit.staff.some(id => salesDesignerOption(id))) : [];
    candidates.sort((a, b) => Number(b.status === 'attended') - Number(a.status === 'attended') || (a.day ?? '').localeCompare(b.day ?? '') || a.id.localeCompare(b.id));
    const candidate = usable ? original ?? candidates[0] : null;
    const visitor = candidate?.staff.map(id => salesDesignerOption(id)).filter(option => option !== null && option !== undefined).sort((a, b) => a.key.localeCompare(b.key))[0];
    const owner = salesDesignerOption(project.owner);
    const designerKey = visitor?.key ?? owner?.key ?? 'jordan';
    const reason = visitor && candidate
      ? `${original ? 'Recorded original visitor' : candidate.status === 'attended' ? 'Linked recorded attendee' : 'Linked calendar booking candidate'} ${visitor.displayName}; visit ${candidate.id}${candidate.staff.length > 1 ? '; joint record, single responsibility suggested' : ''}. Review role before confirming.`
      : owner ? `Current project owner ${owner.displayName} suggested for responsibility only; actual visitor is not established.`
        : 'Jordan suggested as review owner because no stronger usable person evidence is available; actual visitor is not established.';
    result.set(project.id, { projectId: project.id, designerKey, saved: current, provisional: true, persisted: false, basis: `${provisionalAssignmentPrefix} ${reason}` });
  }
  return result;
}

export function withJobAttributions(report: DesignerReport, attributions: Map<string, JobAttribution>): DesignerReport {
  return { ...report, assignments: [...report.assignments.filter(value => !attributions.has(value.projectId)), ...[...attributions.values()].map(value => ({ ...value.saved, designerKey: value.designerKey, basis: value.basis }))] };
}
