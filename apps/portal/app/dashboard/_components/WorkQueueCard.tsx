import Link from 'next/link';
import type { QueueMode, WorkQueueItem } from '@/lib/dashboard/types';
import styles from '@/app/staff/projects/projects.module.css';
import WorkQueueTable from './WorkQueueTable';

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
  return (
    <section className={styles.section} aria-label="Work queue">
      <div className={styles.sectionHeader}>
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
      <div className={styles.sectionBody} style={{ paddingTop: 8 }}>
        <WorkQueueTable items={props.items} />
      </div>
    </section>
  );
}
