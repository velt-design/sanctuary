'use client';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, LineChart, ReferenceLine } from 'recharts';
import { Card } from '@/components/ui/foundation/FoundationSurfaces';
import { Button, Select } from '@/components/ui/foundation/FoundationControls';
import { salesActivity, type ActivityBucket } from '@/lib/marketingPerformance/overview';
import { money, type HubEvent, type HubFilters } from '@/lib/marketingPerformance/hub';
import ReportDetail from './ReportDetail';
import styles from './HubCharts.module.css';

export default function SalesActivity({events,filters,apply}:{events:HubEvent[];filters:HubFilters;apply:(f:HubFilters)=>void}) {
  const buckets=salesActivity(events,filters.start,filters.end,filters.salesBucket);
  const inspectBucket=(index:number,kind:string)=>{
    const bucket=buckets[index];
    if(bucket)apply({...filters,view:'sales',start:bucket.start,end:bucket.end,kind,inspect:'all',age:''});
  };
  return (
    <Card title="Sales activity" padding="compact">
      <div className={styles.trendToolbar}><Select label="Group sales by" value={filters.salesBucket} onChange={e=>apply({...filters,salesBucket:e.target.value as ActivityBucket})}><option value="week">Week</option><option value="month">Month</option></Select><p className={styles.note}>{filters.start} – {filters.end} · Recorded {filters.salesBucket==='week'?'weekly':'monthly'} activity</p></div>
      <div className={styles.grid}>
        <section aria-label="Quote activity trend"><h3>Quote versions</h3><div className={styles.legend}><span><i style={{background:'#276987'}}/>Sent</span><span><i style={{background:'#725298'}}/>Accepted</span></div>
          <div className={styles.plot}><ResponsiveContainer width="100%" height={280} minWidth={0}><BarChart data={buckets} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--ui-border)"/><XAxis dataKey="label" tick={{fontSize:11}}/><YAxis allowDecimals={false} width={45}/><Tooltip labelFormatter={(_,payload)=>{const b=payload?.[0]?.payload;return b?`${b.start} – ${b.end}${b.partial?' · partial period':''}`:'';}}/>
            <Bar dataKey="sent" name="Sent versions" fill="#276987" isAnimationActive={false} cursor="pointer" onClick={(_,i)=>{if(buckets[i]?.sent)inspectBucket(i,'quote_sent');}}/>
            <Bar dataKey="accepted" name="Accepted versions" fill="#725298" isAnimationActive={false} cursor="pointer" onClick={(_,i)=>{if(buckets[i]?.accepted)inspectBucket(i,'quote_accepted');}}/>
          </BarChart></ResponsiveContainer></div>
        </section>
        <section aria-label="Net recorded receipt trend"><h3>Net recorded receipts · NZD</h3><div className={styles.legend}><span><i style={{background:'#47705b'}}/>Payments less reversals</span></div>
          <div className={styles.plot}><ResponsiveContainer width="100%" height={280} minWidth={0}><LineChart data={buckets} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--ui-border)"/><XAxis dataKey="label" tick={{fontSize:11}}/><YAxis width={70} tickFormatter={n=>`$${Number(n).toLocaleString('en-NZ')}`} tick={{fontSize:11}}/>
            <Tooltip labelFormatter={(_,payload)=>{const b=payload?.[0]?.payload;return b?`${b.start} – ${b.end}`:'';}} formatter={value=>[money(Number(value)*100),'Net recorded receipts']}/><ReferenceLine y={0} stroke="var(--ui-text-muted)"/>
            <Line dataKey="receipts" name="Net recorded receipts" stroke="#47705b" strokeWidth={2} isAnimationActive={false} connectNulls={false} activeDot={false} dot={({cx,cy,payload})=><circle key={payload.key} cx={cx} cy={cy} r={5} fill="#47705b" style={{cursor:'pointer'}} onClick={()=>inspectBucket(buckets.findIndex(m=>m.key===payload.key),'receipts')}/>}/>
          </LineChart></ResponsiveContainer></div>
        </section>
      </div>
      <ReportDetail title="Sales activity"><p>Select a quote bar, receipt point or a period below to inspect its records. Quote versions and payment entries may repeat within a project; they are not unique wins. Net receipts include signed payments and reversals, including GST; invoice-paid statuses and ledger adjustments are excluded. A gap means an entry has no amount. Zero means no net recorded receipts, not proof that no money was received. Missing historical records cannot be reconstructed. First and last periods may be partial.</p></ReportDetail>
      <details><summary>View trend figures</summary><div className={styles.data}><table><thead><tr><th>Included dates</th><th>Sent versions</th><th>Accepted versions</th><th>Net receipts (NZD)</th></tr></thead><tbody>{buckets.map((m,i)=><tr key={m.key}>
        <th>{m.start} – {m.end}{m.partial?' · partial period':''}</th>
        <td><Button variant="quiet" disabled={!m.sent} onClick={()=>inspectBucket(i,'quote_sent')}>{m.sent}</Button></td>
        <td><Button variant="quiet" disabled={!m.accepted} onClick={()=>inspectBucket(i,'quote_accepted')}>{m.accepted}</Button></td>
        <td><Button variant="quiet" disabled={!m.receiptEntries} onClick={()=>inspectBucket(i,'receipts')}>{m.receipts===null?'Unavailable':money(m.receipts*100)} · {m.receiptEntries} entries</Button></td>
      </tr>)}</tbody></table></div></details>
    </Card>
  );
}
