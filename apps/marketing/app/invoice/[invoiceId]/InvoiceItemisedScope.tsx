import type { PublicDepositInvoice } from '@/lib/invoices/publicInvoice';
import styles from './invoiceEditorial.module.css';

const money = (value: number) => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(value / 100);

export default function InvoiceItemisedScope({ invoice }: { invoice: PublicDepositInvoice }) {
  const content = invoice.contentSnapshot;
  if (!content) return null;
  const linked = invoice.invoiceKind !== 'STANDALONE';
  return <section className={styles.calculationSection}>
    <div className={styles.sectionHeading}>
      <h2 className={styles.sectionTitle}>{linked ? 'Quoted scope — reference' : 'Itemised invoice'}</h2>
      {linked ? <p>The full accepted scope is shown for reference. This invoice requests only the amount shown in the payment summary.</p> : null}
    </div>
    <div className={styles.tableFrame}>
      <table className={styles.lineItemsTable}>
        <thead><tr><th>Description</th><th>Quantity</th><th>Unit price incl GST</th><th>Line total incl GST</th></tr></thead>
        <tbody>{content.items.map((item, index) => <tr key={`${item.id}:${index}`}>
          <td data-label="Description" style={{ whiteSpace: 'pre-wrap' }}>{item.description}</td>
          <td data-label="Quantity">{item.qty}</td>
          <td data-label="Unit price incl GST">{money(item.unitPriceIncGstCents)}</td>
          <td data-label="Line total incl GST">{money(item.lineTotalIncGstCents)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {linked ? <p><strong>Quoted scope total: {money(invoice.quoteTotalIncGstCents)} incl GST — reference only</strong></p> : null}
    <h2 className={styles.sectionTitle}>This invoice — {invoice.status === 'PAID' ? 'amount paid' : 'amount due'}</h2>
    <dl className={styles.totalsBreakdown}>
      <div className={styles.totalsRow}><dt>{invoice.paymentTermLabel}</dt><dd>{money(invoice.totalIncGstCents)}</dd></div>
      <div className={styles.totalsRow}><dt>Subtotal excluding GST</dt><dd>{money(invoice.totalExGstCents)}</dd></div>
      <div className={styles.totalsRow}><dt>GST 15%</dt><dd>{money(invoice.gstCents)}</dd></div>
      <div className={`${styles.totalsRow} ${styles.totalsDueRow}`}><dt>Total NZD incl GST</dt><dd>{money(invoice.totalIncGstCents)}</dd></div>
    </dl>
    {content.billingAddress ? <p style={{ whiteSpace: 'pre-wrap' }}><strong>Billing address</strong><br />{content.billingAddress}</p> : null}
    {content.notes ? <p style={{ whiteSpace: 'pre-wrap' }}><strong>Invoice notes</strong><br />{content.notes}</p> : null}
  </section>;
}
