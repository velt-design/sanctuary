import Link from '@/components/navigation/PortalRouteLink';
import styles from '@/components/ui/surface/PortalSurface.module.css';
import { ProjectStageBadge } from '@/components/ui/foundation/SanctuaryStatus';
import {
  effectiveAssigneeLabel,
  queueDueLabel,
  queueEntryStage,
  type WorkQueueEntryView,
} from '@/components/projects/workQueue/workQueuePresentation';
import { normalizePipelineStageKey } from '@/lib/projects/pipelineDefinition';
import type { ProjectWorkQueueEntry } from '@/lib/projects/workItems/types';
import dash from '../dashboard.module.css';
import DashboardLoadingRows from './DashboardLoadingRows';

export default function ProjectWorkQueueCard({
  items,
  available,
  loading = false,
}: {
  items?: ProjectWorkQueueEntry[];
  available?: boolean;
  loading?: boolean;
}) {
  return (
    <section
      className={`${styles.section} ${dash.card} ${dash.queueCard}`}
      aria-label="Work Queue"
      aria-busy={loading}
      data-dashboard-card-state={loading ? 'loading' : 'ready'}
      data-portal-shell-region="dashboard-work-queue"
    >
      <div className={`${styles.sectionHeader} ${dash.cardHeader} ${dash.queueHeader}`}>
        <div>
          <h2 className={styles.sectionTitle}>Work Queue</h2>
          <div className={`${styles.muted} ${dash.cardSubheading}`}>One current obligation per active project.</div>
        </div>
        <Link className={dash.queueOpenLink} href="/staff/projects/work-queue" prefetch={false}>Open queue</Link>
      </div>
      <div className={`${styles.sectionBody} ${dash.cardBody}`}>
        {loading ? (
          <DashboardLoadingRows label="Updating project work..." rows={3} />
        ) : !available ? (
          <div className={dash.emptyState}>The Work Queue is temporarily unavailable.</div>
        ) : items?.length ? (
          <ul className={dash.queueList}>
            {items.map((rawEntry) => {
              const entry = rawEntry as WorkQueueEntryView;
              const stage = normalizePipelineStageKey(queueEntryStage(entry));
              return (
                <li key={entry.projectId}>
                  <Link className={dash.queueRow} href={entry.href} prefetch={false}>
                    <span className={dash.queueAction}>{entry.title}</span>
                    <span className={dash.queueProject}>
                      <strong>{entry.projectName}</strong>
                      <small>{entry.reason}</small>
                    </span>
                    {stage ? <ProjectStageBadge stage={stage} compact /> : <span />}
                    <span className={dash.queueAccountability}>
                      <span className={dash.queueOwner}>Owner: {effectiveAssigneeLabel(entry, [])}</span>
                      <span className={dash.queueDue} data-state={entry.group}>When: {queueDueLabel(entry)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className={dash.emptyState}>No project work needs attention.</div>
        )}
      </div>
    </section>
  );
}
