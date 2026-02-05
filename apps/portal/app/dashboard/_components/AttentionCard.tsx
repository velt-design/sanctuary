import Link from 'next/link';
import type { AttentionItem } from '@/lib/dashboard/types';
import styles from '@/app/staff/projects/projects.module.css';
import dash from '../dashboard.module.css';
import { dashboardHref } from '@/lib/dashboard/links';

function severityBarClass(key: AttentionItem['key']) {
  switch (key) {
    case 'overdue':
      return dash.attentionIndicatorHigh;
    case 'email_failures':
      return dash.attentionIndicatorLow;
    default:
      return dash.attentionIndicatorMedium;
  }
}

function Count({ n }: { n: number }) {
  if (n > 0) {
    return <span className={dash.attentionCountBadge}>{n}</span>;
  }
  return <span className={dash.attentionCountZero}>0</span>;
}

export default function AttentionCard({ items }: { items: AttentionItem[] }) {
  const ORDER: AttentionItem['key'][] = [
    'overdue',
    'due_today',
    'unscheduled_approved',
    'site_visits_to_book',
    'quotes_to_send',
    'email_failures',
  ];
  const orderIndex = new Map(ORDER.map((key, idx) => [key, idx]));
  const visibleItems = items
    .filter((item) => (item.count ?? 0) > 0)
    .sort((a, b) => (orderIndex.get(a.key) ?? 999) - (orderIndex.get(b.key) ?? 999));

  return (
    <section className={`${styles.section} ${dash.card}`} aria-label="Attention">
      <div className={`${styles.sectionHeader} ${dash.cardHeader}`}>
        <div className={dash.attentionHeader}>
          <h2 className={styles.sectionTitle}>Attention</h2>
          <div className={dash.attentionIntro}>Urgent items requiring action.</div>
        </div>
      </div>
      <div className={`${styles.sectionBody} ${dash.cardBody}`}>
        {visibleItems.length === 0 ? (
          <div className={dash.attentionAllClear}>
            <div>All clear. No urgent actions.</div>
            <div className={dash.attentionActions}>
              <Link className={dash.attentionActionLink} href={dashboardHref('next7')}>
                View next 7 days
              </Link>
            </div>
          </div>
        ) : (
          <ul className={dash.attentionList}>
            {visibleItems.map((item) => (
              <li key={item.key}>
                <Link className={dash.attentionRow} href={item.href} aria-label={item.label}>
                  <span className={`${dash.attentionIndicator} ${severityBarClass(item.key)}`} aria-hidden="true" />
                  <div className={dash.attentionRowMain}>
                    <div className={dash.attentionRowLabel}>{item.label}</div>
                    {item.helperText ? <div className={dash.attentionRowHelper}>{item.helperText}</div> : null}
                  </div>
                  <Count n={item.count ?? 0} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
