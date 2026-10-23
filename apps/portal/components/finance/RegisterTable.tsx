import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import { Button, ButtonLink } from '@/components/ui/foundation/FoundationControls';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/foundation/FoundationSurfaces';
import { money, registerProjectHref, type RegisterQuery, type RegisterRow } from '@/lib/finance/register';
import styles from './FinanceRegister.module.css';

const date = (value: string | null) => value ? new Date(value.length === 10 ? `${value}T00:00:00Z` : value).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Pacific/Auckland' }) : 'Not recorded';
const labels: Record<string, string> = { OPEN: 'Outstanding', PAID: 'Recorded paid', VOID: 'Voided', DRAFT: 'Draft', SENT: 'Awaiting acceptance', ACCEPTED: 'Accepted', SUPERSEDED: 'Superseded', DECLINED: 'Declined' };
const deliveryLabel = (row: RegisterRow) => row.sendState === 'pending' ? 'Confirming delivery' : row.sendState === 'prepared' ? 'Delivery prepared' : row.sendState === 'review' ? 'Delivery needs attention' : row.sendState === 'failed' ? 'Send failed' : row.status === 'DRAFT' ? 'Draft' : ['VOID','DECLINED','SUPERSEDED'].includes(row.status) ? 'No Portal send recorded' : 'Needs sending';
const resendLabel = (row: RegisterRow) => row.deliveryState === 'dispatching' || row.deliveryState === 'provider_accepted' ? 'Resend pending' : row.deliveryState === 'prepared' ? 'Resend prepared' : row.deliveryState === 'failed' ? 'Resend failed' : row.deliveryState === 'needs_attention' ? 'Resend needs check' : row.sendNote ? 'Latest send failed' : null;
export default function RegisterTable({ rows, tab, selected, disabled, select, pending = false, emptyMessage, checkedAt }: {
  rows: RegisterRow[]; tab: RegisterQuery['tab']; selected: string | null; disabled: boolean; select: (id: string) => void; pending?: boolean; emptyMessage?: ReactNode; checkedAt?: string;
}) {
  const invoice = tab === 'invoices';
  const today = checkedAt ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(checkedAt)) : '';
  return <Table className={styles.table} role="table"><TableHeader role="rowgroup"><TableRow role="row">
    <TableHead>{invoice ? 'Invoice' : 'Quote'}</TableHead><TableHead>Customer / job</TableHead><TableHead>Sent</TableHead><TableHead>{invoice ? 'Due' : 'Expires'}</TableHead>
    <TableHead className={styles.number}>Total</TableHead>{invoice && <><TableHead className={styles.number}>Paid / credits</TableHead><TableHead className={`${styles.number} ${styles.owingColumn}`}>Owing</TableHead></>}
  </TableRow></TableHeader><TableBody role="rowgroup">
    {!rows.length && <TableRow role="row"><TableCell role="cell" colSpan={invoice ? 7 : 5}>{pending ? `Reading ${invoice ? 'invoice' : 'quote'} records…` : emptyMessage}</TableCell></TableRow>}
    {rows.map(row => <Fragment key={row.id}>
    <TableRow role="row" data-selected={selected === row.id || undefined}>
      <TableCell role="cell" data-label={invoice ? 'Invoice' : 'Quote'}><Button className={styles.recordToggle} id={`finance-toggle-${row.id}`} variant="tertiary" size="small" disabled={disabled} aria-expanded={selected === row.id} aria-controls={`record-${row.id}`} onClick={() => select(row.id)}>{row.reference}{!invoice && ` v${row.version}`}</Button>
        {(!invoice || row.status !== 'OPEN') && <small className={styles.lifecycle}>{row.expired ? 'Expired' : labels[row.status] ?? row.status}</small>}
        {invoice && row.status === 'OPEN' && row.paidCents !== null && row.paidCents > 0 && row.balanceCents !== null && row.balanceCents > 0 && <small className={styles.partial}>Part paid</small>}
      </TableCell>
      <TableCell role="cell" data-label="Customer / job"><strong>{row.customer}</strong><br /><Link href={registerProjectHref(row, tab)}>{row.project}</Link>
        {!invoice && row.pendingDraftVersion !== null && row.pendingDraftVersion !== row.version && <small>Draft revision v{row.pendingDraftVersion}</small>}
        {!invoice && row.acceptedVersion !== null && row.acceptedVersion !== row.version && <small>Current accepted v{row.acceptedVersion}</small>}
      </TableCell>
      <TableCell role="cell" data-label="Sent from Portal" className={styles.dateCell}>
        <span className={row.sendState === 'sent' ? styles.dateValue : row.sendState !== 'needs' ? styles.warning : undefined}>{row.sendState === 'sent' ? date(row.sentAt) : deliveryLabel(row)}</span>
        {row.sendState === 'sent' && resendLabel(row) && <small className={styles.warning}>{resendLabel(row)}</small>}
      </TableCell>
      <TableCell role="cell" data-label={invoice ? 'Due' : 'Expires'} className={styles.dateCell}><span className={styles.dateValue}>{date(row.dueDate)}</span>
        {invoice && row.status === 'OPEN' && row.dueDate && today && row.dueDate < today && <small className={styles.warning}>Overdue</small>}
      </TableCell>
      <TableCell role="cell" data-label="Total incl GST" className={styles.number}>{money(row.totalCents, row.currency)}</TableCell>
      {invoice && <><TableCell role="cell" data-label="Paid / credits" className={styles.number}>{row.paidCents === null ? row.status === 'DRAFT' ? 'Not issued' : 'Needs checking' : money(row.paidCents, row.currency)}</TableCell>
        <TableCell role="cell" data-label="Still owing" className={`${styles.number} ${styles.owingColumn}`}><strong>{row.status === 'VOID' ? 'Not payable' : row.status === 'DRAFT' ? 'Not issued' : row.balanceCents === null ? 'Needs checking' : money(row.balanceCents, row.currency)}</strong>
          {row.providerNote && <small className={styles.warning}>Xero check needed</small>}
          {row.checkReason && row.balanceCents !== null && <small className={styles.warning}>Check payments</small>}
        </TableCell></>}
    </TableRow>
    {selected === row.id && <TableRow role="row" className={styles.detailRow}><TableCell role="cell" colSpan={invoice ? 7 : 5} id={`record-${row.id}`}>
      <section aria-label={`${row.reference} details`} className={styles.detail}>
        <div><h2>{row.reference}{!invoice && ` v${row.version}`}</h2><p>{row.customer} · {row.project}</p>
          {row.checkReason && <p className={styles.warning}>{row.checkReason}</p>}
          {row.sendNote && <p className={styles.warning}>{row.sendNote}</p>}
          {row.providerNote && <p>{row.providerNote} {row.providerCheckedAt && `Last checked ${date(row.providerCheckedAt)}.`}</p>}
          <dl><dt>{invoice ? 'Issued' : 'Created'}</dt><dd>{date(row.issueDate)}</dd><dt>{invoice ? 'Due' : 'Expires'}</dt><dd>{date(row.dueDate)}</dd>
            <dt>Sent from Portal</dt><dd>{row.sentAt ? date(row.sentAt) : 'No successful send recorded'}</dd>
            {row.lastAttemptAt && <><dt>Latest delivery activity</dt><dd>{date(row.lastAttemptAt)}</dd></>}
            {row.nextRetryAt && <><dt>Scheduled send retry</dt><dd>{date(row.nextRetryAt)}</dd></>}
          </dl>
          <div className={styles.actions}><ButtonLink href={registerProjectHref(row, tab)} variant="secondary">Open {invoice ? 'job invoices' : 'quote in job'}</ButtonLink>
            {invoice && row.status !== 'DRAFT' && <ButtonLink href={`/api/staff/v1/invoices/inv_${row.id}/preview/pdf`} variant="tertiary" target="_blank" rel="noopener noreferrer">View invoice PDF</ButtonLink>}
            <Button variant="tertiary" onClick={() => { select(row.id); requestAnimationFrame(() => document.getElementById(`finance-toggle-${row.id}`)?.focus()); }}>Close details</Button>
          </div>
        </div>
        {!invoice && <div><h3>Version history</h3><ul className={styles.history}>{row.history.map(version => <li key={version.id}><Link href={`/staff/projects/proj_${row.projectId}?tab=quotes&quoteId=qv_${version.id}`}>{row.reference} v{version.version}</Link><span>{version.expired ? 'Expired' : labels[version.status] ?? version.status}</span><span>{money(version.totalCents, row.currency)}</span></li>)}</ul>
          {row.historyCount > row.history.length && <p>{row.historyCount} versions in this family. <Link href={`/staff/projects/proj_${row.projectId}?tab=quotes`}>See all versions in the job</Link></p>}
        </div>}
      </section>
    </TableCell></TableRow>}
  </Fragment>)}</TableBody></Table>;
}
