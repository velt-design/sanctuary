import Link from 'next/link';
import type { DashboardRecentActivityItem } from '@/lib/dashboard/types';
import { PORTAL_TIME_ZONE } from '@/lib/format/portalDateTime';
import { projectNoteAuthorDisplayName } from '@/lib/projectNotes/types';
import styles from '@/components/ui/surface/PortalSurface.module.css';
import dash from '../dashboard.module.css';

function authorLabel(item: DashboardRecentActivityItem): string {
  const resolved = projectNoteAuthorDisplayName({
    authorDisplayName: item.authorDisplayName,
    authorEmail: item.authorEmail,
  });
  if (resolved) return resolved;
  if (item.authorEmail?.trim()) return item.authorEmail.split('@')[0] || item.authorEmail;
  return 'Unknown';
}

function activityTimeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat('en-NZ', {
    timeZone: PORTAL_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export default function RecentActivityCard({ items }: { items: DashboardRecentActivityItem[] }) {
  return (
    <section className={`${styles.section} ${dash.card}`} aria-label="Recent Activity">
      <div className={`${styles.sectionHeader} ${dash.cardHeader}`}>
        <div>
          <h2 className={styles.sectionTitle}>Recent Activity</h2>
          <div className={styles.muted} style={{ fontSize: 12 }}>
            Latest project notes.
          </div>
        </div>
      </div>
      <div className={`${styles.sectionBody} ${dash.cardBody}`}>
        {items.length ? (
          <ul className={dash.activityList}>
            {items.map((item) => (
              <li key={item.id}>
                <Link href={item.href} className={dash.activityItem}>
                  <div className={dash.activityHeaderRow}>
                    <div className={dash.activityProject}>{item.projectName}</div>
                    <span className={dash.activityTime}>{activityTimeLabel(item.at)}</span>
                  </div>
                  <div className={dash.activityBody}>{item.body}</div>
                  <div className={dash.activityFooter}>
                    <span className={dash.activityKind}>Project note</span>
                    <span>by {authorLabel(item)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className={dash.emptyState}>No project notes yet.</div>
        )}
      </div>
    </section>
  );
}
