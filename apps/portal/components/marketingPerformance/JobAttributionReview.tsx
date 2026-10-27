'use client';
import { useState } from 'react';
import type { DesignerReport } from '@/lib/marketingPerformance/designerContract';
import type { HubReport } from '@/lib/marketingPerformance/hub';
import type { JobAttribution } from '@/lib/marketingPerformance/jobAttribution';
import { salesDesignerOption, type SalesDesigner } from '@/lib/marketingPerformance/salesDesigner';
import { Button } from '@/components/ui/foundation/FoundationControls';
import SalesDesignerAssignment, { type AssignmentClient } from './SalesDesignerAssignment';
import { Drawer } from './MarketingDrawer';
import styles from './DesignerPerformance.module.css';

export default function JobAttributionReview({ report, hub, attributions, designer, filterKey, onAssignment, assignmentClient, synthetic }: {
  report: DesignerReport | null; hub: HubReport | null; attributions: Map<string, JobAttribution>; designer: string; filterKey: string;
  onAssignment: (value: SalesDesigner) => void; assignmentClient?: AssignmentClient; synthetic: boolean;
}) {
  const [inspect, setInspect] = useState<{ report: DesignerReport; filterKey: string; page: number } | null>(null);
  const rows = [...attributions.values()].filter(value => !designer || value.designerKey === designer);
  const provisional = rows.filter(value => value.provisional).length;
  const active = inspect && inspect.report === report && inspect.filterKey === filterKey ? inspect : null;
  const projects = new Map(hub?.projects.map(project => [project.id, project]) ?? []);
  if (!report || !hub) return null;
  return <details><summary>Job attribution review · {rows.length} quoted or visit-linked jobs · {provisional} provisional</summary>
    <p className={styles.note}>Includes retained sent quotes and linked visit records, including lost jobs, within the project and person filters. Acceptance dates do not limit this review list. Suggestions assign responsibility only; they create no visits, dates or sales. Existing saved roles remain unchanged.</p>
    <Button variant="quiet" onClick={() => setInspect({ report, filterKey, page: 0 })}>Review {rows.length} job assignments</Button>
    <Drawer open={Boolean(active)} onClose={() => setInspect(null)} title="Job attribution review">
      {active && <div className={styles.records}><p>{rows.length} relevant jobs. {provisional} provisional assignments or suggestions. Change the person or record a confirmation reason to resolve an assumption.</p>
        <ul>{rows.slice(active.page * 15, (active.page + 1) * 15).map(value => <li key={value.projectId}>
          <strong>{projects.get(value.projectId)?.name ?? 'Linked project'}</strong>
          <p>{salesDesignerOption(value.designerKey)?.displayName} · {value.provisional ? value.persisted ? 'Provisional, saved' : 'Provisional suggestion, not saved' : 'Saved assignment'} · {projects.get(value.projectId)?.closedOutcome ?? projects.get(value.projectId)?.state ?? 'Outcome unavailable'}</p>
          <SalesDesignerAssignment value={value.saved} suggestion={value.persisted ? undefined : value} onChange={onAssignment} client={assignmentClient} readOnly={synthetic && !assignmentClient} />
          <a href={synthetic ? `/qa/marketing-performance-fixture/project?project=${value.projectId}&return=${encodeURIComponent(window.location.search)}` : `/staff/projects/proj_${value.projectId}?tab=quotes`} target="_blank" rel="noreferrer">Inspect this job and source evidence</a>
        </li>)}</ul>
        {!rows.length && <p>No relevant jobs match this selection.</p>}
        <div className={styles.pager}><Button disabled={!active.page} onClick={() => setInspect({ ...active, page: active.page - 1 })}>Previous</Button><span>Page {active.page + 1} of {Math.max(1, Math.ceil(rows.length / 15))}</span><Button disabled={(active.page + 1) * 15 >= rows.length} onClick={() => setInspect({ ...active, page: active.page + 1 })}>Next</Button></div>
      </div>}
    </Drawer>
  </details>;
}
