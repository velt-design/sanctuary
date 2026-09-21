'use client';
import { useMemo, useState } from 'react';
import { useConfiguratorPrice } from '../configurator-prototype/useConfiguratorPrice';
import { useReviewPrice } from '../configurator-prototype/useReviewPrice';
import { enquiryEstimate } from '../../app/design-enquiry/enquiryEstimate';
import { INITIAL_PRODUCT_SELECTION, productSelectionDraft } from './productSelection';
import type { ProductDesignType } from './productDesigns';
import styles from './product-hub.module.css';
import { formatEstimate } from '../../lib/estimateDisplay';

export default function ProductExamplePrice({ type, compact = false }: { type: ProductDesignType; compact?: boolean }) {
  const draft = useMemo(() => productSelectionDraft(INITIAL_PRODUCT_SELECTION, type).draft, [type]);
  const [attempt, setAttempt] = useState(0);
  const { price, retry } = useConfiguratorPrice(draft, true);
  const review = useReviewPrice(draft.input, draft.roof, true, attempt);
  const estimate = enquiryEstimate(price, review, process.env.NODE_ENV === 'development');
  const complete = 'amount' in estimate && !estimate.excluded?.length;
  return <div className={`${styles.price} ${compact ? styles.compactPrice : ''}`} aria-live="polite" aria-atomic="true">
    <span>{complete && estimate.draft ? 'Draft example estimate' : compact ? '6 × 3 m installed estimate' : 'Example installed estimate'}</span>
    <strong data-priced={complete}>{complete ? formatEstimate(estimate.amount!) : 'amount' in estimate ? 'Tailored quote' : estimate.message}</strong>
    {(!compact || !complete) && <small>{complete ? 'NZD · Including GST' : 'See product details or enquire for an estimate.'}</small>}
    {(!compact || (complete && estimate.draft)) && <small className={styles.priceStatus}>{complete && estimate.draft ? 'Review pricing only — not a published offer.' : 'Subject to site confirmation.'}</small>}
    {'retry' in estimate && estimate.retry && <button onClick={() => { retry(); setAttempt(n => n + 1); }}>Retry estimate</button>}
  </div>;
}
