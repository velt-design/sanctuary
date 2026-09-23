'use client';
import { Card } from '@/components/ui/foundation/FoundationSurfaces';
import { chartMetrics, sourceColour, sourceOutcomes, type ChartMetric } from '@/lib/marketingPerformance/charts';
import { summarize, rate, type MarketingRow } from '@/lib/marketingPerformance/contract';
import type { HubFilters } from '@/lib/marketingPerformance/hub';
import ReportDetail from './ReportDetail';
import styles from './HubCharts.module.css';

const headers:Record<ChartMetric,string>={enquiries:'Submissions',qualified:'Qualified',quote:'Sent quote',accepted:'Accepted scope',won:'Payment verified'};
export default function SourceOutcomes({rows,filters,apply}:{rows:MarketingRow[];filters:HubFilters;apply:(f:HubFilters)=>void}) {
  const groups=sourceOutcomes(rows),totals=summarize(rows);
  const inspect=(source:string,metric:ChartMetric,pending=false)=>apply({...filters,source,inspect:pending?'unreviewed':metric==='enquiries'?'all':metric==='won'?'payment':metric});
  return <Card title="Sources & outcomes" padding="compact">
    <div className={styles.comparisonCaption}><span>{rate(totals.attributed,totals.enquiries)} source known · {totals.enquiries-totals.attributed} unknown</span><span>Bars show percentages</span></div>
    <div className={styles.outcomeScroll} role="region" aria-label="Source and outcome comparison" tabIndex={0}>
      <table className={styles.outcomeTable}>
        <thead><tr><th scope="col">Observed source</th>{(Object.keys(headers) as ChartMetric[]).map(metric=><th scope="col" key={metric}>{headers[metric]}<small>{metric==='enquiries'?'of selected cohort':metric==='qualified'?'of eligible enquiries':'of origin projects'}</small></th>)}</tr></thead>
        <tbody>{groups.map(group=><tr key={group.source}><th scope="row"><i style={{background:sourceColour(group.source)}}/>{group.source}</th>{group.cells.map(cell=><td key={cell.metric}>
          <button className={styles.outcomeCell} disabled={cell.unavailable&&!cell.unreviewed} onClick={()=>inspect(group.source,cell.metric,cell.unavailable&&cell.unreviewed>0)} aria-label={cell.unavailable&&cell.unreviewed>0?`Inspect awaiting assessments from ${group.source}: ${cell.unreviewed} of ${cell.denominator} eligible`:`Inspect ${chartMetrics[cell.metric]} from ${group.source}: ${cell.display}`}>
            <span className={styles.cellValue}>{cell.unavailable?'Unavailable':cell.count.toLocaleString('en-NZ')}{!cell.unavailable&&<small> / {cell.denominator.toLocaleString('en-NZ')}</small>}</span>
            <span className={styles.cellTrack} aria-hidden="true"><span style={{width:`${cell.width}%`,background:sourceColour(group.source)}}/></span>
            <small>{cell.metric==='qualified'?(cell.denominator?cell.unavailable?`${cell.unreviewed} awaiting / ${cell.denominator} eligible`:`${rate(cell.count,cell.denominator)} · ${cell.unreviewed} awaiting`:'No recorded eligible enquiries'):rate(cell.count,cell.denominator)}</small>
          </button>
        </td>)}</tr>)}</tbody>
      </table>
      {!groups.length&&<p>No matching enquiries.</p>}
    </div>
    <ReportDetail title="Sources & outcomes"><p>Bars use a 0–100% scale. Submissions show each source’s share of the selected cohort; qualification and project outcomes use their own displayed denominators. Compare sources vertically, not stages as a funnel. Select a cell to inspect its underlying records; unassessed qualification opens awaiting assessments. Submissions count enquiry receipts, including repeat submissions. Qualification counts staff-assessed eligible enquiries; its denominator includes those awaiting assessment. Unavailable is not a failed assessment.</p><p>Later outcomes count unique origin projects, credited to their earliest saved enquiry. Accepted scope is current; payment verified uses recorded payment evidence. These columns are not a shrinking funnel and their percentages cannot be multiplied together. Unknown source is retained, never inferred as direct traffic. Campaign and other current filters apply throughout.</p></ReportDetail>
  </Card>;
}
