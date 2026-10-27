'use client';
import { Button } from '@/components/ui/foundation/FoundationControls';
import { Card } from '@/components/ui/foundation/FoundationSurfaces';
import { chartMetrics, sourceColour, sourceOutcomes, type ChartMetric } from '@/lib/marketingPerformance/charts';
import { summarize, rate, type MarketingRow } from '@/lib/marketingPerformance/contract';
import type { HubFilters } from '@/lib/marketingPerformance/hub';
import { money } from '@/lib/marketingPerformance/hub';
import ReportDetail from './ReportDetail';
import styles from './HubCharts.module.css';

const headers:Record<ChartMetric,string>={enquiries:'Submissions',qualified:'Qualified',quote:'Sent quote',accepted:'Accepted scope',won:'Payment verified'};
export default function SourceOutcomes({rows,filters,apply,compact=false,pending=false,error,onRetry}:{rows:MarketingRow[]|null;pending?:boolean;error?:string;onRetry?:()=>void;filters:HubFilters;apply:(f:HubFilters)=>void;compact?:boolean}) {
  const groups=rows?sourceOutcomes(rows):[],totals=rows?summarize(rows):null;
  const inspect=(source:string,metric:ChartMetric,pending=false)=>apply({...filters,view:compact?'enquiries':filters.view,source,inspect:pending?'unreviewed':metric==='enquiries'?'all':metric==='won'?'payment':metric});
  const metrics=(Object.keys(headers) as ChartMetric[]).filter(metric=>!compact||metric!=='qualified');
  return <Card title="Sources & outcomes" padding="compact" className={`${styles.outcomes} ${compact?styles.compactOutcomes:''}`}>
    <div className={styles.comparisonCaption}><span>{totals?`${totals.enquiries} enquiries received · Outcomes to date`:pending?'Reading complete source evidence…':'Source evidence unavailable'}</span><span>{totals?`${rate(totals.attributed,totals.enquiries)} source known · ${totals.enquiries-totals.attributed} unknown`:' '}</span></div>
    <div className={styles.outcomeScroll} role="region" aria-label="Source and outcome comparison" tabIndex={0}>
      <table className={styles.outcomeTable}>
        <thead><tr><th scope="col">Observed source</th>{metrics.map(metric=><th scope="col" key={metric}>{headers[metric]}<small>{metric==='enquiries'?'of selected cohort':metric==='qualified'?'of eligible enquiries':'of origin projects'}</small></th>)}<th scope="col">Net recorded cash<small>origin projects · to date</small></th></tr></thead>
        <tbody>{!rows&&<tr><td colSpan={metrics.length+2} role={pending?'status':undefined}>{error?<>Source evidence unavailable. {onRetry&&<Button variant="secondary" onClick={onRetry}>Retry</Button>}</>:pending?'Reading saved enquiries and project evidence…':'Source evidence unavailable.'}</td></tr>}{groups.map(group=><tr key={group.source}><th scope="row"><i style={{background:sourceColour(group.source)}}/>{group.source}</th>{group.cells.filter(cell=>metrics.includes(cell.metric)).map(cell=><td key={cell.metric}>
          <button className={styles.outcomeCell} disabled={cell.unavailable&&!cell.unreviewed} onClick={()=>inspect(group.source,cell.metric,cell.unavailable&&cell.unreviewed>0)} aria-label={cell.unavailable&&cell.unreviewed>0?`Inspect awaiting assessments from ${group.source}: ${cell.unreviewed} of ${cell.denominator} eligible`:`Inspect ${chartMetrics[cell.metric]} from ${group.source}: ${cell.display}`}>
            <span className={styles.cellValue} data-unavailable={cell.unavailable||undefined}>{cell.unavailable?'Unavailable':cell.count.toLocaleString('en-NZ')}{!cell.unavailable&&<small> / {cell.denominator.toLocaleString('en-NZ')}</small>}</span>
            <span className={styles.cellTrack} aria-hidden="true"><span style={{width:`${cell.width}%`,background:sourceColour(group.source)}}/></span>
            <small>{cell.metric==='qualified'?(cell.denominator?cell.unavailable?`${cell.unreviewed} awaiting / ${cell.denominator} eligible`:`${rate(cell.count,cell.denominator)} · ${cell.unreviewed} awaiting`:'No recorded eligible enquiries'):rate(cell.count,cell.denominator)}</small>
          </button>
        </td>)}<td><button className={styles.outcomeCell} onClick={()=>apply({...filters,view:'enquiries',source:group.source,inspect:'cash'})} aria-label={`Inspect recorded cash from ${group.source}`}><span className={styles.cellValue}>{group.summary.recordedCash===null?'Unavailable':money(group.summary.recordedCash)}</span><small>{group.summary.cashUnknown?`${group.summary.cashUnknown} projects lack complete ledger evidence`:`${group.summary.cashEntries} payments / reversals · NZD incl. GST`}</small></button></td></tr>)}</tbody>
      </table>
      {rows&&!groups.length&&<p>No matching enquiries.</p>}
    </div>
    <ReportDetail title="Sources & outcomes"><p>Bars use a 0–100% scale. Submissions show each source’s share of the selected cohort; qualification and project outcomes use their own displayed denominators. Compare sources vertically, not stages as a funnel. Select a cell to inspect its underlying records; unassessed qualification opens awaiting assessments. Submissions count enquiry receipts, including repeat submissions. Qualification counts staff-assessed eligible enquiries; its denominator includes those awaiting assessment. Unavailable is not a failed assessment.</p><p>Later outcomes count unique origin projects, credited to their earliest nonexcluded saved enquiry. Accepted scope is current; payment verified uses recorded payment evidence. These columns are not a shrinking funnel and their percentages cannot be multiplied together. Unknown source is retained, never inferred as direct traffic. Campaign and other current filters apply throughout.</p><p>Cash sums signed payments and reversals for the same origin projects, through this read. It is not accepted quote value, accounting revenue, profit or advertising return. Missing ledger evidence is unavailable, not zero. Invoice-paid flags and Xero matches are not added to cash. Open the supporting project’s Commercial records to inspect payments.</p><p>Facebook and Instagram labels combine their recorded source aliases; original labels remain in underlying records. A referral label means a consented saved external referrer, not proof of a paid ad or an organic search. Unknown source remains visible. Confirmed tests are excluded; unconfirmed candidates remain included.</p></ReportDetail>
  </Card>;
}
