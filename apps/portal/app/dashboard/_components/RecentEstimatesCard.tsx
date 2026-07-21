import Link from 'next/link';
import styles from '@/components/ui/surface/PortalSurface.module.css';
import { Badge } from '@/components/ui/foundation/FoundationSurfaces';
import { PORTAL_TIME_ZONE } from '@/lib/format/portalDateTime';
import type { DashboardRecentEstimate } from '@/lib/dashboard/types';
import dash from '../dashboard.module.css';

const nzd = new Intl.NumberFormat('en-NZ', {
  style: 'currency',
  currency: 'NZD',
  maximumFractionDigits: 0,
});

function updatedLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat('en-NZ', {
    timeZone: PORTAL_TIME_ZONE,
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export default function RecentEstimatesCard({ items }: { items: DashboardRecentEstimate[] }) {
  return (
    <section className={`${styles.section} ${dash.card}`} aria-label="Recent Estimates">
      <div className={`${styles.sectionHeader} ${dash.cardHeader}`}>
        <div>
          <h2 className={styles.sectionTitle}>Recent Estimates</h2>
          <div className={`${styles.muted} ${dash.cardSubheading}`}>Latest saved draft estimates.</div>
        </div>
      </div>
      <div className={`${styles.sectionBody} ${dash.cardBody}`}>
        {items.length ? (
          <ul className={dash.operationalList}>
            {items.map((item) => (
              <li key={item.estimateId}>
                <Link className={`${dash.operationalRow} ${dash.estimateRow}`} href={item.href}>
                  <span className={dash.rowPrimary}>
                    <strong>{item.projectName}</strong>
                    <small><Badge>{item.versionLabel}</Badge> <span>Draft</span></small>
                  </span>
                  <span className={dash.estimateMeta}>
                    <strong>{item.customerPriceIncGst === null ? 'Price unavailable' : nzd.format(item.customerPriceIncGst)}</strong>
                    <time dateTime={item.updatedAt}>{updatedLabel(item.updatedAt)}</time>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <div className={dash.emptyState}>No saved draft estimates yet.</div>}
      </div>
    </section>
  );
}
