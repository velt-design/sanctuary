import type { ProjectCommandStaffSummary } from '@/lib/projects/commandCentre/types';
import { Badge, EmptyState } from '@/components/ui/foundation';
import ProjectWorkQueueRow from './ProjectWorkQueueRow.client';
import {
  WORK_QUEUE_GROUPS,
  type WorkQueueEntryView,
} from './workQueuePresentation';
import styles from './ProjectWorkQueue.module.css';

export default function ProjectWorkQueueList({
  entries,
  staff,
  host,
}: {
  entries: WorkQueueEntryView[];
  staff: ProjectCommandStaffSummary[];
  host: string;
}) {
  if (!entries.length) {
    return (
      <EmptyState
        title="No current project work"
        description="Waiting, closed, archived, and far-future projects stay out of the operational queue."
      />
    );
  }

  return (
    <div className={styles.groups}>
      {WORK_QUEUE_GROUPS.map((group) => {
        const items = entries.filter((entry) => entry.group === group.key);
        if (!items.length) return null;
        const headingId = `work-queue-${group.key}`;
        return (
          <section className={styles.group} key={group.key} aria-labelledby={headingId}>
            <header className={styles.groupHeader}>
              <div>
                <h2 id={headingId}>{group.label}</h2>
                <p>{group.description}</p>
              </div>
              <Badge tone={group.key === 'overdue' || group.key === 'blocked' ? 'warning' : 'neutral'}>
                {items.length}
              </Badge>
            </header>
            <ul className={styles.rows}>
              {items.map((entry) => (
                <ProjectWorkQueueRow
                  key={entry.projectId}
                  entry={entry}
                  host={host}
                  staff={staff}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
