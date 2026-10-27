'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Button, Select } from '@/components/ui/foundation/FoundationControls';
import ReadStatus from '@/components/page-state/ReadStatus';

import { Drawer } from './MarketingDrawer';

import { money, type HubFilters, type HubReport } from '@/lib/marketingPerformance/hub';

import { aucklandDay } from '@/lib/marketingPerformance/contract';

import { commercialTrend, comparison, contributions, commercialCoverage, historyCoverage, historyLabel, recordedMetricValue, type CommercialMetric } from '@/lib/marketingPerformance/commercial';

import useCommercial, { type CommercialLoader } from './useCommercial';
import { needsOverviewProjects, overviewProjectIds } from './overviewProjectSelection';

import CommercialRecords from './CommercialRecords';
import CommercialMetricStrip, { type CommercialMetricValue } from './CommercialMetricStrip';

import styles from './CommercialOverview.module.css';



const labels: Record<CommercialMetric, string> = { quoted: 'Quoted value', accepted: 'Accepted value', average: 'Average accepted quote', enquiryDays: 'Enquiry to first quote', acceptanceDays: 'First quote to acceptance' };

const compactMoney = (cents: number) => {
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1_000_000) return `$${(dollars / 1_000_000).toLocaleString('en-NZ', { maximumFractionDigits: 2 })}m`;
  if (Math.abs(dollars) >= 1000) return `$${(dollars / 1000).toLocaleString('en-NZ', { maximumFractionDigits: 1 })}k`;
  return money(cents);
};

export default function CommercialOverview({ hub, filters, apply, loader, synthetic, revision = 0, children, evidence, retryEvidence, projectError }: {

  hub: HubReport | null; projectError?:string; filters: HubFilters; apply: (filters: HubFilters) => void; loader?: CommercialLoader; synthetic?: boolean; revision?: number; children?: ReactNode; evidence?: ReturnType<typeof useCommercial>; retryEvidence?: () => void;

}) {

  const [retry, setRetry] = useState(0), [metric, setMetric] = useState<CommercialMetric | null>(null), [month, setMonth] = useState(''), [prior, setPrior] = useState(false);

  const local = useCommercial(evidence ? null : filters, revision + retry, loader);
  const { report, busy, error:readError } = evidence ?? local;
  const error=readError||(!hub&&needsOverviewProjects(filters)?projectError:'');
  const section = useRef<HTMLElement>(null);
  const metricControls=useRef<Partial<Record<CommercialMetric,HTMLButtonElement>>>({});
  const restoredDrawer=useRef(false),returnControl=useRef<HTMLButtonElement|null>(null);
  const controlRef=(key:CommercialMetric,node:HTMLButtonElement|null)=>{if(node)metricControls.current[key]=node;else delete metricControls.current[key];};
  useEffect(()=>{if(metric||!returnControl.current)return;const target=returnControl.current;returnControl.current=null;const timer=window.setTimeout(()=>{(target.isConnected&&!target.disabled?target:section.current)?.focus({preventScroll:true});},0);return()=>window.clearTimeout(timer);},[metric]);
  const geometryKey = () => `commercial-report-height:${window.innerWidth}`;
  // Geometry only, matching the existing report return-position policy. The hub
  // remounts child readers after refresh; no financial data is retained here.
  const [waitingHeight, setWaitingHeight] = useState<number | undefined>(() => { try { const n = Number(sessionStorage.getItem(geometryKey())); return n > 0 && n < 10000 ? n : undefined; } catch { return undefined; } });
  useLayoutEffect(() => { if (!busy && report && !error && section.current) { try { const height = section.current.getBoundingClientRect().height; if (height !== waitingHeight) setWaitingHeight(height); sessionStorage.setItem(geometryKey(), String(height)); } catch { /* Geometry recovery is optional. */ } } });

  useEffect(() => {

    const restore = () => { const q = new URLSearchParams(window.location.search), key = q.get('commercialMetric');

      restoredDrawer.current=Boolean(key&&Object.hasOwn(labels,key));
      setMetric(key && Object.hasOwn(labels, key) ? key as CommercialMetric : null); setMonth(q.get('commercialMonth') ?? ''); setPrior(q.get('commercialPeriod') === 'previous'); };

    restore(); window.addEventListener('popstate', restore); return () => window.removeEventListener('popstate', restore);

  }, []);

  const inspect = (key: CommercialMetric | null, selectedMonth = '', previous = false) => {

    restoredDrawer.current=false;setMetric(key); setMonth(selectedMonth); setPrior(previous);

    const url = new URL(window.location.href);

    for (const name of ['commercialMetric', 'commercialMonth', 'commercialPeriod']) url.searchParams.delete(name);

    if (key) { url.searchParams.set('commercialMetric', key); if (selectedMonth) url.searchParams.set('commercialMonth', selectedMonth); if (previous) url.searchParams.set('commercialPeriod', 'previous'); }

    window.history.replaceState(null, '', url);

  };

  const ready = Boolean(report && !busy && !error && (hub || !needsOverviewProjects(filters)));
  const pending = busy || (!hub && needsOverviewProjects(filters) && !projectError);
  const ids = overviewProjectIds(hub, filters), projectMap = new Map((hub?.projects ?? []).map(project => [project.id, project]));

  const rows = ready && report ? report.rows.filter(r => !ids || ids.has(r.projectId)) : [];
  const empty = { quoted: [], accepted: [], average: [], enquiryDays: [], acceptanceDays: [] };
  const current = ready && report ? contributions(report, rows) : empty, previous = ready && report ? contributions(report, rows, true) : empty;

  const undated = rows.filter(r => r.accepted && !r.accepted.acceptedAt).length;

  const currentCoverage = ready && report ? historyCoverage(report, report.start, report.end) : 'unavailable';
  const coverage = (key: CommercialMetric, prior = false) => ready && report ? commercialCoverage(report, rows, key, prior ? report.priorStart : report.start, prior ? report.priorEnd : report.end) : 'unavailable';
  const unallocated = rows.filter(r => r.undatedSendCount > 0);
  const sendNote = unallocated.length ? `${unallocated.length} scopes across all dates have ${unallocated.reduce((n,r) => n + r.undatedSendCount,0)} sent or accepted versions without a send date. Their send activity cannot be assigned to a period; quoted figures show dated records only.` : '';

  const trend = ready && report ? commercialTrend(report, current, filters.salesBucket, rows) : [];

  const selectedBucket = trend.find(b => b.key === month);

  const details = metric ? (prior ? previous : current)[metric].filter(r => !month || Boolean(selectedBucket && aucklandDay(new Date(r.at)) >= selectedBucket.start && aucklandDay(new Date(r.at)) <= selectedBucket.end)) : [];

  const detailStart = prior ? report?.priorStart ?? filters.start : selectedBucket?.start ?? report?.start ?? filters.start;
  const detailEnd = prior ? report?.priorEnd ?? filters.end : selectedBucket?.end ?? report?.end ?? filters.end;
  const detailCoverage = ready && report ? commercialCoverage(report, rows, metric ?? 'quoted', detailStart, detailEnd) : 'unavailable';
  const valueLabel = (key: CommercialMetric, value: number | null) => value === null ? 'Unavailable' : key.endsWith('Days') ? `${value.toFixed(1)} days` : money(value);

  return <section ref={section} tabIndex={-1} className={styles.section} aria-label="Commercial performance" style={{minHeight:pending?waitingHeight:undefined}}>

    <CommercialMetricStrip controlRef={controlRef} pending={pending} inspect={inspect} values={ready ? Object.fromEntries((['quoted','accepted','average'] as const).map(key => {
      const cover = coverage(key), value = recordedMetricValue(key,current[key],cover);
      return [key,{ value:value===null?'Unavailable':compactMoney(value), unavailable:value===null,
        note:<>{historyLabel(cover,current[key].length)}{cover!=='covered'?' · ':''}{current[key].length} recorded commercial {current[key].length===1?'scope':'scopes'}{key==='average'?' · per accepted scope':''}</> } satisfies CommercialMetricValue];
    })) : undefined}/>


    <div className={styles.basisRow}><ReadStatus title={pending?'Reading quote values and timing…':error?'Commercial report unavailable':ready&&!hub?'Quote source · project filters pending':'Quote source'} tone={error?'error':'neutral'} action={error?<Button onClick={()=>retryEvidence?retryEvidence():setRetry(n=>n+1)}>Retry commercial report</Button>:undefined} details={<>{pending?<p>{report?'Reading complete project filters…':'Reading quote values and timing…'}</p>:error?<p>{error} No partial values are shown.</p>:ready&&!hub?<p>Complete quote source read at {new Date(report!.asOf).toLocaleString('en-NZ',{timeZone:'Pacific/Auckland'})} NZ. Project context is still reading; these source figures will be checked against the completed project selection.</p>:<p>Quote scope values · NZD including GST · Selected dates, not invoices or cash received</p>}</>}/><p className={styles.basis}>Quote scope values · NZD including GST · Selected dates, not invoices or cash received</p>{ready&&<details className={styles.comparisons}><summary>Previous period comparison</summary><div>{(['quoted','accepted','average'] as const).map(key=>{const currentCoverage=coverage(key),priorCoverage=coverage(key,true),comparable=currentCoverage==='covered'&&priorCoverage==='covered';return <div key={key}><h3>{labels[key]}</h3><button className={styles.compare} onClick={()=>inspect(key,'',true)}>Previous: {valueLabel(key,recordedMetricValue(key,previous[key],priorCoverage))}{priorCoverage!=='covered'?` · ${historyLabel(priorCoverage,previous[key].length)}`:''}</button><small>{comparable?comparison(recordedMetricValue(key,current[key],currentCoverage),recordedMetricValue(key,previous[key],priorCoverage)):'Comparison unavailable · period history incomplete'}</small></div>;})}</div></details>}</div>
    {sendNote && <p className={styles.notice}>{sendNote}</p>}
    {undated > 0 && <p className={styles.notice}>{undated} currently accepted scopes across all dates have no acceptance date and cannot be assigned to either period.</p>}

    <div className={styles.lower}>

      <div><div className={styles.trendHeading}><h2>Quoted vs accepted value</h2><div className={styles.legend}><span><i/>Quoted value</span><span><i/>Accepted value</span></div>
        {ready&&<details className={styles.trendFigures}><summary>View trend figures</summary><div className={styles.table} tabIndex={0} role="region" aria-label="Commercial trend figures"><table><thead><tr><th>Period (NZ)</th><th>Quoted</th><th>Accepted</th></tr></thead><tbody>{trend.map(b => <tr key={b.key}><th>{b.start} – {b.end}{b.partial ? ' · partial dates' : ''}{b.coverage !== 'covered' && <small>{historyLabel(b.coverage, b.quotedCount + b.acceptedCount)}</small>}</th><td><button className={styles.compare} onClick={() => inspect('quoted', b.key)}>{b.quoted === null ? 'Unavailable' : money(b.quoted)} · {b.quotedCount} recorded scopes{b.quotedCoverage !== 'covered' ? ` · ${historyLabel(b.quotedCoverage,b.quotedCount)}` : ''}</button></td><td><button className={styles.compare} onClick={() => inspect('accepted', b.key)}>{b.accepted === null ? 'Unavailable' : money(b.accepted)} · {b.acceptedCount} recorded scopes</button></td></tr>)}</tbody></table></div></details>}
        <Select label="Group values by" value={filters.salesBucket} onChange={e => { inspect(null); apply({ ...filters, salesBucket: e.target.value as 'week' | 'month' }); }}><option value="week">Week</option><option value="month">Month</option></Select></div><p className={styles.note}>Within selected dates · first and last buckets may be partial{ready && currentCoverage !== 'covered' ? ' · Earlier history is incomplete; lines show recorded values only.' : ''}{unallocated.length > 0 ? ' · Quoted values are partial dated records; accepted values use acceptance dates.' : ''}</p>

        <div className={styles.chart}>{!ready?<p role="status">{pending?'Reading complete trend evidence…':'Trend evidence unavailable.'}</p>:trend.every(b => b.quoted === null && b.accepted === null) ? <p className={styles.note}>Incomplete history for these dates. No verified values to plot.</p> : <ResponsiveContainer width="100%" height="100%" minWidth={0}><LineChart data={trend} accessibilityLayer margin={{ left: 0, right: 20, top:12, bottom:12 }}>

          <CartesianGrid vertical={false} stroke="var(--ui-border)" strokeDasharray="2 3"/><XAxis dataKey="label" tick={{ fontSize: 12 }} minTickGap={32} tickMargin={12} tickLine={false}/><YAxis width={64} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={v => `$${Number(v) / 100000}k`}/><Tooltip labelFormatter={(_, payload) => { const b = payload?.[0]?.payload; return b ? `${b.start} – ${b.end}${b.coverage !== 'covered' ? ' · Partial recorded history' : ''}` : ''; }} formatter={(value, name, item) => [typeof value === 'number' ? money(value) : 'Unavailable', `${name}${name === 'Quoted' && item.payload?.quotedCoverage !== 'covered' ? ' · partial recorded history' : ''}`]}/>
          {(['quoted','accepted'] as const).map(key=><Line key={key} name={key==='quoted'?'Quoted':'Accepted'} dataKey={key} stroke={key==='quoted'?'var(--ui-action)':'var(--ui-text-strong)'} strokeWidth={2.5} connectNulls={false} isAnimationActive={false} activeDot={false} dot={({cx,cy,payload})=>payload[key]===null||!Number.isFinite(cx)||!Number.isFinite(cy)?<g key={`${key}:${payload.key}`}/>:<circle key={`${key}:${payload.key}`} cx={cx} cy={cy} r={5} fill={key==='quoted'?'var(--ui-action)':'var(--ui-text-strong)'} className={styles.point} role="button" tabIndex={0} aria-label={`Inspect ${labels[key]} ${payload.start} to ${payload.end}`} onClick={()=>inspect(key,payload.key)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();inspect(key,payload.key);}}}/>}/>)}
        </LineChart></ResponsiveContainer>}</div>

      </div>

      {children}
      <div className={styles.timingSection}><h2>Time to move forward</h2><p className={styles.note}>Median elapsed days · initial scopes only, excluding add-ons</p>
        <CommercialMetricStrip controlRef={controlRef} timing pending={pending} inspect={inspect} values={ready?Object.fromEntries((['enquiryDays','acceptanceDays'] as const).map(key=>{
          const cover=coverage(key), priorCover=coverage(key,true), value=recordedMetricValue(key,current[key],cover);
          return [key,{value:valueLabel(key,value),unavailable:value===null,note:<>{current[key].filter(row=>row.days!==null).length} of {current[key].length} recorded eligible scopes have usable dates{cover!=='covered'&&<small>{historyLabel(cover,current[key].length)}</small>}<small>{priorCover==='covered'?`Previous: ${valueLabel(key,recordedMetricValue(key,previous[key],priorCover))}`:`Previous: ${valueLabel(key,recordedMetricValue(key,previous[key],priorCover))} · ${historyLabel(priorCover,previous[key].length)}`}</small></>} satisfies CommercialMetricValue];
        })):undefined}/>
        {unallocated.some(row=>row.scopeKind==='base')&&<p className={styles.note}>Missing send history makes the first send uncertain. Affected date pairs are excluded; scopes with no dated send cannot enter an enquiry timing period.</p>}
      </div>

    </div>

    {ready&&report&&<details><summary>How these figures are counted</summary><div className={styles.note}>
      <p>Previous period: {report.priorStart} – {report.priorEnd}, same number of days.</p>
      {synthetic && <a className={styles.compare} href={`?${new URLSearchParams({ representative: '1', view: 'overview', start: '2026-08-01', end: '2026-09-22', commercialCoverage: '1' })}`}>Demo: missing history and add-on scope</a>}

      <p>Quoted value uses the latest version sent within this period for each quote family (commercial scope). Revisions count once within the whole selected period; a scope revised later can appear again in another period. Trend points partition those exact records and add up to the headline.</p>

      <p>Accepted value uses the authoritative currently accepted version of each scope, dated by its recorded acceptance. Withdrawals or replacement acceptances can restate historical totals. Separate add-on scopes are included in values and the average, not counted as duplicate versions. These are not invoiced revenue, receipts or a win rate.</p>

      <p>Enquiry timing covers initial scopes first sent during the selected period, starting at the earliest saved enquiry. Acceptance timing covers currently accepted initial scopes accepted during the period, starting at their first recorded send. Any known send without a date makes that first-send timing uncertain. These pairs and missing or out-of-order dates are excluded from the median and remain visible in records. Manual projects without an enquiry are not assigned a guessed enquiry date.</p>

      <p>Recorded quote history starts {report.earliestSentAt ? aucklandDay(new Date(report.earliestSentAt)) : 'at an unknown date'}. Earlier empty periods do not establish zero business activity. Comparisons use adjacent equal day counts; a zero previous amount has no percentage growth. Empty timing and average cohorts are unavailable, not zero. Missing amounts withhold that total.</p>

      <p>Current project/source filters apply to both periods using the original consent-permitted enquiry source. Quote values follow the existing NZD, GST-inclusive quote document contract. Read at {new Date(report.asOf).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })} NZ.</p>

    </div></details>}

    <Drawer title={metric ? `${labels[metric]}${month ? ` · ${month}` : ''}${prior ? ' · Previous period' : ''}` : 'Commercial records'} open={metric !== null} onClose={() => {if(restoredDrawer.current&&metric)returnControl.current=metricControls.current[metric]??null;inspect(null);}}>

      {metric && hub && <CommercialRecords key={`${metric}:${month}:${prior}:${filters.start}:${filters.end}`} metric={metric} rows={details} projects={projectMap} synthetic={synthetic} unallocated={metric === 'quoted' ? unallocated : metric.endsWith('Days') ? unallocated.filter(r => r.scopeKind === 'base') : []} summary={valueLabel(metric, recordedMetricValue(metric, details, detailCoverage))} context={`${detailStart} – ${detailEnd} NZ${detailCoverage !== 'covered' ? ` · ${historyLabel(detailCoverage, details.length)}. These records do not establish the full period total or cohort.` : ''}`}/>}

      {metric && !hub && <p role="status">Reading project names and supporting evidence…</p>}
    </Drawer>

  </section>;

}
