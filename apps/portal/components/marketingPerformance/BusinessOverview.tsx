'use client';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, LineChart, ReferenceLine } from 'recharts';
import { Card } from '@/components/ui/foundation/FoundationSurfaces';
import { Button } from '@/components/ui/foundation/FoundationControls';
import { ageDistribution, monthlyActivity } from '@/lib/marketingPerformance/overview';
import { selectHub, money, type HubReport, type HubFilters } from '@/lib/marketingPerformance/hub';
import ReportDetail from './ReportDetail';
import PortfolioChart from './PortfolioChart';
import styles from './HubCharts.module.css';

export default function BusinessOverview({hub,filters,apply}:{hub:HubReport;filters:HubFilters;apply:(f:HubFilters)=>void}) {
  const selected=selectHub(hub,{...filters,inspect:'all'});
  const ages=ageDistribution(selected.projects,hub.asOf);
  const chartAges=ages.filter(b=>b.key!=='unknown'||b.count>0);
  const months=monthlyActivity(selected.events,filters.start,filters.end);
  const open=ages.reduce((n,b)=>n+b.count,0);
  const inspectAge=(age:string)=>apply({...filters,view:'portfolio',age,created:false,inspect:'all'});
  const inspectMonth=(index:number,kind:string)=>{
    const month=months[index];
    if(month)apply({...filters,view:'sales',start:month.start,end:month.end,kind,inspect:'all',age:''});
  };
  return <>
    <div className={styles.overviewNumbers}>
      <div><span>Projects</span><strong>{selected.projects.length.toLocaleString('en-NZ')}</strong><small>Current portfolio</small></div>
      <div><span>Active / waiting</span><strong>{open.toLocaleString('en-NZ')}</strong><small>By operational state</small></div>
      <button onClick={()=>inspectAge('91+')}><span>Open · 91+ days</span><strong>{ages.find(b=>b.key==='91+')?.count.toLocaleString('en-NZ')}</strong><small>Since creation ↗</small></button>
    </div>
    <div className={styles.grid}>
      <PortfolioChart projects={selected.projects} filters={filters} apply={apply}/>
      <Card title="Age of open work" padding="compact">
        <p className={styles.note}>Active / waiting · Days since creation</p>
        <div className={`${styles.portfolioPlot} ${styles.agePlot}`} aria-label="Active and waiting projects by age"><ResponsiveContainer width="100%" height={390} minWidth={0}>
          <BarChart data={chartAges} layout="vertical" margin={{top:8,right:24,bottom:8,left:0}} accessibilityLayer>
            <CartesianGrid horizontal={false} stroke="var(--ui-border)"/><XAxis type="number" allowDecimals={false} tick={{fontSize:12}}/>
            <YAxis type="category" dataKey="label" width={112} tick={{fontSize:12}}/><Tooltip/>
            <Bar dataKey="count" name="Projects" fill="#276987" isAnimationActive={false} cursor="pointer" onClick={(_,i)=>{if(chartAges[i]?.count)inspectAge(chartAges[i].key);}}/>
          </BarChart>
        </ResponsiveContainer></div>
        <ReportDetail title="Age of open work"><p>Calendar days since project creation at the report read time in Auckland, not inactivity, time in stage or overdue days. Active and waiting projects only; closed, archived and unknown-state projects are excluded. Future creation dates need review. Select an age group for its records, oldest first. Historical and test-labelled projects remain included.</p></ReportDetail>
        <details><summary>View age counts</summary><div className={styles.data}><table><thead><tr><th>Age since creation</th><th>Projects</th></tr></thead><tbody>{ages.map(b=><tr key={b.key}><th><Button variant="quiet" disabled={!b.count} onClick={()=>inspectAge(b.key)}>{b.label}</Button></th><td>{b.count}</td></tr>)}</tbody></table></div></details>
      </Card>
    </div>
    <Card title="Sales activity" padding="compact">
      <p className={styles.note}>{filters.start} – {filters.end} · Recorded monthly activity</p>
      <div className={styles.grid}>
        <section aria-label="Monthly quote activity"><h3>Quote versions</h3><div className={styles.legend}><span><i style={{background:'#276987'}}/>Sent</span><span><i style={{background:'#725298'}}/>Accepted</span></div>
          <div className={styles.plot}><ResponsiveContainer width="100%" height={280} minWidth={0}><BarChart data={months} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--ui-border)"/><XAxis dataKey="month" tick={{fontSize:11}}/><YAxis allowDecimals={false} width={45}/><Tooltip/>
            <Bar dataKey="sent" name="Sent versions" fill="#276987" isAnimationActive={false} cursor="pointer" onClick={(_,i)=>{if(months[i]?.sent)inspectMonth(i,'quote_sent');}}/>
            <Bar dataKey="accepted" name="Accepted versions" fill="#725298" isAnimationActive={false} cursor="pointer" onClick={(_,i)=>{if(months[i]?.accepted)inspectMonth(i,'quote_accepted');}}/>
          </BarChart></ResponsiveContainer></div>
        </section>
        <section aria-label="Monthly net recorded receipts"><h3>Net recorded receipts · NZD</h3><div className={styles.legend}><span><i style={{background:'#47705b'}}/>Payments less reversals</span></div>
          <div className={styles.plot}><ResponsiveContainer width="100%" height={280} minWidth={0}><LineChart data={months} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--ui-border)"/><XAxis dataKey="month" tick={{fontSize:11}}/><YAxis width={70} tickFormatter={n=>`$${Number(n).toLocaleString('en-NZ')}`} tick={{fontSize:11}}/>
            <Tooltip formatter={value=>[money(Number(value)*100),'Net recorded receipts']}/><ReferenceLine y={0} stroke="var(--ui-text-muted)"/>
            <Line dataKey="receipts" name="Net recorded receipts" stroke="#47705b" strokeWidth={2} isAnimationActive={false} connectNulls={false} activeDot={false} dot={({cx,cy,payload})=><circle key={payload.month} cx={cx} cy={cy} r={5} fill="#47705b" style={{cursor:'pointer'}} onClick={()=>inspectMonth(months.findIndex(m=>m.month===payload.month),'receipts')}/>}/>
          </LineChart></ResponsiveContainer></div>
        </section>
      </div>
      <ReportDetail title="Sales activity"><p>Select a quote bar, receipt point or a month below to inspect its records. Quote versions and payment entries may repeat within a project; they are not unique wins. Net receipts include signed payments and reversals, including GST; invoice-paid statuses and ledger adjustments are excluded. A gap means an entry has no amount. Zero means no net recorded receipts, not proof that no money was received. Missing historical records cannot be reconstructed. First and last months may be partial.</p></ReportDetail>
      <details><summary>View monthly figures</summary><div className={styles.data}><table><thead><tr><th>Included dates</th><th>Sent versions</th><th>Accepted versions</th><th>Net receipts (NZD)</th></tr></thead><tbody>{months.map((m,i)=><tr key={m.month}>
        <th>{m.start} – {m.end}{m.partial?' · partial month':''}</th>
        <td><Button variant="quiet" disabled={!m.sent} onClick={()=>inspectMonth(i,'quote_sent')}>{m.sent}</Button></td>
        <td><Button variant="quiet" disabled={!m.accepted} onClick={()=>inspectMonth(i,'quote_accepted')}>{m.accepted}</Button></td>
        <td><Button variant="quiet" disabled={!m.receiptEntries} onClick={()=>inspectMonth(i,'receipts')}>{m.receipts===null?'Unavailable':money(m.receipts*100)} · {m.receiptEntries} entries</Button></td>
      </tr>)}</tbody></table></div></details>
    </Card>
  </>;
}
