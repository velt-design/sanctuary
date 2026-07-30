import Link from 'next/link';
import styles from '@/components/ui/surface/PortalSurface.module.css';
import { ProjectStageBadge } from '@/components/ui/foundation/SanctuaryStatus';
import {
  queueDueLabel,
  queueEntryStage,
  type WorkQueueEntryView,
} from '@/components/projects/workQueue/workQueuePresentation';
import { normalizePipelineStageKey } from '@/lib/projects/pipelineDefinition';
import type { ProjectWorkQueueEntry } from '@/lib/projects/workItems/types';
import dash from '../dashboard.module.css';

export default function ProjectWorkQueueCard({
  items,
  available,
}: {
  items: ProjectWorkQueueEntry[];
  available: boolean;
}) {
  return (
    <section className={`${styles.section} ${dash.card} ${dash.queueCard}`} aria-label="Work Queue">
      <div className={`${styles.sectionHeader} ${dash.cardHeader} ${dash.queueHeader}`}>
        <div>
          <h2 className={styles.sectionTitle}>Work Queue</h2>
          <div className={`${styles.muted} ${dash.cardSubheading}`}>One current obligation per V2 project.</div>
        </div>
        <Link className={dash.queueOpenLink} href="/staff/projects/work-queue">Open queue</Link>
      </div>
      <div className={`${styles.sectionBody} ${dash.cardBody}`}>
        {!available ? (
          <div className={dash.emptyState}>The V2 Work Queue is temporarily unavailable.</div>
        ) : items.length ? (
          <ul className={dash.queueList}>
            {items.map((rawEntry) => {
              const entry = rawEntry as WorkQueueEntryView;
              const stage = normalizePipelineStageKey(queueEntryStage(entry));
              return (
                <li key={entry.projectId}>
                  <Link className={dash.queueRow} href={entry.href}>
                    <span className={dash.queueAction}>{entry.title}</span>
                    <span className={dash.queueProject}>
                      <strong>{entry.projectName}</strong>
                      <small>{entry.reason}</small>
                    </span>
                    {stage ? <ProjectStageBadge stage={stage} compact /> : <span />}
                    <span className={dash.queueDue} data-state={entry.group}>{queueDueLabel(entry)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className={dash.emptyState}>No V2 project work needs attention.</div>
        )}
      </div>
    </section>
  );
}
