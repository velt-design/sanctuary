'use client';
import { INITIAL_PRODUCT_SELECTION } from './productSelection';
import { useProductExampleEstimate } from './useProductExampleEstimate';
import type { ProductDesignType } from './productDesigns';
import styles from './product-hub.module.css';
import { formatEstimate } from '../../lib/estimateDisplay';

export default function ProductExamplePrice({ type, compact = false }: { type: ProductDesignType; compact?: boolean }) {
  const { estimate, complete, retry } = useProductExampleEstimate(type, INITIAL_PRODUCT_SELECTION);
  return <div className={`${styles.price} ${compact ? styles.compactPrice : ''}`} aria-live="polite" aria-atomic="true">
    <span>{complete && estimate.draft ? 'Draft example estimate' : compact ? '6 × 3 m installed estimate' : 'Example installed estimate'}</span>
    <strong data-priced={complete}>{complete ? formatEstimate(estimate.amount!) : 'amount' in estimate ? 'Tailored quote' : estimate.message}</strong>
    {(!compact || !complete) && <small>{complete ? 'NZD · Including GST' : 'See product details or enquire for an estimate.'}</small>}
    {(!compact || (complete && estimate.draft)) && <small className={styles.priceStatus}>{complete && estimate.draft ? 'Review pricing only — not a published offer.' : 'Subject to site confirmation.'}</small>}
    {'retry' in estimate && estimate.retry && <button onClick={retry}>Retry estimate</button>}
  </div>;
}
