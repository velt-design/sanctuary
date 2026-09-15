import { notFound } from 'next/navigation';
import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';
import { PageLayout, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/foundation/FoundationSurfaces';
import { Button, ButtonLink, Input } from '@/components/ui/foundation/FoundationControls';
import { DataStatePanel } from '@/components/ui/foundation/FoundationFeedback';
import { getPaymentPilotSession } from '@/lib/xero/pilotAccess';
import { loadFinanceReview } from '@/lib/invoices/financeReviewRepository';
import { financeOutcome, parseFinanceView, type FinanceView } from '@/lib/xero/financeReview';
import styles from './finance.module.css';
import CheckXero from './CheckXero';
import RecoverTransfer from './RecoverTransfer';

export const dynamic = 'force-dynamic';
export default async function FinancePage({ searchParams }: { searchParams: Promise<{ search?: string; offset?: string; view?: string }> }) {
  const session = await getPaymentPilotSession();
  if (!session) notFound();
  const query = await searchParams;
  const view = parseFinanceView(query.view);
  const search = typeof query.search === 'string' ? query.search.slice(0, 120).trim() : '';
  const rawOffset = Number(query.offset ?? 0);
  const offset = Number.isSafeInteger(rawOffset) && rawOffset >= 0 && rawOffset <= 10000 ? rawOffset : 0;
  let data: Awaited<ReturnType<typeof loadFinanceReview>> | null = null;
  try { data = await loadFinanceReview(session.user.id, search, offset, view); } catch { /* Show a safe retry state, never an empty success. */ }
  const href = (next: number, section: FinanceView = view) => `/staff/payments?${new URLSearchParams({ search, offset: String(next), view: section })}`;
  const views = [['attention', 'Needs attention'], ['current', 'Xero invoices'], ['history', 'Invoice history']] as const;
  return <PageLayout>
    <PageHeader variant="index" title="Finance review" description="Review invoices, confirm deposits and investigate outstanding items." />
    {process.env.VERCEL_ENV === 'preview' && <DataStatePanel state="empty" title="Preview — review the workflow first" description="This is the test portal. Check that the instructions make sense before taking any accounting action. This is not your live Finance queue." />}
    {view === 'attention' && <section aria-label="How to use Finance"><h2>Start with the next action on an invoice</h2><p>You do not need to create invoices again here. The portal sends new invoices to Xero as drafts. Finance checks those drafts in Xero, then uses this page to review payments after reconciliation.</p></section>}
    <nav className={styles.views} aria-label="Finance views">{views.map(([key, label]) =>
      <ButtonLink key={key} href={href(0, key)} variant={view === key ? 'primary' : 'secondary'} aria-current={view === key ? 'page' : undefined}>{label}</ButtonLink>)}</nav>
    <p>{view === 'attention' ? 'Invoices that need a check or decision, including older invoices with unresolved payment issues.'
      : view === 'current' ? 'Invoices queued for or linked to Xero through the portal. Those needing a decision also appear in Needs attention.'
      : 'Older invoices remain here for reference. They are outside automatic Xero transfers. Unresolved payment issues also appear in Needs attention.'}</p>
    <form method="get" className={styles.search}><input type="hidden" name="view" value={view} />
      <label>Invoice, customer or project<Input name="search" defaultValue={search} maxLength={120} /></label>
      <Button type="submit" variant="secondary">Search</Button>
      {search && <ButtonLink href={`/staff/payments?view=${view}`} variant="tertiary">Clear search</ButtonLink>}
    </form>
    <p><ButtonLink href="/staff/payments/review" variant="tertiary">Review an older deposit</ButtonLink></p>
    {!data ? <><DataStatePanel state="error" title="Finance could not be loaded" description="Try again to check the current position. No records have changed." /><ButtonLink href={href(offset)} variant="secondary">Try again</ButtonLink></> : <>
      <p className={styles.checked}>Portal records checked {new Date(data.checkedAt).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })}. Each linked invoice shows when Xero was last checked.</p>
      {data.rows.length > 0 &&
      <Table className={styles.invoices} role="table"><TableHeader role="rowgroup"><TableRow role="row">
        <TableHead>Invoice / customer</TableHead><TableHead>Portal status</TableHead><TableHead>Invoice amount</TableHead><TableHead>Still owing</TableHead><TableHead>Next action</TableHead>
      </TableRow></TableHeader><TableBody role="rowgroup">{data.rows.map(row => {
        const outcome = financeOutcome(row);
        const draftReview = Boolean(row.xeroInvoiceId && (!row.observation || ['draft', 'awaiting_approval'].includes(row.observation.state)) && !row.correctionRequired && !row.unassignedReceipts && row.recordedCents === 0 && row.status === 'OPEN');
        const stopped = !row.xeroInvoiceId && row.captured && ['needs_attention', 'permanent_failed'].includes(row.transferStatus ?? '');
        const money = (value: number) => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: row.currency }).format(value / 100);
        return <TableRow key={row.invoiceId} role="row">
          <TableCell role="cell" data-label="Invoice / customer"><Link href={`/staff/projects/${row.projectId}?tab=invoices`}>{row.invoiceRef}</Link><br />{row.customerName}<br /><small>{row.projectName}</small></TableCell>
          <TableCell role="cell" data-label="Portal status">{row.status === 'VOID' ? 'Voided' : row.status === 'PAID' ? 'Recorded paid' : 'Open'}{row.dueDate && <><br /><small>Due {row.dueDate}</small></>}</TableCell>
          <TableCell role="cell" data-label="Invoice amount">{money(row.totalCents)}</TableCell><TableCell role="cell" data-label="Still owing">{row.status === 'VOID' ? 'Not payable' : outcome.remainingCents === null ? 'Needs review' : money(outcome.remainingCents)}</TableCell>
          <TableCell role="cell" data-label="Next action"><strong>{outcome.label}</strong>
            {draftReview && <p>Open the draft in Xero. Check the customer, amount and GST against the portal invoice. If correct, choose More approve options → Approve in Xero. Do not choose Approve &amp; email. Then return here.</p>}
            {stopped && <p>{row.transferError === 'XERO_MAPPING_REQUIRED' ? 'The transfer needs the correct Xero customer and accounting settings. Review Xero setup below, then resume the existing transfer.' : 'The automatic transfer has stopped. A developer needs to investigate before it can continue. Do not issue another invoice or create a replacement in Xero.'}</p>}
            {row.xeroInvoiceId && <ButtonLink variant="primary" size="small" href={`/staff/payments/xero-invoice?invoice=${row.invoiceId}`} target="_blank" rel="noopener noreferrer">{draftReview ? 'Review draft in Xero' : 'Open in Xero'}</ButtonLink>}
            <details open={!draftReview}><summary>Checks and other options</summary>
            {row.lastVerifiedAt && <><br /><small>Transfer verified {new Date(row.lastVerifiedAt).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })}</small></>}
            {row.observation && <><br /><small>Xero checked {new Date(row.observation.checkedAt).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })}</small></>}
            {row.xeroInvoiceId && <><br /><CheckXero invoiceId={row.invoiceId} invoiceRef={row.invoiceRef} /></>}
            {!row.xeroInvoiceId && row.captured && row.status !== 'VOID' && ['needs_attention', 'permanent_failed'].includes(row.transferStatus ?? '')
              && <RecoverTransfer invoiceId={row.invoiceId} />}
            {row.xeroInvoiceId && process.env.XERO_INVOICE_PAYMENTS_ENABLED === 'true' && <><br /><ButtonLink variant="tertiary" size="small" href={`/staff/payments/invoice?invoice=${row.invoiceId}`}>Review invoice payments</ButtonLink></>}
            {row.unassignedReceipts && <><br /><ButtonLink variant="tertiary" size="small" href={`/staff/projects/${row.projectId}?tab=invoices`}>Review project payments</ButtonLink></>}
            {row.captured && !row.xeroInvoiceId && !row.unassignedReceipts && row.status !== 'VOID' && <><br /><ButtonLink variant="tertiary" size="small" href={`/staff/payments/mapping?invoice=${row.invoiceId}`}>Review Xero setup</ButtonLink></>}
            </details>
          </TableCell>
        </TableRow>;
      })}</TableBody></Table>}
      {!data.rows.length && <DataStatePanel state={search ? 'filtered-empty' : 'empty'}
        title={search ? 'No matching invoices in this view' : offset > 0 ? 'No more invoices in this view' : view === 'attention' ? 'No invoices need attention' : view === 'current' ? 'No automatic transfers yet' : 'No historical invoices'}
        description={search ? 'Try another search or check another view.' : offset > 0 ? 'Return to the first page to see the current list.' : view === 'attention' ? 'There are no invoice issues requiring review right now. Xero invoices and history remain available above.' : view === 'current' ? 'Your next newly issued portal invoice will appear here. Older invoices are in Invoice history.' : 'Invoices issued before automatic transfers are shown here when available.'} />}
      <nav aria-label="Finance pages">{offset > 0 && <Link href={href(Math.max(0, offset - 50))}>Previous page</Link>}{' '}{data.hasMore && offset < 10000 && <Link href={href(offset + 50)}>Next page</Link>}</nav>
    </>}
  </PageLayout>;
}
