import type {ReactNode} from 'react';
import PortalIndexLink from '@/components/navigation/PortalIndexLink';
import styles from '@/components/ui/surface/PortalSurface.module.css';
import dash from '../dashboard.module.css';

export function ProjectWorkQueueSurface({rows,hasItems=false,available=false,pending=false}:{rows?:ReactNode;hasItems?:boolean;available?:boolean;pending?:boolean}) {
  return (
    <section className={`${styles.section} ${dash.card} ${dash.queueCard}`} aria-label="Work Queue">
      <div className={`${styles.sectionHeader} ${dash.cardHeader} ${dash.queueHeader}`}>
        <div>
          <h2 className={styles.sectionTitle}>Work Queue</h2>
          <div className={`${styles.muted} ${dash.cardSubheading}`}>One current obligation per active project.</div>
        </div>
        <PortalIndexLink className={dash.queueOpenLink} href="/staff/projects/work-queue">Open queue</PortalIndexLink>
      </div>
      <div className={`${styles.sectionBody} ${dash.cardBody}`}>
        {pending?<div className={dash.emptyState} role="status">Reading the work queue…</div>:!available ? (
          <div className={dash.emptyState}>The Work Queue is temporarily unavailable.</div>
        ) : hasItems ? (
          rows
        ) : (
          <div className={dash.emptyState}>No project work needs attention.</div>
        )}
      </div>
    </section>
  );
}


export function RecentActivitySurface({rows,hasItems=false,known=false,pending=false}:{rows?:ReactNode;hasItems?:boolean;known?:boolean;pending?:boolean}) {
  return (
    <section className={`${styles.section} ${dash.card} ${dash.activityCard}`} aria-label="Recent Activity">
      <div className={`${styles.sectionHeader} ${dash.cardHeader}`}>
        <div>
          <h2 className={styles.sectionTitle}>Recent Activity</h2>
          <div className={`${styles.muted} ${dash.cardSubheading}`}>Latest project notes.</div>
        </div>
      </div>
      <div className={`${styles.sectionBody} ${dash.cardBody}`}>
        {!known?<div className={dash.emptyState} role={pending?'status':undefined}>{pending?'Reading recent activity…':'This section is unavailable.'}</div>:hasItems ? (
          rows
        ) : (
          <div className={dash.emptyState}>No project notes yet.</div>
        )}
      </div>
    </section>
  );
}


export function RecentEstimatesSurface({rows,hasItems=false,known=false,available=false,pending=false}:{rows?:ReactNode;hasItems?:boolean;known?:boolean;available?:boolean;pending?:boolean}) {
  return (
    <section className={`${styles.section} ${dash.card} ${dash.estimatesCard}`} aria-label="Recent Estimates">
      <div className={`${styles.sectionHeader} ${dash.cardHeader}`}>
        <div>
          <h2 className={styles.sectionTitle}>Recent Estimates</h2>
          <div className={`${styles.muted} ${dash.cardSubheading}`}>Latest saved draft estimates.</div>
        </div>
      </div>
      <div className={`${styles.sectionBody} ${dash.cardBody}`}>
        {!known?<div className={dash.emptyState} role={pending?'status':undefined}>{pending?'Reading saved estimates…':'This section is unavailable.'}</div>:hasItems ? (
          rows
        ) : <div className={dash.emptyState}>No saved draft estimates yet.</div>}
      </div>
    </section>
  );
}
