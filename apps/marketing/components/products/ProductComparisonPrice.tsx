'use client';
import { INITIAL_PRODUCT_SELECTION, type ProductSelection } from './productSelection';
import { useProductExampleEstimate } from './useProductExampleEstimate';
import { PRODUCT_FORM_CHOICES, type ProductDesignType } from './productDesigns';
import styles from './product-hub.module.css';
import { formatComparisonEstimate } from '../../lib/estimateDisplay';

export default function ProductComparisonPrice({ type, selection = INITIAL_PRODUCT_SELECTION }: { type: ProductDesignType; selection?: ProductSelection }) {
  const { estimate, complete, retry } = useProductExampleEstimate(type, selection);
  const label = `${selection.widthMm / 1000} × ${selection.projectionMm / 1000} m`;
  const title = PRODUCT_FORM_CHOICES.find(choice => choice.type === type)!.title;
  return <div className={styles.comparisonPrice} aria-live="polite" aria-atomic="true" data-example-width={selection.widthMm}>
    <div className={styles.priceLabel}><span>{label} example</span><span>Including installation</span></div>
    <div className={styles.priceResult}>
      {complete ? <strong data-priced="true"><span className={styles.approximateSymbol} aria-hidden="true">≈ </span><span className={styles.srOnly}>Approximately </span>{formatComparisonEstimate(estimate.amount!)}</strong>
        : <span className={styles.priceMessage}>{'amount' in estimate ? 'Tailored quote' : estimate.message}</span>}
      {'retry' in estimate && estimate.retry && <button type="button" aria-label={`Retry ${title} ${label} estimate`} onClick={retry}>Retry estimate</button>}
      {complete && estimate.draft && <small>Draft estimate · not a published offer.</small>}
    </div>
  </div>;
}
