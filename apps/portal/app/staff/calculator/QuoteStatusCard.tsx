import type {
  CalculatorReadinessBlockedBy,
  CalculatorReadinessSummary,
} from './calculatorReadinessSummary';
import styles from './QuoteStatusCard.module.css';

type StatusLevel = 'ok' | 'review' | 'block';

export type StatusItem = {
  id: string;
  label: string;
  level: StatusLevel;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
  blockedBy?: CalculatorReadinessBlockedBy;
  causeCount?: number;
};

type QuoteStatusCardProps = {
  items: StatusItem[];
  readinessSummary: CalculatorReadinessSummary;
};

function readinessMeta(summary: CalculatorReadinessSummary): string {
  if (summary.blockedCheckCount > 0) {
    return `${summary.blockedCheckCount} readiness check${summary.blockedCheckCount === 1 ? '' : 's'} blocked`;
  }
  if (summary.reviewCount > 0) {
    return `${summary.reviewCount} to review`;
  }
  return 'Ready';
}

function readinessMetaClass(summary: CalculatorReadinessSummary): string {
  if (summary.tone === 'blocked') return styles.metaBlocked;
  if (summary.tone === 'waiting') return styles.metaWaiting;
  if (summary.tone === 'review') return styles.metaReview;
  return styles.metaReady;
}

function dependencyLabel(item: StatusItem): string | null {
  if (item.blockedBy === 'inputs') return 'Blocked by input issues';
  if (item.level === 'block' && item.causeCount === 0) return 'Waiting for a current result';
  return null;
}

function statusDotClass(item: StatusItem): string {
  if (item.level === 'ok') return styles.dotOk;
  if (item.level === 'review') return styles.dotReview;
  if (item.causeCount === 0) return styles.dotWaiting;
  return styles.dotBlock;
}

export default function QuoteStatusCard({
  items,
  readinessSummary,
}: QuoteStatusCardProps) {
  return (
    <section className={styles.card} aria-label="Quote status">
      <div className={styles.header}>
        <h2 className={styles.title}>Quote status</h2>
        <div className={readinessMetaClass(readinessSummary)}>
          {readinessMeta(readinessSummary)}
        </div>
      </div>
      <p className={styles.summary}>{readinessSummary.label}</p>

      <ul className={styles.list}>
        {items.map((item) => {
          const dependency = dependencyLabel(item);
          return (
            <li key={item.id} className={styles.row} data-status-item={item.id}>
              <span className={statusDotClass(item)} aria-hidden="true" />
              <div className={styles.main}>
                <div className={styles.label}>{item.label}</div>
                {dependency ? <div className={styles.dependency}>{dependency}</div> : null}
                {item.detail ? <div className={styles.detail}>{item.detail}</div> : null}
              </div>
              {item.onAction && item.actionLabel ? (
                <button type="button" className={styles.action} onClick={item.onAction}>
                  {item.actionLabel}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
