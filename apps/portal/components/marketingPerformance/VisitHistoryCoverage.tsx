'use client';
import { useMemo, useState } from 'react';
import { visitDateEstimate,visitDateEstimateLabel } from '@/lib/siteVisits/visitDateEstimate';
import { Button } from '@/components/ui/foundation/FoundationControls';
import { Drawer } from './MarketingDrawer';
import { assumedOriginalPurpose,designerPerformance } from '@/lib/marketingPerformance/designer';
import type { DesignerReport, DesignerVisit } from '@/lib/marketingPerformance/designerContract';
import { money, type HubReport } from '@/lib/marketingPerformance/hub';
import { salesDesignerOption } from '@/lib/marketingPerformance/salesDesigner';
import { siteVisitCoverage, visitCoverageBuckets, type VisitCoverageBucket } from '@/lib/marketingPerformance/siteVisitCoverage';
import styles from './VisitHistoryCoverage.module.css';
import type { JobAttribution } from '@/lib/marketingPerformance/jobAttribution';

const person = (id: string) => salesDesignerOption(id)?.displayName ?? 'Unrecognised staff identity';
const stamp = (value: string | null) => value ? new Date(value).toLocaleDateString('en-NZ', { timeZone: 'Pacific/Auckland' }) : 'Date not recorded';
const purpose = (visit: DesignerVisit) => ({ initial: 'Original', measurement: 'Return measurement', follow_up: 'Follow-up', site_visit: 'Purpose not confirmed' })[visit.purpose ?? 'site_visit'];

export default function VisitHistoryCoverage({ report, performance, projectIds, hub, allDates, selectionKey, selectedPerson, pending, synthetic, attributions }: {
  report: DesignerReport | null;
  performance: ReturnType<typeof designerPerformance> | null;
  projectIds: Set<string> | null;
  hub: HubReport | null;
  allDates: boolean;
  selectionKey: string;
  selectedPerson: boolean;
  pending: boolean;
  synthetic: boolean;
  attributions?: Map<string,JobAttribution>;
}) {
  const [inspect, setInspect] = useState<{ bucket: VisitCoverageBucket | 'all'; report: DesignerReport; selectionKey: string; page: number } | null>(null);
  const result = useMemo(() => report && performance && !pending ? siteVisitCoverage(report, projectIds, allDates, performance) : null, [report, performance, projectIds, allDates, pending]);
  const active = inspect && result && !result.unavailable && inspect.report === report && inspect.selectionKey === selectionKey ? inspect : null;
  const jobs = active ? result!.jobs.filter(item => active.bucket === 'all' || item.bucket === active.bucket) : [];
  const projectNames = new Map(hub?.projects.map(project => [project.id, project.name]) ?? []);
  const period = allDates ? 'All recorded acceptance dates' : report ? `Accepted ${report.start} to ${report.end}` : 'Selected acceptance period';
  const open = (bucket: VisitCoverageBucket | 'all') => { if (report) setInspect({ bucket, report, selectionKey, page: 0 }); };
  const projectLink = (id: string) => synthetic ? `/qa/marketing-performance-fixture/project?project=${id}&return=${encodeURIComponent(window.location.search)}` : `/staff/site-visits?view=history&project=${id}`;
  const visitLink = (visit: DesignerVisit) => synthetic ? projectLink(visit.projectId!) : `/staff/site-visits?view=history&visit=${visit.id}&project=${visit.projectId}`;

  return <div className={styles.coverage} aria-label="Visit history coverage">
    <p className={styles.qualification}><strong>Recorded history and approved assumptions.</strong> Close rates describe eligible recorded originals, not each person’s full-period performance. Assumed original purposes are marked in the figures and records. {result?.firstObservedDay && <>Earliest dated visit available: {result.firstObservedDay}. </>}Gaps may remain, including visits that never became jobs.</p>
    <details>
      <summary>Why sales and visit totals differ{result ? ` · Team: ${result.sales.goingAhead.length} net accepted jobs` : ''}</summary>
      <p>{period}. Project filters apply. This team check includes every designer{selectedPerson ? ', even while one person is selected above' : ''}; it does not use a person’s sales assignment as evidence of attendance.</p>
      <p>Accepted sales include base and add-on work. Visit results need an eligible original in the selected visit dates and an initial scope accepted afterward. These are different populations, so their totals need not match.</p>
      {!result ? <p role={pending ? 'status' : undefined}>{pending ? 'Reading the complete sales and visit evidence…' : 'Coverage evidence unavailable. Retry the report above.'}</p>
        : result.unavailable ? <p>{result.unavailable} No missing-record counts are shown.</p>
        : <>
          <div className={styles.buckets}>{visitCoverageBuckets.map(([key, label]) => {
            const count = result.jobs.filter(item => item.bucket === key).length;
            return count > 0 ? <button key={key} onClick={() => open(key)} aria-label={`Team coverage: ${label}, ${count} jobs`}><span>{label}</span><strong>{count}</strong></button> : null;
          })}</div>
          <Button variant="quiet" disabled={!result.jobs.length} onClick={() => open('all')}>Inspect all {result.jobs.length} net accepted jobs</Button>
          {!result.jobs.length && <p>No net accepted jobs match this acceptance period and project selection.</p>}
          <p className={styles.note}>Each job appears once above. “No linked record” means missing evidence, not that no visit happened. These buckets do not measure the completeness of all visits.</p>
        </>}
    </details>
    <Drawer open={Boolean(active)} onClose={() => setInspect(null)} title={`Team sales and visit evidence${active && active.bucket !== 'all' ? `: ${visitCoverageBuckets.find(([key]) => key === active.bucket)?.[1]}` : ''}`}>
      {active && result && <div className={styles.records}>
        <p>{period}. {jobs.length} distinct jobs. Current visit and acceptance evidence as of {stamp(report!.asOf)}.</p>
        <ol>{jobs.slice(active.page * 15, (active.page + 1) * 15).map(item => <li key={item.job.projectId}>
          <h3>{projectNames.get(item.job.projectId) ?? 'Accepted project'}</h3>
          <p className={styles.reason}>{item.reasons.join(' ')}</p>
          <p>Saved sales designer: {item.job.designerKey ? person(item.job.designerKey) : 'Unassigned'}. Original visitor: {item.original ? item.original.staff.map(person).join(', ') : 'Not established'}.</p>
          {attributions?.get(item.job.projectId)?.provisional&&<p>Report attribution: {person(attributions.get(item.job.projectId)!.designerKey)} (provisional, {attributions.get(item.job.projectId)!.persisted?'saved':'not saved'}). {attributions.get(item.job.projectId)!.basis}</p>}
          <h4>Accepted work in this sales selection</h4>
          <ul>{item.job.goingAhead.map(scope => <li key={scope.id}>{scope.reference} · {scope.addOn ? 'Add-on' : 'Initial scope'} · Accepted {stamp(scope.lastAcceptedAt)} · {scope.valueCents === null ? 'Value unavailable' : money(scope.valueCents)} including GST</li>)}</ul>
          <h4>Linked retained visit evidence</h4>
          {!item.visits.length ? <p>No linked record is available. Review the project’s original evidence before recording history.</p> : <ul>{item.visits.map(visit => <li key={visit.id}>
            <span>{visit.day ?? 'Date not recorded'}{visitDateEstimateLabel(visitDateEstimate(visit))} · {purpose(visit)} · {visit.staff.map(person).join(', ') || 'Attendee not established'} · {visit.status === 'attended' ? 'Attendance recorded' : visit.status ?? 'Attendance not recorded'} · {visit.origin === 'history' ? 'Recorded history' : 'Retained Outlook record'}{visit.removed ? ' · Removed from source' : ''}{visit.withdrawn ? ' · Withdrawn' : ''}{visit.kind === 'excluded' ? ' · Excluded' : ''}{visit.changed ? ' · Source changed' : ''}{visit.questions ? ' · Questions unresolved' : ''}</span>
            {assumedOriginalPurpose(visit)&&<p>Original purpose assumed with owner approval; review later.</p>}{visit.basis&&<p>Visit basis: {visit.basis}</p>}
            <a href={visitLink(visit)} target="_blank" rel="noreferrer">Review this visit</a>
          </li>)}</ul>}
          <a href={projectLink(item.job.projectId)} target="_blank" rel="noreferrer">Review project visit history</a>
          <a href={synthetic ? projectLink(item.job.projectId) : `/staff/projects/proj_${item.job.projectId}?tab=quotes`} target="_blank" rel="noreferrer">Inspect accepted quotes</a>
        </li>)}</ol>
        <div className={styles.pager}><Button disabled={!active.page} onClick={() => setInspect({ ...active, page: active.page - 1 })}>Previous</Button><span>Page {active.page + 1} of {Math.max(1, Math.ceil(jobs.length / 15))}</span><Button disabled={(active.page + 1) * 15 >= jobs.length} onClick={() => setInspect({ ...active, page: active.page + 1 })}>Next</Button></div>
        <p className={styles.note}>Review links open a new tab and retain these report filters. Keep known attendance and dates; label any approved assumptions and refresh after corrections.</p>
      </div>}
    </Drawer>
  </div>;
}
