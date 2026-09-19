import type { ReviewPrice } from '../../lib/configuratorReviewPrice';
import { Fragment, type ReactNode } from 'react';
import styles from './prototype.module.css';
export const reviewMoney = (n: number) => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(n);
export default function ReviewPriceDisplay({ value, expanded = false, afterSummary }: { value: ReviewPrice | null; expanded?: boolean; afterSummary?:ReactNode }) {
  if (!value) return <><p className={styles.priceValue}>Updating estimate…</p><Fragment key="review-actions">{afterSummary}</Fragment></>;
  if (value.status === 'custom') return <><p className={styles.priceValue}>Your design needs a tailored quote.</p><Fragment key="review-actions">{afterSummary}</Fragment></>;
  if (value.status !== 'priced') return <><p>Price preview unavailable. Try adjusting your design.</p><Fragment key="review-actions">{afterSummary}</Fragment></>;
  const Breakdown = expanded ? 'section' : 'details';
  return <>
    <p className={styles.eyebrow}>{expanded ? 'DRAFT PRICE' : 'DRAFT PRICE · OWNER REVIEW'}</p>
    <p className={styles.priceValue}>{reviewMoney(value.amount)}</p>
    <p className={styles.small}>Including GST · {value.excluded.length ? 'Pergola subtotal' : 'Pergola estimate'}</p>
    <Fragment key="review-actions">{afterSummary}</Fragment>
    {value.excluded.length > 0 && <p><strong>Not included yet:</strong> {value.excluded.join(', ')}. These need separate pricing.</p>}
    {value.breakdown?.some(line=>line.provisional) && <p className={styles.small}>Includes provisional accessory allowances for your review.</p>}
    {expanded && <p className={styles.small}>{value.basis}. This is a review estimate, not a published quote.</p>}
    {value.breakdown && <Breakdown aria-label={expanded ? 'Your price breakdown' : undefined}>
      {expanded ? <h3>Your price breakdown</h3> : <summary>See price breakdown · including GST</summary>}
      <dl>{value.breakdown.map((line,index)=><div key={index} style={{padding:'12px 0',borderBottom:'1px solid currentColor'}}>
        <dt style={{display:'flex',justifyContent:'space-between',gap:16}}><span>{line.label}{line.provisional?' · provisional':''}</span><strong>{reviewMoney(line.amount)}</strong></dt>
        <dd className={styles.small} style={{margin:'6px 0 0'}}>{expanded ? <details><summary>Allowance details</summary>{line.detail}</details> : line.detail}</dd>
      </div>)}</dl>
    </Breakdown>}
    {!expanded && <p className={styles.small}>{value.basis}. This is a review estimate, not a published quote.</p>}
  </>;
}
