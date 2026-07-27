import CalculatorPricingSummary, {
  type CalculatorPricingSummaryProps,
} from './CalculatorPricingSummary';
import styles from './CalculatorStackedResultActions.module.css';

type CalculatorStackedResultActionsProps = {
  pricingSummary: CalculatorPricingSummaryProps;
  onViewResults: () => void;
  onReviewIssues: () => void;
};

export default function CalculatorStackedResultActions({
  pricingSummary,
  onViewResults,
  onReviewIssues,
}: CalculatorStackedResultActionsProps) {
  return (
    <section
      className={styles.summaryActions}
      aria-label="Result shortcuts"
      data-calculator-stacked-result-actions
    >
      <CalculatorPricingSummary {...pricingSummary} variant="compact" />
      <div className={styles.actionRow}>
        <button type="button" className={styles.primaryAction} onClick={onViewResults}>
          View results
        </button>
        {pricingSummary.issuesCount > 0 ? (
          <button type="button" className={styles.secondaryAction} onClick={onReviewIssues}>
            Review issues
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function CalculatorStackedBackAction({
  onBackToConfiguration,
}: {
  onBackToConfiguration: () => void;
}) {
  return (
    <div className={styles.backAction} data-calculator-stacked-back-action>
      <button type="button" className={styles.secondaryAction} onClick={onBackToConfiguration}>
        Back to configuration
      </button>
    </div>
  );
}
