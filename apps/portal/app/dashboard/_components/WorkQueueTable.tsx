import Link from 'next/link';
import type { WorkQueueItem } from '@/lib/dashboard/types';
import { humanDueLabel, todayNzYYYYMMDD, formatShortDateTime } from '@/lib/dashboard/format';
import { dashboardHref, projectDetailHref, projectsHref } from '@/lib/dashboard/links';
import SetNextActionButton from './SetNextActionButton';
import styles from '@/components/ui/surface/PortalSurface.module.css';
import dash from '../dashboard.module.css';
import { NEXT_ACTION_TYPE_ORDER, nextActionTypeLabel, PROJECT_STATUS_ORDER, projectStatusLabel } from '@/lib/types/project';

function labelForAction(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const match = NEXT_ACTION_TYPE_ORDER.find((t) => t === normalized);
  return match ? nextActionTypeLabel(match) : normalized;
}

function labelForStatus(value?: string | null): string {
  if (!value) return '—';
  const match = PROJECT_STATUS_ORDER.find((s) => s === value);
  return match ? projectStatusLabel(match) : value;
}

export default function WorkQueueTable({ items }: { items: WorkQueueItem[] }) {
  const today = todayNzYYYYMMDD();

  if (!items.length) {
    return (
      <div className={dash.workQueueEmpty}>
        <div style={{ fontWeight: 600 }}>No actions due in this range.</div>
        <div className={dash.workQueueLinks}>
          <Link className={dash.workQueueLink} href={dashboardHref('next7')}>
            View next 7 days
          </Link>
          <Link className={dash.workQueueLink} href={projectsHref({ status: 'NEW' })}>
            View new leads
          </Link>
          <Link className={dash.workQueueLink} href={projectsHref({})}>
            Open projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.tableWrap} ${styles.tableWrapScrollX}`}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Project</th>
            <th>Stage</th>
            <th>Next action</th>
            <th>Due</th>
            <th>Last activity</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const dueLabel = humanDueLabel(it.nextActionDueDate, today);
            const actionLabel = labelForAction(it.nextActionLabel);
            return (
              <tr key={it.projectId} className={dash.workQueueRow}>
                <td>
                  <Link className={styles.link} href={projectDetailHref(it.projectId)}>
                    {it.projectName}
                  </Link>
                  <div className={styles.muted} style={{ fontSize: 12 }}>
                    {it.clientName ?? '—'}
                  </div>
                </td>
                <td>
                  <span className={styles.statusPill}>{labelForStatus(String(it.status ?? ''))}</span>
                </td>
                <td>
                  {actionLabel ? (
                    <div>{actionLabel}</div>
                  ) : (
                    <SetNextActionButton projectId={it.projectId} currentAction={it.nextActionLabel} currentDue={it.nextActionDueDate} />
                  )}
                </td>
                <td>
                  <div>{it.nextActionDueDate ?? '—'}</div>
                  {dueLabel ? (
                    <span className={styles.dueBadge} style={{ marginLeft: 0 }}>
                      {dueLabel}
                    </span>
                  ) : null}
                </td>
                <td className={styles.muted}>{formatShortDateTime(it.lastActivityAt)}</td>
                <td>
                  <Link className={styles.link} href={projectDetailHref(it.projectId)}>
                    Open
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
