import Link from '@/components/navigation/PortalRouteLink';
import type { DashboardRecentActivityItem } from '@/lib/dashboard/types';
import { PORTAL_TIME_ZONE } from '@/lib/format/portalDateTime';
import { projectNoteAuthorDisplayName } from '@/lib/projectNotes/types';
import styles from '@/components/ui/surface/PortalSurface.module.css';
import dash from '../dashboard.module.css';
import { Badge } from '@/components/ui/foundation/FoundationSurfaces';
import DashboardLoadingRows from './DashboardLoadingRows';

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

export default function RecentActivityCard({
  items,
  loading = false,
}: {
  items?: DashboardRecentActivityItem[];
  loading?: boolean;
}) {
  return (
    <section
      className={`${styles.section} ${dash.card} ${dash.activityCard}`}
      aria-label="Recent Activity"
      aria-busy={loading}
      data-dashboard-card-state={loading ? 'loading' : 'ready'}
      data-portal-shell-region="dashboard-recent-activity"
    >
      <div className={`${styles.sectionHeader} ${dash.cardHeader}`}>
        <div>
          <h2 className={styles.sectionTitle}>Recent Activity</h2>
          <div className={`${styles.muted} ${dash.cardSubheading}`}>Latest project notes.</div>
        </div>
      </div>
      <div className={`${styles.sectionBody} ${dash.cardBody}`}>
        {loading ? (
          <DashboardLoadingRows label="Updating recent activity..." rows={4} />
        ) : items?.length ? (
          <ul className={dash.activityList}>
            {items.slice(0, 6).map((item) => (
              <li key={item.id}>
                <Link href={item.href} prefetch={false} className={dash.activityItem}>
                  <div className={dash.activityHeaderRow}>
                    <Badge tone="success" edge className={dash.activityTypePill}>Project note</Badge>
                    <span className={dash.activityTime}>{activityTimeLabel(item.at)}</span>
                  </div>
                  <div className={dash.activityProject}>{item.projectName}</div>
                  <div className={dash.activityBody}>{item.body}</div>
                  <div className={dash.activityFooter}>Added by {authorLabel(item)}</div>
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
