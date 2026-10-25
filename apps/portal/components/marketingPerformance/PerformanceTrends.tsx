import { Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/foundation/FoundationSurfaces';
import { Button } from '@/components/ui/foundation/FoundationControls';
import { filteredRows, type Filters, type MarketingReport, type MarketingRow } from '@/lib/marketingPerformance/contract';
import { comparisonMetrics, countChange, previousPeriod, weeklyEnquiries } from '@/lib/marketingPerformance/trends';
import styles from './MarketingPerformance.module.css';

export default function PerformanceTrends({ rows, filters, previous, comparisonError, comparisonBusy=false, onRetry, earliestReceipt,pending=false }: {
  rows: MarketingRow[]|null;pending?:boolean; filters: Filters; previous: MarketingReport | null; comparisonError: string; comparisonBusy?:boolean; onRetry: () => void; earliestReceipt?:string|null;
}) {
  const [weeklyOpen, setWeeklyOpen] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('weekly') === '1');
  const dates = previousPeriod(filters.start, filters.end);
  const current = rows?comparisonMetrics(rows):null;
  const prior = previous ? comparisonMetrics(filteredRows(previous, filters)) : null;
  const incompleteHistory = !earliestReceipt || dates.start < new Intl.DateTimeFormat('en-CA',{timeZone:'Pacific/Auckland'}).format(new Date(earliestReceipt));
  const weeks = weeklyEnquiries(rows??[], filters.start, filters.end);
  const peak = Math.max(0, ...weeks.map(week => week.dailyAverage));
  return <Card title="Change over time" padding="compact">
    {comparisonBusy&&<p role="status">Reading previous-period evidence… {rows?'Selected-period records are available.':'Selected-period records are still being read.'}</p>}
    <p className={styles.muted}>Same source and campaign filters · previous {dates.days} days: {dates.start} – {dates.end}</p>
    <div className={styles.periodComparison}>
      <Table><TableHeader><TableRow><TableHead scope="col">Recorded enquiries</TableHead><TableHead scope="col">Selected period</TableHead><TableHead scope="col">Previous period</TableHead><TableHead scope="col">Change</TableHead></TableRow></TableHeader>
        <TableBody>{([
          ['Enquiries received', 'enquiries'], ['Qualified enquiries', 'qualified'],
        ] as const).map(([label, metric]) => <TableRow key={metric}>
          <TableHead scope="row">{label}</TableHead><TableCell>{current?current[metric]:pending?'Reading…':'Unavailable'}</TableCell><TableCell>{prior?prior[metric]:comparisonBusy?'Reading…':'Unavailable'}</TableCell>
          <TableCell>{!current?pending?'Reading…':'Unavailable':incompleteHistory?'Not comparable — incomplete receipt history':prior?countChange(current[metric],prior[metric]):comparisonBusy?'Reading…':'Unavailable'}</TableCell>
        </TableRow>)}</TableBody></Table>
    </div>
    <p className={styles.muted}>Qualification uses current staff assessments, not status at period end: {current?`${current.eligible} eligible / ${current.unreviewed} awaiting review now`:pending?'Reading current assessments…':'Current assessments unavailable'}{prior ? `; ${prior.eligible} eligible / ${prior.unreviewed} awaiting review in the previous cohort` : ''}. Older cohorts have had longer to progress; wins are not compared.</p>
    <div className={styles.comparisonNote}>
      {comparisonError ? <p role="status">{comparisonError} <Button variant="quiet" onClick={onRetry}>Retry comparison</Button></p>
        : <p className={styles.muted}>{prior?.enquiries === 0 ? 'No saved enquiries in the previous period. ' : ''}Counts cover saved enquiry receipts only; missing history can understate earlier periods.</p>}
    </div>
    <h3 className={styles.trendHeading}>Weekly enquiry trend</h3>
    <p className={styles.muted}>Average enquiries per day within each Monday–Sunday week. Short weeks use only the days selected. Peak: {rows?`${peak.toFixed(1)} / day`:pending?'Reading…':'Unavailable'}.</p>
    <div className={styles.weeklyBars} role="img" aria-label={`Weekly enquiry trend for ${filters.start} to ${filters.end}. ${rows?rows.length:pending?'Reading':'Unavailable'} recorded enquiries across ${weeks.length} weekly buckets. Exact counts follow in the weekly breakdown.`}>
      {weeks.map(week => <div key={week.start} className={styles.weeklyColumn} title={rows?`${week.start} – ${week.end}: ${week.enquiries} enquiries over ${week.days} days (${week.dailyAverage.toFixed(1)} / day)`:`${week.start} – ${week.end}: ${pending?'Reading':'Unavailable'}`}>
        <span className={week.days < 7 && week.enquiries > 0 ? styles.partialWeek : undefined} style={{ height: `${rows&&peak ? week.dailyAverage / peak * 100 : 0}%` }} />
      </div>)}
    </div>
    <div className={styles.trendAxis}><span>{filters.start}</span><span>{filters.end}</span></div>
    <details open={weeklyOpen} onToggle={event => {
      const open = event.currentTarget.open; setWeeklyOpen(open);
      const url = new URL(window.location.href);
      if (open) url.searchParams.set('weekly', '1'); else url.searchParams.delete('weekly');
      window.history.replaceState(null, '', url);
    }}><summary>Weekly counts and included days</summary>
      <div className={styles.weeklyTable} tabIndex={0} role="region" aria-label="Weekly enquiry counts">
        <Table><TableHeader><TableRow><TableHead scope="col">Included dates (NZ)</TableHead><TableHead scope="col">Days</TableHead><TableHead scope="col">Enquiries</TableHead><TableHead scope="col">Per day</TableHead></TableRow></TableHeader>
          <TableBody>{weeks.map(week => <TableRow key={week.start}><TableHead scope="row">{week.start} – {week.end}{week.days < 7 ? ' · partial week' : ''}</TableHead><TableCell>{week.days}</TableCell><TableCell>{rows?week.enquiries:pending?'Reading…':'Unavailable'}</TableCell><TableCell>{rows?week.dailyAverage.toFixed(1):pending?'Reading…':'Unavailable'}</TableCell></TableRow>)}</TableBody></Table>
      </div>
    </details>
  </Card>;
}
import { useState } from 'react';
