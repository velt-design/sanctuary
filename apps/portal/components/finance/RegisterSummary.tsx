import { money, type RegisterData, type RegisterQuery } from '@/lib/finance/register';
import styles from './FinanceRegister.module.css';

/** All figures come from the RPC's full matching set, never the visible page. */
export default function RegisterSummary({ data, query, stale, pending }: { data?: RegisterData; query: RegisterQuery; stale: boolean; pending: boolean }) {
  const quotes = query.tab === 'quotes';
  const draft = !quotes && query.view === 'drafts';
  const paid = !quotes && query.view === 'paid';
  return <section className={styles.summary} aria-label={stale ? 'Previous results summary' : 'Matching records summary'} data-stale={stale || undefined}>
    <div className={styles.summaryCount}><strong>{data ? data.count : pending ? 'Checking…' : 'Unavailable'}</strong><span>{quotes ? 'quote families' : 'invoices'}{stale ? ' · previous results' : ' in this view'}</span></div>
    {!data?.totals.length && <div className={styles.currencySummary}>
      <div className={styles.owingMetric}><span>{quotes ? 'Quote value' : draft ? 'Draft value' : paid ? 'Recorded paid' : 'Recorded owing'}</span><strong>{data ? 'No matching totals' : pending ? 'Checking...' : 'Unavailable'}</strong></div>
      {!quotes && !draft && <div className={styles.secondaryMetric}><span>{paid ? 'Recorded owing' : 'Recorded paid'}</span><strong>{data ? 'No matching totals' : pending ? 'Checking...' : 'Unavailable'}</strong></div>}
    </div>}
    {data?.totals.map(total => <div className={styles.currencySummary} key={total.currency}>
      <div className={styles.owingMetric}><span>{quotes ? 'Quote value' : draft ? 'Draft value' : paid ? 'Recorded paid' : 'Recorded owing'}</span>
        <strong>{money(quotes || draft ? total.totalCents : paid ? total.paidCents : total.balanceCents, total.currency)}</strong>
        {total.unconfirmedCount > 0 && <small>{total.unconfirmedCount} needing checks excluded</small>}
      </div>
      {!quotes && !draft && <div className={styles.secondaryMetric}><span>{paid ? 'Recorded owing' : 'Recorded paid'}</span><strong>{money(paid ? total.balanceCents : total.paidCents, total.currency)}</strong></div>}
    </div>)}
    {data && <span className={styles.taxBasis}>Incl GST</span>}
  </section>;
}
