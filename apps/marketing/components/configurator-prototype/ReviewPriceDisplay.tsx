import type { ReviewPrice } from '../../lib/configuratorReviewPrice';
import styles from './prototype.module.css';
export const reviewMoney = (n: number) => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(n);
export default function ReviewPriceDisplay({ value }: { value: ReviewPrice | null }) {
  if (!value) return <p className={styles.priceValue}>Updating estimate…</p>;
  if (value.status === 'custom') return <p className={styles.priceValue}>Your design needs a tailored quote.</p>;
  if (value.status !== 'priced') return <p>Price preview unavailable. Try adjusting your design.</p>;
  return <>
    <p className={styles.eyebrow}>DRAFT PRICE · OWNER REVIEW</p>
    <p className={styles.priceValue}>{reviewMoney(value.amount)}</p>
    <p className={styles.small}>Including GST · {value.excluded.length ? 'Pergola subtotal' : 'Pergola estimate'}</p>
    {value.excluded.length > 0 && <p><strong>Not included yet:</strong> {value.excluded.join(', ')}. These need separate pricing.</p>}
    {value.breakdown?.some(line=>line.provisional) && <p className={styles.small}>Includes provisional accessory allowances for your review.</p>}
    {value.breakdown && <details>
      <summary>See price breakdown · including GST</summary>
      <dl>{value.breakdown.map((line,index)=><div key={index} style={{padding:'12px 0',borderBottom:'1px solid currentColor'}}>
        <dt style={{display:'flex',justifyContent:'space-between',gap:16}}><span>{line.label}{line.provisional?' · provisional':''}</span><strong>{reviewMoney(line.amount)}</strong></dt>
        <dd className={styles.small} style={{margin:'6px 0 0'}}>{line.detail}</dd>
      </div>)}</dl>
    </details>}
    <p className={styles.small}>{value.basis}. This is a review estimate, not a published quote.</p>
  </>;
}
