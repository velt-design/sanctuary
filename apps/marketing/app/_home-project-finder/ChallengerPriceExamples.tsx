'use client';
import { INITIAL_PRODUCT_SELECTION } from '../../components/products/productSelection';
import { PRODUCT_FORM_CHOICES, type ProductDesignType } from '../../components/products/productDesigns';
import { useProductExampleEstimate } from '../../components/products/useProductExampleEstimate';
import { formatEstimate } from '../../lib/estimateDisplay';
import styles from './challengerPriceExamples.module.css';

export const CHALLENGER_EXAMPLE_SELECTIONS = [3000, 6000, 9000].map(widthMm => ({ ...INITIAL_PRODUCT_SELECTION, widthMm }));

/** Homepage comparison precision only; the approved amount and detailed pricing stay unchanged. */
export function formatChallengerExampleAmount(amount: number) {
  return formatEstimate(Math.round(amount / 100) * 100);
}

function PriceRow({ type, selection }: { type: ProductDesignType; selection: typeof INITIAL_PRODUCT_SELECTION }) {
  const { estimate, complete, retry } = useProductExampleEstimate(type, selection);
  const label = `${selection.widthMm / 1000} × ${selection.projectionMm / 1000} m`;
  const roofline = PRODUCT_FORM_CHOICES.find(choice => choice.type === type)!.title;
  return <div className={styles.row} data-price-example={selection.widthMm}>
    <dt>{label}</dt>
    <dd aria-live="polite" aria-atomic="true">
      {complete ? <strong data-priced="true"><span className={styles.approximateSymbol} aria-hidden="true">≈ </span><span className={styles.approximateWord}>Approximately </span>{formatChallengerExampleAmount(estimate.amount!)}</strong>
        : 'retry' in estimate && estimate.retry
          ? <button type="button" aria-label={`${roofline} ${label} estimate unavailable. Retry`} onClick={retry}>Unavailable<br /><span>Retry</span></button>
          : <span className={styles.status}>{'amount' in estimate || estimate.message === 'Your design needs a tailored quote.' ? 'Tailored quote' : 'Updating…'}</span>}
      {complete && estimate.draft && <small>Draft · review only</small>}
    </dd>
  </div>;
}

export default function ChallengerPriceExamples({ type }: { type: ProductDesignType }) {
  return <dl className={styles.examples} aria-label="Example sizes and installed estimates">
    {CHALLENGER_EXAMPLE_SELECTIONS.map(selection => <PriceRow key={selection.widthMm} type={type} selection={selection} />)}
  </dl>;
}
