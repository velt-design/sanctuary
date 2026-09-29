import { INITIAL_PRODUCT_SELECTION, type ProductSelection } from './productSelection';
import { comparisonSizeKey, type ProductComparisonTable } from './productComparisonTable';
import { type ProductDesignType } from './productDesigns';
import styles from './product-hub.module.css';
import { formatComparisonEstimate } from '../../lib/estimateDisplay';

export default function ProductComparisonPrice({ type, selection = INITIAL_PRODUCT_SELECTION, table }: { type: ProductDesignType; selection?: ProductSelection; table: ProductComparisonTable }) {
  const amount = table.status === 'priced' ? table.amounts[comparisonSizeKey(selection.widthMm, selection.projectionMm)]?.[type] : undefined;
  const label = `${selection.widthMm / 1000} × ${selection.projectionMm / 1000} m`;
  return <div className={styles.comparisonPrice} aria-live="polite" aria-atomic="true" data-example-width={selection.widthMm} data-example-projection={selection.projectionMm}>
    <div className={styles.priceLabel}><span>{label}</span><span>Including installation</span></div>
    <div className={styles.priceResult}>
      {amount !== undefined ? <strong data-priced="true"><span className={styles.approximateSymbol} aria-hidden="true">≈ </span><span className={styles.srOnly}>Approximately </span>{formatComparisonEstimate(amount)}</strong>
        : <span className={styles.priceMessage}>{table.status === 'loading' ? 'Updating estimate' : 'Estimate unavailable'}</span>}
    </div>
  </div>;
}
