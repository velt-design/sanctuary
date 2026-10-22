import { notFound } from 'next/navigation';
import {Suspense} from 'react';
import {FinanceReadRows,FinanceReadStatus,FinanceReadPages} from './FinanceReadParts.server';
import PageHeader from '@/components/layout/PageHeader';
import { PageLayout, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/foundation/FoundationSurfaces';
import { Button, ButtonLink, Input } from '@/components/ui/foundation/FoundationControls';
import { DataStatePanel } from '@/components/ui/foundation/FoundationFeedback';
import { getPaymentPilotSession } from '@/lib/xero/pilotAccess';
import { loadFinanceReview } from '@/lib/invoices/financeReviewRepository';
import { parseFinanceView, type FinanceView } from '@/lib/xero/financeReview';
import styles from './finance.module.css';

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ search?: string; offset?: string; view?: string }> }) {
  const session = await getPaymentPilotSession();
  if (!session) notFound();
  const query = await searchParams;
  const view = parseFinanceView(query.view);
  const search = typeof query.search === 'string' ? query.search.slice(0, 120).trim() : '';
  const rawOffset = Number(query.offset ?? 0);
  const offset = Number.isSafeInteger(rawOffset) && rawOffset >= 0 && rawOffset <= 10000 ? rawOffset : 0;
  const read=loadFinanceReview(session.user.id,search,offset,view).catch(()=>null);
  const href = (next: number, section: FinanceView = view) => `/staff/payments?${new URLSearchParams({ tab: 'xero', search, offset: String(next), view: section })}`;
  const automaticPayments = process.env.XERO_AUTOMATIC_PAYMENTS_ENABLED === 'true';
  const views = [['attention', 'Needs attention'], ['current', 'Xero invoices'], ['history', 'Invoice history']] as const;
  return <PageLayout>
    <PageHeader variant="index" title="Xero checks" description="Invoice transfers, payment checks and accounting exceptions." />
    <nav className={styles.views} aria-label="Finance sections"><ButtonLink href="/staff/payments" variant="secondary">Invoices</ButtonLink><ButtonLink href="/staff/payments?tab=quotes" variant="secondary">Quotes</ButtonLink><ButtonLink href="/staff/payments?tab=xero" variant="primary" aria-current="page">Xero checks</ButtonLink></nav>
    {process.env.VERCEL_ENV === 'preview' && <DataStatePanel state="empty" title="Preview — review the workflow first" description="This is the test portal. Check that the instructions make sense before taking any accounting action. This is not your live Finance queue." />}
    {view === 'attention' && <section aria-label="How to use Finance"><h2>{automaticPayments ? 'Only deal with the exceptions' : 'Check the next action on an invoice'}</h2><p>{automaticPayments ? 'Reconciled Xero payments update the portal automatically. Items below need a check or decision. You do not need to enter the same payment again.' : 'Issue invoices from the project. This page shows transfer and payment checks; automatic payment recording has not been enabled yet.'}</p></section>}
    <nav className={styles.views} aria-label="Finance views">{views.map(([key, label]) =>
      <ButtonLink key={key} href={href(0, key)} variant={view === key ? 'primary' : 'secondary'} aria-current={view === key ? 'page' : undefined}>{label}</ButtonLink>)}</nav>
    <p>{view === 'attention' ? 'Invoices that need a check or decision, including older invoices with unresolved payment issues.'
      : view === 'current' ? 'Invoices queued for or linked to Xero through the portal. Those needing a decision also appear in Needs attention.'
      : 'Older invoices remain here for reference. They are outside automatic Xero transfers. Unresolved payment issues also appear in Needs attention.'}</p>
    <form method="get" className={styles.search}><input type="hidden" name="tab" value="xero" /><input type="hidden" name="view" value={view} />
      <label>Invoice, customer or project<Input name="search" defaultValue={search} maxLength={120} /></label>
      <Button type="submit" variant="secondary">Search</Button>
      {search && <ButtonLink href={`/staff/payments?tab=xero&view=${view}`} variant="tertiary">Clear search</ButtonLink>}
    </form>
    <p><ButtonLink href="/staff/payments/summary" variant="secondary">Read Xero finance summary</ButtonLink></p>
    <p><ButtonLink href="/staff/payments/review" variant="tertiary">Review an older deposit</ButtonLink></p>
    <Suspense fallback={<p className={styles.checked} role="status">Reading current portal invoice records…</p>}><FinanceReadStatus read={read}/></Suspense>
    <Table className={styles.invoices} role="table"><TableHeader role="rowgroup"><TableRow role="row"><TableHead>Invoice / customer</TableHead><TableHead>Portal status</TableHead><TableHead>Invoice amount</TableHead><TableHead>Still owing</TableHead><TableHead>Next action</TableHead></TableRow></TableHeader>
      <TableBody role="rowgroup"><Suspense fallback={<TableRow><TableCell colSpan={5} role="status">Reading verified invoices…</TableCell></TableRow>}><FinanceReadRows read={read} search={search} offset={offset} view={view} automaticPayments={automaticPayments} href={href}/></Suspense></TableBody>
    </Table>
    <Suspense fallback={null}><FinanceReadPages read={read} offset={offset} href={href}/></Suspense>
  </PageLayout>;
}
