'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';
import { PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import { Button, ButtonLink, Input, Select } from '@/components/ui/foundation/FoundationControls';
import { DataStatePanel } from '@/components/ui/foundation/FoundationFeedback';
import { invoiceViews, quoteViews, parseRegisterQuery, registerHref, registerParams, registerSchema, type RegisterData } from '@/lib/finance/register';
import RegisterTable from './RegisterTable';
import RegisterSummary from './RegisterSummary';
import styles from './FinanceRegister.module.css';

type Loaded = { key: string; data: RegisterData };
/** URL-owned filters and selection survive row detail, job visits and Back. */
export default function FinanceRegister({ basePath = '/staff/payments', apiPath = '/api/payments/register' }: { basePath?: string; apiPath?: string }) {
  const params = useSearchParams();
  const query = parseRegisterQuery(new URLSearchParams(params.toString()));
  const key = registerParams(query).toString();
  const href = (next: typeof query) => registerHref(next, basePath);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<'unavailable' | 'denied' | null>(null);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState(query.search);
  useEffect(() => setSearch(query.search), [query.search]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setBusy(true); setError(null);
    const timeout = setTimeout(() => controller.abort(), 20000);
    fetch(`${apiPath}${apiPath.includes('?') ? '&' : '?'}${key}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (response.status === 403) { if (active) { setLoaded(null); setError('denied'); } return; }
        if (!response.ok) throw new Error('unavailable');
        const data = registerSchema.parse(await response.json());
        if (active) setLoaded({ key, data });
      }).catch(() => { if (active) setError('unavailable'); })
      .finally(() => { clearTimeout(timeout); if (active) setBusy(false); });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [key, revision, apiPath]);
  const data = loaded?.data;
  const stale = Boolean(loaded && (loaded.key !== key || busy || error));
  const current = loaded?.key === key;
  const resultQuery = loaded ? parseRegisterQuery(new URLSearchParams(loaded.key)) : query;
  const views = query.tab === 'quotes' ? quoteViews : invoiceViews;
  const navigate = (href: string) => window.history.pushState(null, '', href);
  const selected = params.get('selected');
  return <PageLayout width="full" density="compact" className={styles.page}>
    <PageHeader variant="index" title="Finance" />
    <nav className={styles.tabs} aria-label="Finance sections">
      <Link href={href({ ...query, tab: 'invoices', view: 'outstanding', offset: 0 })} aria-current={query.tab === 'invoices' ? 'page' : undefined}>Invoices</Link>
      <Link href={href({ ...query, tab: 'quotes', view: 'awaiting', offset: 0 })} aria-current={query.tab === 'quotes' ? 'page' : undefined}>Quotes</Link>
      <Link className={styles.xeroLink} href="/staff/payments?tab=xero&view=attention">Xero checks <span aria-hidden="true">↗</span></Link>
    </nav>
    <RegisterSummary data={data} query={resultQuery} stale={stale} pending={busy} />
    <form className={styles.filters} onSubmit={event => { event.preventDefault(); navigate(href({ ...query, search, offset: 0 })); }}>
      <label className={styles.viewFilter}>View<Select name="view" value={query.view} onChange={event => navigate(href({ ...query, view: event.target.value, offset: 0 }))}>
        {views.filter(([view]) => view !== 'drafts' || query.tab === 'quotes' || data?.draftsAllowed !== false).map(([view, label]) => <option key={view} value={view}>{label}</option>)}
      </Select></label>
      <div className={styles.search}><label htmlFor="finance-search">Search {query.tab}</label><div className={styles.searchControl}><Input id="finance-search" name="search" value={search} onChange={event => setSearch(event.target.value)} maxLength={120} placeholder="Number, customer or job" /><Button type="submit" variant="secondary">Search</Button></div></div>
      <label className={styles.deliveryFilter}>Portal delivery<Select name="delivery" value={query.sent} onChange={event => navigate(href({ ...query, sent: event.target.value as typeof query.sent, offset: 0 }))}>
        <option value="all">All delivery states</option><option value="sent">Sent from Portal</option><option value="needs">Needs sending / recovery</option><option value="pending">Delivery pending</option>
      </Select></label>
      <Button type="button" variant="tertiary" className={styles.sentFilter} aria-pressed={query.sent === 'sent'} onClick={() => navigate(href({ ...query, sent: query.sent === 'sent' ? 'all' : 'sent', offset: 0 }))}><span aria-hidden="true" className={styles.checkBox}>{query.sent === 'sent' && <Check />}</span>Sent from Portal</Button>
      <Button type="button" variant="tertiary" className={styles.refresh} aria-label="Refresh" title="Refresh records" disabled={busy} onClick={() => setRevision(n => n + 1)}><RefreshCw aria-hidden="true" /></Button>
    </form>
    <section aria-label="Register results" aria-busy={busy} className={styles.results}>
      <div className={styles.status} role="status" aria-live="polite">
        {error === 'denied' ? 'Finance access is no longer available for this account.'
          : error ? <span>Finance could not be refreshed.{data ? ' Previously checked records remain below.' : ''} <Button variant="tertiary" size="small" onClick={() => setRevision(n => n + 1)}>Try again</Button></span>
          : busy ? loaded ? 'Checking the latest records. Previous results remain visible.' : 'Loading finance records…'
          : data ? `Checked ${new Date(data.checkedAt).toLocaleString('en-NZ', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Pacific/Auckland' })}` : ''}
        {(query.search || query.sent !== 'all') && <Link className={styles.clearFilters} href={href({ ...query, search: '', sent: 'all', offset: 0 })}>Clear filters</Link>}
      </div>
      {data && <>
        {resultQuery.tab === 'quotes' && <p className={styles.note}>One relevant version per family. Open a quote for revisions and history.</p>}
        <RegisterTable rows={data.rows} tab={resultQuery.tab} checkedAt={data.checkedAt}
          selected={selected} disabled={stale && !current} select={id => {
            const next = new URLSearchParams(params.toString());
            if (id === selected) next.delete('selected'); else next.set('selected', id);
            navigate(`${basePath}?${next}`);
          }} emptyMessage={<DataStatePanel state={query.search || query.sent !== 'all' ? 'filtered-empty' : 'empty'}
            title={query.offset > 0 ? 'No more records on this page' : 'No matching records'}
            description={query.offset > 0 ? 'Return to the first page or adjust the filters.' : 'Try another view or clear the filters.'} />} />
        {current && <nav className={styles.pagination} aria-label="Register pages">
          {query.offset > 0 && <ButtonLink variant="secondary" size="small" href={href({ ...query, offset: Math.max(0, query.offset - 50) })}>Previous</ButtonLink>}
          <span>{data.count ? `${Math.min(query.offset + 1, data.count)}–${Math.min(query.offset + 50, data.count)} of ${data.count}` : '0 records'}</span>
          {data.hasMore && <ButtonLink variant="secondary" size="small" href={href({ ...query, offset: query.offset + 50 })}>Next</ButtonLink>}
          {query.offset > 0 && !data.rows.length && <ButtonLink variant="tertiary" href={href({ ...query, offset: 0 })}>First page</ButtonLink>}
        </nav>}
      </>}
      {!data && error === 'unavailable' && <DataStatePanel state="error" title="Finance could not be loaded" description="Try again to check the current position. No records have changed." />}
      {!data && <RegisterTable rows={[]} tab={query.tab} selected={null} disabled select={() => {}} pending={busy}
        emptyMessage={error === 'denied' ? 'Finance access is not available.' : 'No checked records are available.'} />}
    </section>
  </PageLayout>;
}
