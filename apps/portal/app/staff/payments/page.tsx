import { notFound } from 'next/navigation';
import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';
import { PageLayout, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/foundation/FoundationSurfaces';
import { getPaymentPilotSession } from '@/lib/xero/pilotAccess';
import { loadFinanceReview } from '@/lib/invoices/financeReviewRepository';
import { financeOutcome } from '@/lib/xero/financeReview';

export const dynamic = 'force-dynamic';
export default async function FinancePage({ searchParams }: { searchParams: Promise<{ search?: string; offset?: string }> }) {
  const session = await getPaymentPilotSession();
  if (!session) notFound();
  const query = await searchParams;
  const search = typeof query.search === 'string' ? query.search.slice(0, 120).trim() : '';
  const rawOffset = Number(query.offset ?? 0);
  const offset = Number.isSafeInteger(rawOffset) && rawOffset >= 0 && rawOffset <= 10000 ? rawOffset : 0;
  let data: Awaited<ReturnType<typeof loadFinanceReview>> | null = null;
  try { data = await loadFinanceReview(session.user.id, search, offset); } catch { /* Show a safe retry state, never an empty success. */ }
  const href = (next: number) => `/staff/payments?${new URLSearchParams({ search, offset: String(next) })}`;
  return <PageLayout width="full">
    <PageHeader variant="index" title="Finance review" description="Review invoices, confirm deposits and investigate outstanding items." />
    <p><Link href="/staff/payments/review">Review and approve a deposit</Link></p>
    <form method="get"><label>Invoice, customer or project <input name="search" defaultValue={search} maxLength={120} /></label> <button type="submit">Search</button></form>
    {!data ? <p role="alert">Finance information could not be loaded. Refresh to try again. No records have changed.</p> : <>
      <p>Portal information checked {new Date(data.checkedAt).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })}. Xero dates below show the last verified transfer, not a live account check.</p>
      <div style={{ overflowX: 'auto' }}><Table><TableHeader><TableRow>
        <TableHead>Invoice / customer</TableHead><TableHead>Portal status</TableHead><TableHead>Invoice amount</TableHead><TableHead>Still owing</TableHead><TableHead>Next action</TableHead>
      </TableRow></TableHeader><TableBody>{data.rows.map(row => {
        const outcome = financeOutcome(row);
        const money = (value: number) => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: row.currency }).format(value / 100);
        return <TableRow key={row.invoiceId}>
          <TableCell>{row.invoiceRef}<br />{row.customerName}<br /><small>{row.projectName}</small></TableCell>
          <TableCell>{row.status === 'VOID' ? 'Voided' : row.status === 'PAID' ? 'Recorded paid' : 'Open'}{row.dueDate && <><br /><small>Due {row.dueDate}</small></>}</TableCell>
          <TableCell>{money(row.totalCents)}</TableCell><TableCell>{outcome.remainingCents === null ? 'Needs review' : money(outcome.remainingCents)}</TableCell>
          <TableCell>{outcome.label}{row.lastVerifiedAt && <><br /><small>Transfer verified {new Date(row.lastVerifiedAt).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })}</small></>}
            {row.status !== 'VOID' && <><br /><Link href={`/staff/payments/mapping?invoice=${row.invoiceId}`}>Confirm customer and accounting details</Link></>}
          </TableCell>
        </TableRow>;
      })}</TableBody></Table></div>
      {!data.rows.length && <p>No issued invoices match this search.</p>}
      <nav aria-label="Finance pages">{offset > 0 && <Link href={href(Math.max(0, offset - 50))}>Previous page</Link>}{' '}{data.hasMore && offset < 10000 && <Link href={href(offset + 50)}>Next page</Link>}</nav>
    </>}
  </PageLayout>;
}
