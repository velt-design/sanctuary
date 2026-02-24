import styles from './CalculatorGrid.module.css';

export type StatusLevel = 'ok' | 'review' | 'block';

export type StatusItem = {
  id: string;
  label: string;
  level: StatusLevel;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function QuoteStatusCard({ items }: { items: StatusItem[] }) {
  const blockers = items.filter((item) => item.level === 'block').length;
  const reviews = items.filter((item) => item.level === 'review').length;

  return (
    <section className={styles.previewCard} aria-label="Quote status">
      <div className={styles.statusHeader}>
        <h2 className={styles.previewCardTitle} style={{ margin: 0 }}>
          Quote status
        </h2>
        <div className={styles.statusMeta}>
          {blockers ? <span className={styles.statusBlock}>Blockers: {blockers}</span> : null}
          {!blockers && reviews ? <span className={styles.statusReview}>Review: {reviews}</span> : null}
          {!blockers && !reviews ? <span className={styles.statusOk}>Ready</span> : null}
        </div>
      </div>

      <ul className={styles.statusList}>
        {items.map((item) => (
          <li key={item.id} className={styles.statusRow}>
            <span
              className={
                item.level === 'ok' ? styles.statusDotOk : item.level === 'review' ? styles.statusDotReview : styles.statusDotBlock
              }
            />
            <div className={styles.statusMain}>
              <div className={styles.statusLabel}>{item.label}</div>
              {item.detail ? <div className={styles.statusDetail}>{item.detail}</div> : null}
            </div>
            {item.onAction && item.actionLabel ? (
              <button type="button" className={styles.statusAction} onClick={item.onAction}>
                {item.actionLabel}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

