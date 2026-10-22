'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';
import { PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import { Button, ButtonLink, Input, Select } from '@/components/ui/foundation/FoundationControls';
import { DataStatePanel } from '@/components/ui/foundation/FoundationFeedback';
import { invoiceViews, quoteViews, parseRegisterQuery, registerHref, registerParams, registerSchema, type RegisterData } from '@/lib/finance/register';
import RegisterTable from './RegisterTable';
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
    <PageHeader variant="index" title="Finance" description="Quotes, invoices and the money still to come in." />
    <nav className={styles.tabs} aria-label="Finance sections">
      <ButtonLink href={href({ ...query, tab: 'invoices', view: 'outstanding', offset: 0 })} variant={query.tab === 'invoices' ? 'primary' : 'secondary'} aria-current={query.tab === 'invoices' ? 'page' : undefined}>Invoices</ButtonLink>
      <ButtonLink href={href({ ...query, tab: 'quotes', view: 'awaiting', offset: 0 })} variant={query.tab === 'quotes' ? 'primary' : 'secondary'} aria-current={query.tab === 'quotes' ? 'page' : undefined}>Quotes</ButtonLink>
      <ButtonLink href="/staff/payments?tab=xero&view=attention" variant="tertiary">Xero checks</ButtonLink>
    </nav>
    <div className={styles.toolbar}>
      <nav className={styles.views} aria-label={`${query.tab === 'quotes' ? 'Quote' : 'Invoice'} views`}>
        {views.filter(([view]) => view !== 'drafts' || query.tab === 'quotes' || data?.draftsAllowed !== false).map(([view, label]) =>
          <Link key={view} href={href({ ...query, view, offset: 0 })} aria-current={query.view === view ? 'page' : undefined}>{label}</Link>)}
      </nav>
      <Button variant="secondary" size="small" disabled={busy} onClick={() => setRevision(n => n + 1)}>{busy ? 'Checking…' : 'Refresh'}</Button>
    </div>
    <form className={styles.filters} onSubmit={event => { event.preventDefault(); navigate(href({ ...query, search, offset: 0 })); }}>
      <label className={styles.search}>Search {query.tab}<Input name="search" value={search} onChange={event => setSearch(event.target.value)} maxLength={120} placeholder="Number, customer or job" /></label>
      <label>Portal delivery<Select value={query.sent} onChange={event => navigate(href({ ...query, sent: event.target.value as typeof query.sent, offset: 0 }))}>
        <option value="all">All delivery states</option><option value="sent">Sent from Portal</option><option value="needs">Needs sending / recovery</option><option value="pending">Delivery pending</option>
      </Select></label>
      <Button type="submit" variant="secondary">Search</Button>
      {(query.search || query.sent !== 'all') && <ButtonLink variant="tertiary" href={href({ ...query, search: '', sent: 'all', offset: 0 })}>Clear filters</ButtonLink>}
    </form>
    <section aria-label="Register results" aria-busy={busy} className={styles.results}>
      <div className={styles.status} role="status" aria-live="polite">
        {error === 'denied' ? 'Finance access is no longer available for this account.'
          : error ? <span>Finance could not be refreshed.{data ? ' Previously checked records remain below.' : ''} <Button variant="tertiary" size="small" onClick={() => setRevision(n => n + 1)}>Try again</Button></span>
          : busy ? loaded ? 'Checking the latest records. Previous results remain visible.' : 'Loading finance records…'
          : data ? `Portal records checked ${new Date(data.checkedAt).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })}.` : ''}
      </div>
      {data && <>
        <div className={styles.summary} data-stale={stale || undefined}>
          <p><strong>{data.count}</strong> matching {resultQuery.tab === 'quotes' ? 'quote families' : 'invoices'}{stale ? ' in the previous results' : ''}</p>
          {data.totals.map(total => <div key={total.currency}>
            <strong>{new Intl.NumberFormat('en-NZ', { style: 'currency', currency: total.currency, currencyDisplay: 'code' }).format((resultQuery.tab === 'quotes' || resultQuery.view === 'drafts' ? total.totalCents : resultQuery.view === 'paid' ? total.paidCents : total.balanceCents) / 100)}</strong>
            <span>{resultQuery.tab === 'quotes' ? 'quote value, incl GST' : resultQuery.view === 'drafts' ? 'draft value, incl GST' : resultQuery.view === 'paid' ? 'recorded paid, incl GST' : 'recorded owing, incl GST'}{total.unconfirmedCount > 0 ? ` · ${total.unconfirmedCount} needing checks excluded` : ''}</span>
          </div>)}
        </div>
        {resultQuery.tab === 'quotes' && <p className={styles.note}>One relevant version per quote family. Current agreements, draft revisions and earlier versions remain visible in details.</p>}
        <RegisterTable rows={data.rows} tab={resultQuery.tab}
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
