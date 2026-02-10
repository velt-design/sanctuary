import type { SiteVisitCalendarItem } from '@/lib/types/siteVisits';
import styles from './schedule.module.css';

function waitingLabel(createdAt: string | null): string {
  if (!createdAt) return 'Waiting —';
  const created = new Date(createdAt);
  if (!Number.isFinite(created.getTime())) return 'Waiting —';
  const ageDays = Math.floor((Date.now() - created.getTime()) / 86400000);
  if (!Number.isFinite(ageDays) || ageDays < 0) return 'Waiting —';
  return `Waiting ${ageDays}d`;
}

export default function UnscheduledSiteVisitCard({ item, onBook }: { item: SiteVisitCalendarItem; onBook: () => void }) {
  const projectName = (item.project.name || '').trim() || item.projectId || 'Untitled project';
  const region = (item.project.region || '').trim();
  const title = region ? `${projectName} — ${region}` : projectName;
  const address = (item.project.siteAddress || '').trim();
  const phone = (item.contact.phone || '').trim();
  const waiting = waitingLabel(item.createdAt ?? null);
  const tier = item.priorityTier ?? null;
  const tierClass = tier === 1 ? styles.siteVisitCardTier1 : tier === 2 ? styles.siteVisitCardTier2 : styles.siteVisitCardTierNone;

  return (
    <div
      className={`${styles.siteVisitCard} ${tierClass}`}
      role="button"
      tabIndex={0}
      onClick={onBook}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onBook();
        }
      }}
    >
      <div className={styles.siteVisitCardTop}>
        <div className={styles.siteVisitCardText}>
          <div className={styles.siteVisitCardTitle} title={title}>
            {title}
          </div>
          {address ? (
            <div className={styles.siteVisitCardAddress} title={address}>
              {address}
            </div>
          ) : null}
        </div>
        <div className={styles.siteVisitCardActions}>
          {tier ? <div className={tier === 1 ? styles.siteVisitTierPill1 : styles.siteVisitTierPill2}>{tier === 1 ? 'T1' : 'T2'}</div> : null}
          <button
            type="button"
            className={styles.siteVisitCardBook}
            onClick={(e) => {
              e.stopPropagation();
              onBook();
            }}
          >
            Book
          </button>
        </div>
      </div>
      <div className={styles.siteVisitCardMetaRow}>
        <div className={styles.siteVisitCardMeta} title={phone}>
          {phone}
        </div>
        <div className={styles.siteVisitCardMeta}>{waiting}</div>
      </div>
    </div>
  );
}
