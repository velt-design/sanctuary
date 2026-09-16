import Link from 'next/link';
import { requireAdminPageAccess } from '@/lib/auth';
import { accessoryReviewItems, reviewExamplePrice } from '@/lib/costing/accessoryReviewModel';
import styles from '../costingControl.module.css';
import review from './review.module.css';

const money = (n: number) => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(n);

export default async function AccessoryReviewPage() {
  await requireAdminPageAccess('/admin/costing/accessory-review');
  const items = accessoryReviewItems();
  return <main className={styles.page}>
    <header className={styles.header}><div>
      <div className={styles.eyebrow}>Pricebook · Internal review</div>
      <h1 className={styles.title}>Accessory pricing review</h1>
      <p className={styles.lede}>Check the evidence behind each allowance before deciding what customers should pay.</p>
    </div><Link className={styles.buttonSecondary} href="/admin/costing">Back to costing</Link></header>
    <aside className={review.notice}>
      <strong>Review only · No live prices changed</strong>
      <p>This page shows unpublished reference allowances. To prepare changes, add the review allowances in the Accessories section of a pricebook draft, then edit and validate them there. Public pricing activation remains a separate release step. All supplier costs and installation allowances below exclude GST. Examples show customer prices including GST using an illustrative 1.30 multiplier, with no discount or uplift.</p>
      <p>The amount remaining is before any unallocated overhead, travel and site work. It is not net profit. An invoice supports the specified item only; it does not approve an entire category.</p>
    </aside>
    <nav className={review.navigation} aria-label="Review categories">{items.map(item => <a key={item.id} href={`#${item.id}`}>{item.title}</a>)}</nav>
    <div className={review.grid}>{items.map(item => <section className={review.card} id={item.id} key={item.id}>
      <div className={review.cardHeader}><h2>{item.title}</h2><span className={review.status}>{item.status}</span></div>
      <dl><dt>Current allowance</dt><dd>{item.supply}</dd><dt>Installation and additions</dt><dd>{item.installation}</dd><dt>Supplier evidence</dt><dd>{item.evidence}</dd></dl>
      {item.example && (() => { const price = reviewExamplePrice(item.example.cost); return <details className={review.example}>
        <summary>View worked price example</summary><p>{item.example.scope}</p>
        <dl><dt>Model cost · ex GST</dt><dd>{money(item.example.cost)}</dd><dt>Customer price · incl GST</dt><dd>{money(price.incGst)}</dd><dt>Remaining · ex GST</dt><dd>{money(price.remainingEx)} · 23.1% of ex-GST selling price</dd></dl>
      </details>; })()}
      <div className={review.next}><strong>Next check</strong><p>{item.next}</p></div>
    </section>)}</div>
  </main>;
}
