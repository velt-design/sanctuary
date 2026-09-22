'use client';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/foundation/FoundationSurfaces';
import { Button } from '@/components/ui/foundation/FoundationControls';
import { portfolioStages, portfolioStates, stateColours } from '@/lib/marketingPerformance/charts';
import type { HubProject, HubFilters } from '@/lib/marketingPerformance/hub';
import ReportDetail from './ReportDetail';
import styles from './HubCharts.module.css';

export default function PortfolioChart({projects,filters,apply}:{projects:HubProject[];filters:HubFilters;apply:(f:HubFilters)=>void}) {
  const stages=portfolioStages(projects);
  const inspect=(stage:string,state=filters.state)=>apply({...filters,view:'portfolio',stage,state,inspect:'all',created:filters.view==='overview'?false:filters.created,age:filters.view==='overview'?'':filters.age});
  return <Card title="Project stages" padding="compact">
    <p className={styles.note}>Current position · Includes archived</p>
    <div className={styles.legend}>{portfolioStates.map((state,i)=><span key={state}><i style={{background:stateColours[i]}}/>{state.toLowerCase()}</span>)}</div>
    <div className={styles.portfolioPlot} aria-label="Projects by current stage and state"><ResponsiveContainer width="100%" height={390} minWidth={0}>
      <BarChart data={stages} layout="vertical" margin={{top:8,right:24,bottom:8,left:0}} accessibilityLayer>
        <CartesianGrid horizontal={false} stroke="var(--ui-border)"/>
        <XAxis type="number" allowDecimals={false} tick={{fontSize:12}}/>
        <YAxis type="category" dataKey="label" width={100} tick={{fontSize:12}}/>
        <Tooltip cursor={{fill:'var(--ui-border)',fillOpacity:0.2}}/>
        {portfolioStates.map((state,i)=><Bar key={state} name={state.toLowerCase()} dataKey={`values.${i}`} stackId="state" fill={stateColours[i]} isAnimationActive={false} cursor="pointer" onClick={(_,index)=>{if(stages[index]?.values[i])inspect(stages[index].key,state);}}/>)}
      </BarChart>
    </ResponsiveContainer></div>
    <ReportDetail title="Project stages"><p>Unique projects by current stage and operational state, including archived work in your filters. This is not a historical sales funnel. Click a coloured segment for that stage and state; grey is archived.</p></ReportDetail>
    <details><summary>View stage counts</summary><div className={styles.data}><table><thead><tr><th>Stage / inspect all matching</th>{portfolioStates.map(s=><th key={s}>{s.toLowerCase()}</th>)}<th>Total</th></tr></thead><tbody>{stages.map(stage=><tr key={stage.key}><th><Button variant="quiet" disabled={!stage.total} onClick={()=>inspect(stage.key)}>{stage.label}</Button></th>{stage.values.map((n,i)=><td key={i}><Button variant="quiet" disabled={!n} aria-label={`Inspect ${stage.label}, ${portfolioStates[i].toLowerCase()}: ${n} projects`} onClick={()=>inspect(stage.key,portfolioStates[i])}>{n}</Button></td>)}<td>{stage.total}</td></tr>)}</tbody></table></div></details>
  </Card>;
}
