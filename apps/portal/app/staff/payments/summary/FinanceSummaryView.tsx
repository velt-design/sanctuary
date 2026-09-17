import type { FinanceSummary } from '@/lib/xero/financeSummaryContract';
import styles from './summary.module.css';

function amount(cents: number, currency: string) {
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency, currencyDisplay: 'code' }).format(cents / 100);
}
export default function FinanceSummaryView({ summary }: { summary: FinanceSummary }) {
  return <section aria-label="Xero summary results">
    <h2>{summary.period.from} to {summary.period.to}</h2>
    <p>Invoice and payment dates are the dates recorded in Xero. Outstanding invoices are current at the time of this read, across all invoice dates.</p>
    <p>Read completed {new Date(summary.checkedAt).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })} (Auckland).
      All requested pages were read. Xero can change while a report is being read; this is not a locked accounting snapshot.</p>
    {!summary.currencies.length && <p>No qualifying invoices, invoice payments or current outstanding balances were found.</p>}
    {summary.currencies.map(row => <section key={row.currency} aria-label={`${row.currency} totals`}>
      <h3>{row.currency}</h3>
      <div className={styles.measures}>
        <section className={styles.measure}><h4>Invoiced sales</h4>
          <p className={styles.amount}>{amount(row.invoiced.excludingTaxCents, row.currency)} <span>excluding GST / tax</span></p>
          <p>{row.invoiced.count} approved or paid invoices dated in this period.</p>
          <dl><dt>GST / tax</dt><dd>{amount(row.invoiced.taxCents, row.currency)}</dd><dt>Including GST / tax</dt><dd>{amount(row.invoiced.includingTaxCents, row.currency)}</dd></dl>
          <p>Before credit notes. This is gross invoicing, not profit or recognised revenue.</p>
        </section>
        <section className={styles.measure}><h4>Customer invoice receipts</h4>
          <p className={styles.amount}>{amount(row.receipts.reconciledCents, row.currency)} <span>reconciled</span></p>
          <p>{row.receipts.count} authorised invoice payments dated in this period.</p>
          <dl><dt>Not yet reconciled</dt><dd>{amount(row.receipts.unreconciledCents, row.currency)}</dd><dt>Reconciliation unknown</dt><dd>{amount(row.receipts.unknownReconciliationCents, row.currency)}</dd></dl>
          <p>Cash amounts in the invoice currency, including any tax paid. Bank reconciliation remains manual.</p>
        </section>
        <section className={styles.measure}><h4>Outstanding now</h4>
          <p className={styles.amount}>{amount(row.outstanding.amountDueCents, row.currency)} <span>including GST / tax</span></p>
          <p>{row.outstanding.count} approved invoices with a balance owing, including older invoices.</p>
          <p>Uses Xero's remaining balance after payments and allocated credits. This is not the period-end balance.</p>
        </section>
      </div>
    </section>)}
    <details><summary>What these figures include</summary>
      <p>Invoicing excludes drafts, awaiting approval, voided and deleted invoices. Credit notes are not subtracted from gross invoicing.</p>
      <p>Receipts include authorised customer invoice payments only. Direct receive-money transactions, prepayments, overpayments, credit allocations and refunds are excluded; this is not all money received. Unreconciled or unknown receipts are shown separately, not treated as confirmed bank receipts.</p>
      <p>Currencies are kept separate. The three measures use different bases and must not be added together. Outstanding balances respect credits even though gross invoicing does not deduct credit notes.</p>
      <p>Supported currencies: NZD, AUD, USD, GBP, EUR, CAD and SGD. Other currencies stop the summary rather than being rounded or omitted.</p>
    </details>
  </section>;
}
