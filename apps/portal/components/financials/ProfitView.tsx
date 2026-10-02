import { Button, Select } from '@/components/ui/foundation/FoundationControls';
import type { Financials, FinancialReport, FinancialSelection } from '@/lib/xero/financials/contract';
import { findTotal, money, profitMetrics, variance, type ReportLine } from '@/lib/xero/financials/model';
import ReportTable from './ReportTable';
import styles from './Financials.module.css';

export default function ProfitView({ report, evidence, selection, apply, onDetail, retry }: { report: FinancialReport; evidence: Financials; selection: FinancialSelection; apply: (next: FinancialSelection) => void; onDetail: (row: ReportLine) => void; retry: () => void }) {
  const current = profitMetrics(report), compare = evidence[selection.comparison];
  const priorReport = compare.report.status === 'available' && compare.report.data.currency === report.currency && compare.report.data.basis === report.basis ? compare.report.data : null;
  const prior = priorReport ? profitMetrics(priorReport) : null;
  const points = evidence.months.map(month => {
    const value = month.report.status === 'available' ? profitMetrics(month.report.data) : null;
    const direct = month.report.status === 'available' ? findTotal(month.report.data, ['total cost of sales'])?.cents ?? null : null;
    const operating = month.report.status === 'available' ? findTotal(month.report.data, ['total operating expenses'])?.cents ?? null : null;
    return { from: month.query.from, to: month.query.to, revenue: value?.revenue?.cents ?? null, net: value?.net?.cents ?? null, costs: direct === null || operating === null || !Number.isSafeInteger(direct + operating) ? null : direct + operating };
  });
  const vals = points.flatMap(point => [point.revenue, point.net, point.costs]).filter((n): n is number => n !== null);
  const maximum = Math.max(100, ...vals), minimum = Math.min(0, ...vals), span = maximum - minimum;
  const y = (value: number) => 202 - (value - minimum) / span * 170, zero = y(0);
  return <>
    <div className={styles.metrics}>{(['revenue', 'gross', 'net'] as const).map((key, index) => {
      const amount = current[key]?.cents ?? null, previous = prior?.[key]?.cents ?? null, delta = variance(amount, previous);
      const margin = index > 0 && amount !== null && (current.revenue?.cents ?? 0) > 0 ? amount / current.revenue!.cents! * 100 : null;
      return <div key={key}><h3>{['Revenue', 'Gross profit', 'Net profit'][index]}</h3><p className={styles.metricValue}>{money(amount, report.currency, true)}</p><p className={styles.metricNote}>{delta.amount === null ? 'Comparison unavailable' : `${money(delta.amount, report.currency, true)} vs ${selection.comparison === 'previous' ? 'previous period' : 'year ago'}`}{margin === null ? '' : ` · ${margin.toFixed(1)}% margin`}</p></div>;
    })}</div>
    <section className={styles.section} aria-labelledby="financial-trend-title">
      <div className={styles.heading}><h2 id="financial-trend-title">Six months in view</h2><span className={styles.context}>Completed calendar months · {report.currency} · {report.basis}</span></div>
      <div className={styles.chart} tabIndex={0} role="region" aria-label="Monthly trend chart"><svg viewBox="0 0 780 250" role="img" aria-label="Monthly revenue, direct plus operating costs, and net profit. Exact values are in the trend table below.">
        {[0, 0.5, 1].map(fraction => { const value = minimum + span * fraction; return <g key={fraction}><line x1="75" x2="765" y1={y(value)} y2={y(value)} stroke="var(--ui-border)"/><text x="65" y={y(value) + 4} textAnchor="end" fontSize="12" fill="var(--ui-text-muted)">{money(value, report.currency, true)}</text></g>; })}
        {points.map((point, index) => <g key={point.from}>
          {(['revenue', 'costs', 'net'] as const).map((key, offset) => point[key] === null ? <text key={key} x={100 + index * 112 + offset * 20} y={zero - 5} fontSize="13" fill="var(--ui-text-muted)">?</text> : <rect key={key} x={98 + index * 112 + offset * 20} y={Math.min(y(point[key]!), zero)} height={Math.max(1, Math.abs(zero - y(point[key]!)))} width="17" fill={['var(--ui-text)', 'var(--ui-text-muted)', 'var(--ui-action)'][offset]}><title>{point.from}: {key} {money(point[key], report.currency)}</title></rect>)}
          <text x={125 + index * 112} y="229" textAnchor="middle" fontSize="12" fill="var(--ui-text)">{new Date(`${point.from}T12:00:00Z`).toLocaleDateString('en-NZ', { month: 'short', year: '2-digit', timeZone: 'UTC' })}</text>
        </g>)}
      </svg></div>
      <div className={styles.legend}>{[['Revenue', 'var(--ui-text)'], ['Direct + operating costs', 'var(--ui-text-muted)'], ['Net profit', 'var(--ui-action)']].map(([label, color]) => <span key={label}><i style={{background:color}}/>{label}</span>)}</div>
      {points.some(point => point.revenue === null || point.net === null || point.costs === null) && <p className={styles.context}>Some monthly figures are unavailable. Gaps are marked “?”. <Button variant="quiet" onClick={retry}>Retry reports</Button></p>}
      <details className={styles.source}><summary>Monthly figures</summary><div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>Period</th><th>Revenue</th><th>Direct + operating costs</th><th>Net profit</th></tr></thead><tbody>{points.map(point => <tr key={point.from}><td><button onClick={() => apply({...selection, from:point.from, to:point.to, detail:''})}>{point.from} – {point.to}</button></td><td>{money(point.revenue,report.currency)}</td><td>{money(point.costs,report.currency)}</td><td>{money(point.net,report.currency)}</td></tr>)}</tbody></table></div></details>
    </section>
    <section className={styles.section} aria-labelledby="financial-account-title">
      <div className={styles.heading}><h2 id="financial-account-title">Profit & loss accounts</h2><Select label="Compare with" value={selection.comparison} onChange={event => apply({...selection,comparison:event.target.value as FinancialSelection['comparison']})}><option value="previous">Previous period</option><option value="yearAgo">Same dates last year</option></Select></div>
      <p className={styles.context}>Comparison: {compare.query.from} to {compare.query.to}. Changes are arithmetic differences; higher costs are not automatically better.</p>
      {!priorReport && <p role="status">Comparison unavailable. The selected-period report remains usable. <Button variant="quiet" onClick={retry}>Retry comparison</Button></p>}
      <ReportTable report={report} comparison={priorReport} comparisonLabel={selection.comparison === 'previous' ? 'Previous period' : 'Year ago'} onDetail={onDetail}/>
    </section>
  </>;
}
