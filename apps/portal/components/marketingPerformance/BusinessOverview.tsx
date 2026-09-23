'use client';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/foundation/FoundationSurfaces';
import { Button } from '@/components/ui/foundation/FoundationControls';
import { ageDistribution } from '@/lib/marketingPerformance/overview';
import { selectHub, type HubReport, type HubFilters } from '@/lib/marketingPerformance/hub';
import ReportDetail from './ReportDetail';
import PortfolioChart from './PortfolioChart';
import SalesActivity from './SalesActivity';
import styles from './HubCharts.module.css';

export default function BusinessOverview({hub,filters,apply}:{hub:HubReport;filters:HubFilters;apply:(f:HubFilters)=>void}) {
  const selected=selectHub(hub,{...filters,inspect:'all'});
  const ages=ageDistribution(selected.projects,hub.asOf);
  const chartAges=ages.filter(b=>b.key!=='unknown'||b.count>0);
  const open=ages.reduce((n,b)=>n+b.count,0);
  const inspectAge=(age:string)=>apply({...filters,view:'portfolio',age,created:false,inspect:'all'});
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
    <SalesActivity events={selected.events} filters={filters} apply={apply}/>
  </>;
}
