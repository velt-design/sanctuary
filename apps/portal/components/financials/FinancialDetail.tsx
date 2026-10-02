import { Drawer } from '@/components/ui/drawer/Drawer';
import { cents, invoiceLink, money, matchingLine, reportLines, type Invoice, type ReportLine } from '@/lib/xero/financials/model';
import type { FinancialReport, Financials } from '@/lib/xero/financials/contract';
import styles from './Financials.module.css';

export default function FinancialDetail({ detail, report, evidence, invoice, close, synthetic }: { detail: ReportLine | null; report: FinancialReport | null; evidence: Financials; invoice: Invoice | null; close: () => void; synthetic: boolean }) {
  const title = invoice ? `${invoice.number || (invoice.type === 'ACCREC' ? 'Invoice' : 'Bill')} · ${invoice.contactName}` : detail?.label ?? 'Source detail';
  return <Drawer title={title} open={Boolean(detail || invoice)} onClose={close}>
    {invoice ? <div className={styles.detail}><p className={styles.context}>Current Xero document balance · {invoice.currency}. Face and outstanding amounts include GST where charged.</p><dl>
      {[['Issued',invoice.date],['Due',invoice.dueDate ?? 'Not recorded'],['Document total',money(cents(invoice.total),invoice.currency)],['Paid',money(cents(invoice.amountPaid),invoice.currency)],['Credited',money(cents(invoice.amountCredited),invoice.currency)],['Outstanding',money(cents(invoice.amountDue),invoice.currency)]].map(([label,value]) => <div key={label} style={{display:'contents'}}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl><h3>Source lines</h3>{invoice.lineItems.map((line,index) => <div key={index}><p>{line.description || 'No description'}</p><p className={styles.context}>Account {line.accountCode ?? 'not supplied'} · Line {line.lineAmount === null ? 'unavailable' : money(cents(line.lineAmount),invoice.currency)} · Tax {line.taxAmount === null ? 'unavailable' : money(cents(line.taxAmount),invoice.currency)}</p></div>)}
      {synthetic ? <p className={styles.context}>Fictional document. No live accounting record is linked.</p> : <a href={invoiceLink(invoice)} target="_blank" rel="noopener noreferrer">Open this {invoice.type === 'ACCREC' ? 'invoice' : 'bill'} in Xero</a>}
      <p className={styles.context}>Xero sign-in may be required. Opening a record does not change it. The Portal does not create, send, pay or reconcile records here.</p>
    </div> : detail && report ? <div className={styles.detail}><p>{report.name} · {report.from} to {report.to} · {report.basis} · {report.currency}</p>
      <dl>{detail.values.map((value,index) => <div key={index} style={{display:'contents'}}><dt>{reportLines(report).find(line => line.type === 'Header')?.values[index] ?? `Source value ${index + 1}`}</dt><dd>{value || 'Unavailable'}</dd></div>)}</dl>
      {report.basis !== 'bank_movements' && <><h3>Comparisons</h3><dl>{(['previous','yearAgo'] as const).map(key => {
        const compare = evidence[key], line = compare.report.status === 'available' ? matchingLine(reportLines(compare.report.data),detail) : null;
        return <div key={key} style={{display:'contents'}}><dt>{compare.query.from} – {compare.query.to}</dt><dd>{money(line?.cents ?? null,report.currency)}</dd></div>;
      })}</dl></>}
      <p className={styles.context}>These are the exact report-row values supplied by Xero. Transaction-level entries are not included in this report. Account comparisons use the source account identifier where supplied, otherwise the exact report hierarchy and label.</p>
    </div> : null}
  </Drawer>;
}
