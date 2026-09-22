'use client';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/foundation/FoundationSurfaces';
import { Button, Select } from '@/components/ui/foundation/FoundationControls';
import { chartMetrics, enquiryWeeks, sourceColour, sourceMeasures, type ChartMetric } from '@/lib/marketingPerformance/charts';
import type { MarketingRow } from '@/lib/marketingPerformance/contract';
import type { HubFilters } from '@/lib/marketingPerformance/hub';
import ReportDetail from './ReportDetail';
import styles from './HubCharts.module.css';

export default function EnquiryCharts({rows,filters,apply}:{rows:MarketingRow[];filters:HubFilters;apply:(f:HubFilters)=>void}) {
  const {weeks,sources}=enquiryWeeks(rows,filters.start,filters.end);
  const metric=filters.chartMetric as ChartMetric, scale=filters.chartScale;
  const measures=sourceMeasures(rows,metric,scale);
  const inspectSource=(source:string)=>apply({...filters,source,inspect:metric==='enquiries'?'all':metric==='won'?'payment':metric});
  const inspectWeek=(index:number,source?:string)=>{const w=weeks[index];if(w)apply({...filters,start:w.start,end:w.end,source:source??filters.source,inspect:'all'});};
  const denominator=metric==='enquiries'?'all filtered submissions':metric==='qualified'?'eligible enquiries in that source (including those awaiting assessment)':'unique origin projects in that source';
  return <div className={styles.grid}>
    <Card title="Enquiries over time" padding="compact">
      <p className={styles.note}>Weekly submissions · By observed source</p>
      <div className={styles.legend}>{sources.map(source=><span key={source}><i style={{background:sourceColour(source)}}/>{source}</span>)}</div>
      <div className={styles.plot} aria-label="Weekly enquiry chart">
        <ResponsiveContainer width="100%" height={280} minWidth={0}>
          <BarChart data={weeks} margin={{top:16,right:12,bottom:16,left:0}} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--ui-border)"/>
            <XAxis dataKey="label" minTickGap={28} tick={{fontSize:11}} label={{value:'Week starting (MM-DD)',position:'insideBottom',offset:-12,fontSize:11}}/>
            <YAxis allowDecimals={false} width={42} tick={{fontSize:11}}/>
            <Tooltip cursor={{fill:'var(--ui-border)',fillOpacity:0.2}} labelFormatter={(_,payload)=>{const w=payload?.[0]?.payload;return w?`${w.start} – ${w.end} · ${w.days} days`:'';}}/>
            {sources.map((source,i)=><Bar key={source} name={source} dataKey={`values.${i}`} stackId="source" fill={sourceColour(source)} isAnimationActive={false} cursor="pointer" onClick={(_,index)=>inspectWeek(index,source)}/>)}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ReportDetail title="Enquiry trend"><p>Click a segment to inspect that source and week. Vertical axis: submissions. First/last weeks may contain fewer than seven days; a short bar is not automatically a decline. Empty history means no saved receipts, not proof of no business.</p></ReportDetail>
      <details><summary>View weekly figures</summary><div className={styles.data}><table><thead><tr><th>Included NZ dates</th><th>Days</th><th>Submissions</th><th>Inspect</th></tr></thead><tbody>{weeks.map((w,i)=><tr key={w.start}><th>{w.start} – {w.end}</th><td>{w.days}</td><td>{w.enquiries}</td><td><Button variant="quiet" onClick={()=>inspectWeek(i)}>Inspect week {w.start}</Button></td></tr>)}</tbody></table></div></details>
    </Card>
    <Card title="Source performance" padding="compact">
      <div className={styles.controls}><Select label="Source measure" value={metric} onChange={e=>apply({...filters,chartMetric:e.target.value,inspect:'all'})}>{Object.entries(chartMetrics).map(([key,label])=><option key={key} value={key}>{label}</option>)}</Select>
        <Select label="Chart display" value={scale} onChange={e=>apply({...filters,chartScale:e.target.value})}><option value="count">Counts</option><option value="rate">Percentages</option></Select></div>
      <p className={styles.note}>{scale==='rate'?`Percentage of ${denominator}.`:'Recorded counts'}</p>
      <div className={styles.sourcePlot} aria-label="Source outcome comparison">
        <ResponsiveContainer width="100%" height={Math.max(280,measures.length*44+60)} minWidth={0}>
          <BarChart data={measures} layout="vertical" margin={{top:8,right:30,bottom:12,left:0}} accessibilityLayer>
            <CartesianGrid horizontal={false} stroke="var(--ui-border)"/>
            <XAxis type="number" allowDecimals={scale==='rate'} domain={[0,'auto']} tick={{fontSize:11}} unit={scale==='rate'?'%':''}/>
            <YAxis type="category" dataKey="source" width={105} tick={{fontSize:11}} tickFormatter={s=>s.length>16?`${s.slice(0,14)}…`:s}/>
            <Tooltip cursor={{fill:'var(--ui-border)',fillOpacity:0.2}} formatter={(_,__,entry)=>entry.payload.unavailable?'Unavailable':entry.payload.display}/>
            <Bar maxBarSize={32} dataKey="value" name={chartMetrics[metric]} isAnimationActive={false} cursor="pointer" onClick={(_,index)=>{if(measures[index])inspectSource(measures[index].source);}}>
              {measures.map(m=><Cell key={m.source} fill={sourceColour(m.source)}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {!measures.length&&<p>No matching source records.</p>}
      <div className={styles.data}><table><thead><tr><th>Source / inspect</th><th>{chartMetrics[metric]}</th>{scale==='rate'&&<th>Count / denominator</th>}</tr></thead><tbody>{measures.map(m=><tr key={m.source}><th><Button variant="quiet" onClick={()=>inspectSource(m.source)}>{m.source}</Button></th><td>{m.display}{metric==='qualified'&&m.unreviewed>0?<small> · {m.unreviewed} awaiting assessment</small>:null}</td>{scale==='rate'&&<td>{m.count} / {m.denominator}</td>}</tr>)}</tbody></table></div>
      <ReportDetail title="Source performance"><p>Click a bar for its records. Submissions and unique projects are different units. Unknown is grey, not direct traffic. A missing assessment is not a failed qualification. Later project outcomes belong to the original enquiry; platform-attributed conversions are excluded.</p></ReportDetail>
    </Card>
  </div>;
}
