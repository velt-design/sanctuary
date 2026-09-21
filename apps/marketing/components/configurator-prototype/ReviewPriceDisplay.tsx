import { formatEstimate } from '../../lib/estimateDisplay';
import type { ReviewPrice } from '../../lib/configuratorReviewPrice';

import styles from './prototype.module.css';
export const reviewMoney = (n: number) => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(n);
export default function ReviewPriceDisplay({ value, expanded = false, part = 'all' }: { value: ReviewPrice | null; expanded?: boolean; part?: 'all' | 'summary' | 'details' }) {
  if (part === 'details' && value?.status !== 'priced') return null;
  if (!value) return <><p className={styles.priceValue}>Updating estimate…</p></>;
  if (value.status === 'custom') return <><p className={styles.priceValue}>Your design needs a tailored quote.</p></>;
  if (value.status !== 'priced') return <><p>Price preview unavailable. Try adjusting your design.</p></>;
  const Breakdown = expanded ? 'section' : 'details';
  return <>
    {part !== 'details' && <>
    <p className={styles.eyebrow}>{expanded ? 'DRAFT PRICE' : 'DRAFT PRICE · OWNER REVIEW'}</p>
    <p className={styles.priceValue}>{formatEstimate(value.amount)}</p>
    <p className={styles.small}>Including GST · {value.excluded.length ? 'Pergola subtotal' : 'Pergola estimate'}</p>
    </>}
    {part !== 'summary' && <>
    {value.excluded.length > 0 && <p><strong>Not included yet:</strong> {value.excluded.join(', ')}. These need separate pricing.</p>}
    {value.breakdown?.some(line=>line.provisional) && <p className={styles.small}>Includes provisional accessory allowances for your review.</p>}
    {expanded && <p className={styles.small}>{value.basis}. This is a review estimate, not a published quote.</p>}
    {value.breakdown && <Breakdown aria-label={expanded ? 'Your price breakdown' : undefined}>
      {expanded ? <h3>Your price breakdown</h3> : <summary>See price breakdown · including GST</summary>}
      <dl>{value.breakdown.map((line,index)=><div key={index} style={{padding:'12px 0',borderBottom:'1px solid currentColor'}}>
        <dt style={{display:'flex',justifyContent:'space-between',gap:16}}><span>{line.label}{line.provisional?' · provisional':''}</span><strong>{reviewMoney(line.amount)}</strong></dt>
        <dd className={styles.small} style={{margin:'6px 0 0'}}>{expanded ? <details><summary>Allowance details</summary>{line.detail}</details> : line.detail}</dd>
      </div>)}</dl><p className={styles.small}>Estimate total rounded to the nearest $5.</p>
    </Breakdown>}
    {!expanded && <p className={styles.small}>{value.basis}. This is a review estimate, not a published quote.</p>}
  </>}</>;
}
