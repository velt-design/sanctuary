import Link from 'next/link';
import styles from '@/components/ui/surface/PortalSurface.module.css';
import { ProjectStageBadge } from '@/components/ui/foundation/SanctuaryStatus';
import { PORTAL_TIME_ZONE } from '@/lib/format/portalDateTime';
import { projectDetailHref } from '@/lib/dashboard/links';
import { normalizePipelineStageKey } from '@/lib/projects/pipelineDefinition';
import type { QueueMode, WorkQueueItem } from '@/lib/dashboard/types';
import dash from '../dashboard.module.css';

const QUEUE_MODES: Array<{ value: QueueMode; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'next7', label: 'Next 7 days' },
  { value: 'alldue', label: 'All due' },
];

function ymdInAuckland(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PORTAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function dueLabel(value: string | null | undefined, today: string): { label: string; state: 'overdue' | 'today' | 'future' } {
  if (!value) return { label: 'No due date', state: 'future' };
  if (value < today) return { label: `Overdue · ${formatDueDate(value)}`, state: 'overdue' };
  if (value === today) return { label: 'Due today', state: 'today' };
  return { label: formatDueDate(value), state: 'future' };
}

function formatDueDate(value: string): string {
  const date = new Date(`${value}T12:00:00+12:00`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat('en-NZ', { timeZone: PORTAL_TIME_ZONE, day: 'numeric', month: 'short' }).format(date);
}

export default function ProjectActionQueueCard({
  items,
  queueMode,
  updatedAtIso,
}: {
  items: WorkQueueItem[];
  queueMode: QueueMode;
  updatedAtIso: string;
}) {
  const today = ymdInAuckland(updatedAtIso);
  return (
    <section className={`${styles.section} ${dash.card} ${dash.queueCard}`} aria-label="Project Action Queue">
      <div className={`${styles.sectionHeader} ${dash.cardHeader} ${dash.queueHeader}`}>
        <div>
          <h2 className={styles.sectionTitle}>Project Action Queue</h2>
          <div className={`${styles.muted} ${dash.cardSubheading}`}>Command Centre actions, earliest due first.</div>
        </div>
        <nav className={dash.queueFilters} aria-label="Project action queue range">
          {QUEUE_MODES.map((mode) => (
            <Link
              key={mode.value}
              href={mode.value === 'today' ? '/dashboard' : `/dashboard?queue=${mode.value}`}
              aria-current={queueMode === mode.value ? 'page' : undefined}
            >
              {mode.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className={`${styles.sectionBody} ${dash.cardBody}`}>
        {items.length ? (
          <ul className={dash.queueList}>
            {items.map((item) => {
              const due = dueLabel(item.nextActionDueDate, today);
              const stage = normalizePipelineStageKey(item.status);
              return (
                <li key={item.projectId}>
                  <Link className={dash.queueRow} href={projectDetailHref(item.projectId)}>
                    <span className={dash.queueAction}>{item.nextActionLabel?.trim() || 'Project action'}</span>
                    <span className={dash.queueProject}>
                      <strong>{item.projectName}</strong>
                      {item.clientName ? <small>{item.clientName}</small> : null}
                    </span>
                    {stage ? <ProjectStageBadge stage={stage} compact /> : <span />}
                    <span className={dash.queueDue} data-state={due.state}>{due.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className={dash.emptyState}>No project actions are due in this range.</div>
        )}
      </div>
    </section>
  );
}
