import Link from 'next/link';
import type { QueueMode, WorkQueueItem } from '@/lib/dashboard/types';
import styles from '@/app/staff/projects/projects.module.css';
import WorkQueueTable from './WorkQueueTable';
import dash from '../dashboard.module.css';
import { projectsHref } from '@/lib/dashboard/links';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function WorkQueueCard(props: {
  mode: QueueMode;
  items: WorkQueueItem[];
  hrefToday: string;
  hrefNext7: string;
  hrefAllDue: string;
}) {
  const maxItems = 5;
  const visibleItems = props.items.slice(0, maxItems);
  const hasMore = props.items.length > maxItems;
  const viewAllHref = projectsHref({ nextActionDue: true });

  return (
    <section className={`${styles.section} ${dash.card} ${dash.cardCompact}`} aria-label="Work queue">
      <div className={`${styles.sectionHeader} ${dash.cardHeader}`}>
        <div>
          <h2 className={styles.sectionTitle}>Work Queue</h2>
          <div className={styles.muted} style={{ fontSize: 12 }}>
            Sorted by due date.
          </div>
        </div>
        <div className={styles.tabsPill}>
          <Link className={cx(styles.tabButton, props.mode === 'today' && styles.tabButtonActive)} href={props.hrefToday}>
            Today
          </Link>
          <Link className={cx(styles.tabButton, props.mode === 'next7' && styles.tabButtonActive)} href={props.hrefNext7}>
            Next 7 days
          </Link>
          <Link className={cx(styles.tabButton, props.mode === 'alldue' && styles.tabButtonActive)} href={props.hrefAllDue}>
            All due
          </Link>
        </div>
      </div>
      <div className={`${styles.sectionBody} ${dash.cardBody}`}>
        <WorkQueueTable items={visibleItems} />
        {hasMore ? (
          <div className={dash.flatListFooter}>
            <Link className={dash.flatRowLink} href={viewAllHref}>
              View all actions
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
