'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Button, Select } from '@/components/ui/foundation/FoundationControls';

import { Drawer } from '@/components/ui/drawer/Drawer';

import { selectHub, money, type HubFilters, type HubReport } from '@/lib/marketingPerformance/hub';

import { aucklandDay } from '@/lib/marketingPerformance/contract';

import { commercialTrend, comparison, contributions, metricValue, type CommercialMetric } from '@/lib/marketingPerformance/commercial';

import useCommercial, { type CommercialLoader } from './useCommercial';

import CommercialRecords from './CommercialRecords';

import styles from './CommercialOverview.module.css';



const labels: Record<CommercialMetric, string> = { quoted: 'Quoted value', accepted: 'Accepted value', average: 'Average accepted quote', enquiryDays: 'Enquiry to first quote', acceptanceDays: 'First quote to acceptance' };

export default function CommercialOverview({ hub, filters, apply, loader, synthetic, revision = 0 }: {

  hub: HubReport; filters: HubFilters; apply: (filters: HubFilters) => void; loader?: CommercialLoader; synthetic?: boolean; revision?: number;

}) {

  const [retry, setRetry] = useState(0), [metric, setMetric] = useState<CommercialMetric | null>(null), [month, setMonth] = useState(''), [prior, setPrior] = useState(false);

  const { report, busy, error } = useCommercial(filters, revision + retry, loader);
  const section = useRef<HTMLElement>(null);
  const geometryKey = () => `commercial-report-height:${window.innerWidth}`;
  // Geometry only, matching the existing report return-position policy. The hub
  // remounts child readers after refresh; no financial data is retained here.
  const [waitingHeight, setWaitingHeight] = useState<number | undefined>(() => { try { const n = Number(sessionStorage.getItem(geometryKey())); return n > 0 && n < 10000 ? n : undefined; } catch { return undefined; } });
  useLayoutEffect(() => { if (!busy && report && !error && section.current) { try { const height = section.current.getBoundingClientRect().height; if (height !== waitingHeight) setWaitingHeight(height); sessionStorage.setItem(geometryKey(), String(height)); } catch { /* Geometry recovery is optional. */ } } });

  useEffect(() => {

    const restore = () => { const q = new URLSearchParams(window.location.search), key = q.get('commercialMetric');

      setMetric(key && Object.hasOwn(labels, key) ? key as CommercialMetric : null); setMonth(q.get('commercialMonth') ?? ''); setPrior(q.get('commercialPeriod') === 'previous'); };

    restore(); window.addEventListener('popstate', restore); return () => window.removeEventListener('popstate', restore);

  }, []);

  const inspect = (key: CommercialMetric | null, selectedMonth = '', previous = false) => {

    setMetric(key); setMonth(selectedMonth); setPrior(previous);

    const url = new URL(window.location.href);

    for (const name of ['commercialMetric', 'commercialMonth', 'commercialPeriod']) url.searchParams.delete(name);

    if (key) { url.searchParams.set('commercialMetric', key); if (selectedMonth) url.searchParams.set('commercialMonth', selectedMonth); if (previous) url.searchParams.set('commercialPeriod', 'previous'); }

    window.history.replaceState(null, '', url);

  };

  if (busy) return <section className={styles.section} style={{ minHeight: waitingHeight }} aria-label="Commercial performance" aria-busy="true"><h2>Commercial performance</h2><p role="status">Reading quote values and timing…</p></section>;

  if (!report || error) return <section className={styles.section} style={{ minHeight: waitingHeight }} aria-label="Commercial performance"><h2>Commercial performance</h2><p role="alert">{error || 'Commercial evidence unavailable.'} No partial values are shown.</p><Button onClick={() => setRetry(n => n + 1)}>Retry commercial report</Button></section>;

  const selected = selectHub(hub, { ...filters, inspect: 'all' }), ids = new Set(selected.projects.map(p => p.id));

  const rows = report.rows.filter(r => ids.has(r.projectId)), current = contributions(report, rows), previous = contributions(report, rows, true);

  const undated = rows.filter(r => r.accepted && !r.accepted.acceptedAt).length;

  const priorCovered = Boolean(report.earliestSentAt && report.priorStart >= aucklandDay(new Date(report.earliestSentAt)));

  const trend = commercialTrend(report, current, filters.salesBucket);

  const selectedBucket = trend.find(b => b.key === month);

  const details = metric ? (prior ? previous : current)[metric].filter(r => !month || Boolean(selectedBucket && aucklandDay(new Date(r.at)) >= selectedBucket.start && aucklandDay(new Date(r.at)) <= selectedBucket.end)) : [];

  const valueLabel = (key: CommercialMetric, value: number | null) => value === null ? 'Unavailable' : key.endsWith('Days') ? `${value.toFixed(1)} days` : money(value);

  return <section ref={section} className={styles.section} aria-label="Commercial performance">

    <div className={styles.heading}><h2>Commercial performance</h2><span className={styles.note}>{filters.start} – {filters.end} · NZ dates</span></div>

    {synthetic && <a className={styles.compare} href={`?${new URLSearchParams({ representative: '1', view: 'overview', start: '2026-08-01', end: '2026-09-22', commercialCoverage: '1' })}`}>Demo: missing history and add-on scope</a>}
    <p className={styles.note}>NZD including GST · Quote scope values, not invoices or cash received. Select a figure to inspect its records.</p>

    <div className={styles.metrics}>{(['quoted', 'accepted', 'average'] as const).map(key => <div className={styles.metric} key={key}>

      <button onClick={() => inspect(key)} aria-label={`Inspect ${labels[key]}`}><span>{labels[key]}</span><strong>{valueLabel(key, metricValue(key, current[key]))}</strong><small>{current[key].length} commercial {current[key].length === 1 ? 'scope' : 'scopes'}{key === 'average' ? ' · per accepted scope' : ''}</small></button>

      <button className={styles.compare} onClick={() => inspect(key, '', true)}>Previous: {priorCovered ? valueLabel(key, metricValue(key, previous[key])) : 'Incomplete history'}</button>

      <small>{priorCovered ? comparison(metricValue(key, current[key]), metricValue(key, previous[key])) : 'Comparison unavailable · earlier history incomplete'}</small>

    </div>)}</div>

    <p className={styles.note}>Previous period: {report.priorStart} – {report.priorEnd}, same number of days. {undated > 0 && `${undated} currently accepted scopes across all dates have no acceptance date and cannot be assigned to either period.`}</p>

    <div className={styles.lower}>

      <div><h3>Quote and acceptance values</h3><Select label="Group values by" value={filters.salesBucket} onChange={e => { inspect(null); apply({ ...filters, salesBucket: e.target.value as 'week' | 'month' }); }}><option value="week">Week</option><option value="month">Month</option></Select><p className={styles.note}>Within selected dates · first and last buckets may be partial</p>

        <div className={styles.chart}><ResponsiveContainer width="100%" height={260} minWidth={0}><BarChart data={trend} accessibilityLayer margin={{ left: 0, right: 8 }}>

          <CartesianGrid vertical={false} stroke="var(--ui-border)"/><XAxis dataKey="label" tick={{ fontSize: 12 }}/><YAxis width={60} tick={{ fontSize: 12 }} tickFormatter={v => `$${Number(v) / 100000}k`}/><Tooltip formatter={value => typeof value === 'number' ? money(value) : 'Unavailable'}/><Legend/>

          <Bar name="Quoted" dataKey="quoted" fill="#276987" isAnimationActive={false} onClick={(_, i) => { if (trend[i]) inspect('quoted', trend[i].key); }} cursor="pointer"/>

          <Bar name="Accepted" dataKey="accepted" fill="#936022" isAnimationActive={false} onClick={(_, i) => { if (trend[i]) inspect('accepted', trend[i].key); }} cursor="pointer"/>

        </BarChart></ResponsiveContainer></div>

        <details><summary>View trend figures</summary><div className={styles.table} tabIndex={0} role="region" aria-label="Commercial trend figures"><table><thead><tr><th>Period (NZ)</th><th>Quoted</th><th>Accepted</th></tr></thead><tbody>{trend.map(b => <tr key={b.key}><th>{b.start} – {b.end}{b.partial ? ' · partial' : ''}</th><td><button className={styles.compare} onClick={() => inspect('quoted', b.key)}>{b.quoted === null ? 'Unavailable' : money(b.quoted)} · {b.quotedCount} scopes</button></td><td><button className={styles.compare} onClick={() => inspect('accepted', b.key)}>{b.accepted === null ? 'Unavailable' : money(b.accepted)} · {b.acceptedCount} scopes</button></td></tr>)}</tbody></table></div></details>

      </div>

      <div><h3>Time to move forward</h3><p className={styles.note}>Median elapsed days · initial scopes only, excluding add-ons</p><div className={styles.timing}>{(['enquiryDays', 'acceptanceDays'] as const).map(key => <button key={key} onClick={() => inspect(key)}>

        <span>{labels[key]}</span><strong>{valueLabel(key, metricValue(key, current[key]))}</strong><small>{current[key].filter(r => r.days !== null).length} of {current[key].length} eligible scopes have usable dates</small><small>{priorCovered ? `Previous: ${valueLabel(key, metricValue(key, previous[key]))}` : 'Earlier history incomplete'}</small>

      </button>)}</div></div>

    </div>

    <details><summary>How these figures are counted</summary><div className={styles.note}>

      <p>Quoted value uses the latest version sent within this period for each quote family (commercial scope). Revisions count once within the whole selected period; a scope revised later can appear again in another period. Trend bars partition those exact records and add up to the headline.</p>

      <p>Accepted value uses the authoritative currently accepted version of each scope, dated by its recorded acceptance. Withdrawals or replacement acceptances can restate historical totals. Separate add-on scopes are included in values and the average, not counted as duplicate versions. These are not invoiced revenue, receipts or a win rate.</p>

      <p>Enquiry timing covers initial scopes first sent during the selected period, starting at the earliest saved enquiry. Acceptance timing covers currently accepted initial scopes accepted during the period, starting at their first recorded send. Missing or out-of-order dates are excluded from the median and remain visible in records. Manual projects without an enquiry are not assigned a guessed enquiry date.</p>

      <p>Recorded quote history starts {report.earliestSentAt ? aucklandDay(new Date(report.earliestSentAt)) : 'at an unknown date'}. Earlier empty periods do not establish zero business activity. Comparisons use adjacent equal day counts; a zero previous amount has no percentage growth. Empty timing and average cohorts are unavailable, not zero. Missing amounts withhold that total.</p>

      <p>Current project/source filters apply to both periods using the original consent-permitted enquiry source. Quote values follow the existing NZD, GST-inclusive quote document contract. Read at {new Date(report.asOf).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })} NZ.</p>

    </div></details>

    <Drawer title={metric ? `${labels[metric]}${month ? ` · ${month}` : ''}${prior ? ' · Previous period' : ''}` : 'Commercial records'} open={metric !== null} onClose={() => inspect(null)}>

      {metric && <CommercialRecords key={`${metric}:${month}:${prior}:${filters.start}:${filters.end}`} metric={metric} rows={details} projects={selected.projectMap} synthetic={synthetic} summary={valueLabel(metric, metricValue(metric, details))}/>}

    </Drawer>

  </section>;

}
