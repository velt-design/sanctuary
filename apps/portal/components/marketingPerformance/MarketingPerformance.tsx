'use client';

import { useEffect, useState } from 'react';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import PageHeader from '@/components/layout/PageHeader';
import { Button, Input, Select } from '@/components/ui/foundation/FoundationControls';
import { PageLayout, Card } from '@/components/ui/foundation/FoundationSurfaces';
import { AlertBanner } from '@/components/ui/foundation/FoundationAlert';
import { MetricGrid } from '@/components/ui/foundation/FoundationOperational';
import { defaultFilters, filteredRows, rate, summarize, validPeriod,
  type Filters, UNKNOWN_SOURCE, NO_CAMPAIGN } from '@/lib/marketingPerformance/contract';
import PerformanceEvidence from './PerformanceEvidence';
import PerformanceComparison from './PerformanceComparison';
import PerformanceDefinitions from './PerformanceDefinitions';
import DateRangeShortcuts from './DateRangeShortcuts';
import PerformanceTrends from './PerformanceTrends';
import useMarketingReports, { loadReport, type ReportLoader } from './useMarketingReports';
import useReportReturnPosition from './useReportReturnPosition';
import styles from './MarketingPerformance.module.css';

export type { ReportLoader } from './useMarketingReports';
function savedFilters(fallback: Filters): Filters {
  const query = new URLSearchParams(window.location.search);
  return { start: query.get('start') ?? fallback.start, end: query.get('end') ?? fallback.end,
    source: query.get('source') ?? '', campaign: query.get('campaign') ?? '' };
}

export default function MarketingPerformance({ loader = loadReport, synthetic = false, initialFilters, staging = false }: {
  loader?: ReportLoader; synthetic?: boolean; initialFilters?: Filters; staging?: boolean;
}) {
  const [draft, setDraft] = useState<Filters>(() => initialFilters ?? defaultFilters());
  const [applied, setApplied] = useState<Filters | null>(null);
  const [validation, setValidation] = useState('');
  const [revision, setRevision] = useState(0);
  const { report, previous, busy, error, comparisonError } = useMarketingReports(applied, revision, loader);
  const position = useReportReturnPosition(busy);
  useEffect(() => {
    const restore = () => { const filters = savedFilters(initialFilters ?? defaultFilters()); setDraft(filters); setApplied(filters); };
    restore(); window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [initialFilters]);
  const rows = report && applied ? filteredRows(report, applied) : [];
  const totals = summarize(rows);
  const filterRows = [...(report?.rows ?? []), ...(previous?.rows ?? [])];
  const sources = [...new Set([UNKNOWN_SOURCE, ...filterRows.map(row => row.source ?? UNKNOWN_SOURCE), draft.source].filter(Boolean))].sort();
  const campaigns = [...new Set([NO_CAMPAIGN, ...filterRows.map(row => row.campaign ?? NO_CAMPAIGN), draft.campaign].filter(Boolean))].sort();
  const apply = (filters: Filters) => {
    if (!validPeriod(filters.start, filters.end)) { setValidation('Choose valid dates, up to 366 days ending today or earlier.'); return; }
    setValidation('');
    const url = new URL(window.location.href);
    url.searchParams.delete('evidence'); url.searchParams.delete('page');
    for (const [key, value] of Object.entries(filters)) { if (value) url.searchParams.set(key, value); else url.searchParams.delete(key); }
    window.history.replaceState(window.history.state, '', url);
    setDraft(filters); setApplied(filters);
  };
  const Header = synthetic ? PageHeader : StaffPageHeader;
  return <PageLayout className={styles.page}>
    <Header variant="index" title="Marketing Performance" description="From first enquiry to a worthwhile project." />
    {(synthetic || staging) && <p className={styles.environmentLabel}>{synthetic ? 'Synthetic preview · Illustrative records, not business results' : 'Staging preview · Test records, not live business results'}</p>}
    <Card title="Enquiries received in this period" padding="compact">
      <DateRangeShortcuts start={draft.start} end={draft.end} onSelect={dates => apply({ ...draft, ...dates })} />
      <form className={styles.filters} onSubmit={event => { event.preventDefault(); apply(draft); }}>
        <Input type="date" label="From" value={draft.start} required onChange={event => setDraft({ ...draft, start: event.target.value })} />
        <Input type="date" label="To" value={draft.end} required onChange={event => setDraft({ ...draft, end: event.target.value })} />
        <Select label="Observed source" value={draft.source} onChange={event => setDraft({ ...draft, source: event.target.value })}>
          <option value="">All sources</option>{sources.map(source => <option key={source}>{source}</option>)}
        </Select>
        <Select label="Campaign" value={draft.campaign} onChange={event => setDraft({ ...draft, campaign: event.target.value })}>
          <option value="">All campaigns</option>{campaigns.map(campaign => <option key={campaign}>{campaign}</option>)}
        </Select>
        <Button type="submit">Apply filters</Button>
      </form>
      <div className={styles.filterNote} aria-live="polite">{validation || 'Auckland dates, inclusive. Shows subsequent outcomes as of the latest read — not sales completed in this period.'}</div>
    </Card>
    <div ref={position.region} className={styles.results} style={{ minHeight: position.height }} onClickCapture={position.remember} aria-busy={busy}>
      {busy ? <Card title="Loading reporting evidence"><p role="status">Reading enquiries and their linked project outcomes…</p></Card>
        : error ? <AlertBanner tone="error" title="Report unavailable" action={<Button variant="secondary" onClick={() => setRevision(value => value + 1)}>Retry</Button>}>{error} No partial totals are shown.</AlertBanner>
        : report && applied ? <>
          <div className={styles.readStatus}><span><strong>{applied.start} – {applied.end}</strong> · {applied.source || 'All sources'} · {applied.campaign || 'All campaigns'}</span>
            <span>Read {new Date(report.asOf).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland', dateStyle: 'medium', timeStyle: 'short' })} NZ time <Button variant="quiet" onClick={() => setRevision(value => value + 1)}>Refresh</Button></span></div>
          <MetricGrid columns={3} ariaLabel="Verified business outcomes" items={[
            { label: 'Enquiries received', value: totals.enquiries, detail: `${totals.projects} linked projects · ${totals.repeats} repeat submissions` },
            { label: 'Qualified enquiries', value: totals.qualified, detail: `${rate(totals.qualified, totals.eligible)} of ${totals.eligible} eligible configured residential enquiries · ${totals.unreviewed} awaiting review` },
            { label: 'Confirmed visits', value: totals.visit, detail: `${rate(totals.visit, totals.origins)} of ${totals.origins} origin projects${report.visitHistoryAvailable ? '' : ' · Current confirmed status only; historical confirmations unavailable'}` },
            { label: 'Quotes sent', value: totals.quote, detail: `${rate(totals.quote, totals.origins)} of origin projects` },
            { label: 'Accepted quotes', value: totals.accepted, detail: `${rate(totals.accepted, totals.origins)} of origin projects · current accepted scope` },
            { label: 'Won projects', value: totals.won, detail: `${rate(totals.won, totals.origins)} of origin projects · payment evidence` },
          ]} />
          <div className={styles.coverage}><strong>Attribution coverage: {rate(totals.attributed, totals.enquiries)}</strong><span>{totals.attributed} of {totals.enquiries} enquiries have an observed source. {totals.enquiries - totals.attributed} are unknown / unattributed.</span></div>
          {!rows.length && <p className={styles.muted}>No enquiries match. Try a wider date range or clear source and campaign filters.</p>}
          <PerformanceTrends rows={rows} filters={applied} previous={previous} comparisonError={comparisonError} onRetry={() => setRevision(value => value + 1)} />
          <PerformanceComparison rows={rows} onInspect={(source, campaign) => apply({ ...applied, source, campaign })} />
          <div className={styles.twoColumns}>
            <Card title="Where progression is missing">
              <p><strong>{totals.lost}</strong> origin projects are explicitly recorded as lost.</p>
              <p><strong>{totals.origins - totals.quote}</strong> have no sent-quote evidence; <strong>{totals.origins - totals.won}</strong> have no verified win.</p>
              <p className={styles.muted}>Open projects may still progress. Stages can be skipped; missing evidence is not proof of a lost customer. Inspect records below.</p>
            </Card>
            <Card title="Spend and acquisition cost">
              <dl className={styles.costs}><dt>Verified spend</dt><dd>Unavailable</dd><dt>Cost / qualified enquiry</dt><dd>Unavailable</dd><dt>Cost / won project</dt><dd>Unavailable</dd></dl>
              <p className={styles.muted}>No verified spend dataset is connected. Missing spend is not zero. A small evidence-backed CSV import is proposed.</p>
            </Card>
          </div>
          <PerformanceEvidence key={JSON.stringify(applied)} rows={rows} synthetic={synthetic} />
          <PerformanceDefinitions excludedTests={report.excludedTests} unlinked={totals.unlinked} />
        </> : null}
    </div>
  </PageLayout>;
}
