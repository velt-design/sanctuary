'use client';
import { useState } from 'react';
import { Button,Select } from '@/components/ui/foundation/FoundationControls';
import { Drawer } from './MarketingDrawer';
import { designerSales,salesScopeValue,salesExclusionLabels,type DesignerSalesRow } from '@/lib/marketingPerformance/designerSales';
import type { DesignerReport } from '@/lib/marketingPerformance/designerContract';
import { money,type HubReport } from '@/lib/marketingPerformance/hub';
import { unassignedDesigner,type SalesDesigner } from '@/lib/marketingPerformance/salesDesigner';
import { unrecordedSalesOutcome,type SalesOutcome } from '@/lib/marketingPerformance/salesOutcome';
import SalesDesignerAssignment,{type AssignmentClient} from './SalesDesignerAssignment';
import ProjectSalesOutcome,{type OutcomeClient} from './ProjectSalesOutcome';
import { designerName } from './DesignerPerformance';
import styles from './DesignerPerformance.module.css';
type Metric='jobs'|'goingAhead'|'excluded'|'undated'|'tests';
const labels:Record<Metric,string>={jobs:'Accepted jobs',goingAhead:'Net accepted jobs',excluded:'Excluded jobs',undated:'Acceptance date needs review',tests:'Test records'};
export default function DesignerSales({report,snapshot,filterKey,projectIds,designer,allDates,onPeriod,hub,synthetic,onAssignment,onOutcome,assignmentClient,outcomeClient,pending=false,period}:{
  report:DesignerReport|null;snapshot:DesignerReport|null;pending?:boolean;period?:{start:string;end:string};filterKey:string;projectIds:Set<string>|null;designer:string;allDates:boolean;onPeriod:(all:boolean)=>void;hub:HubReport|null;synthetic:boolean;
  onAssignment:(value:SalesDesigner)=>void;onOutcome:(value:SalesOutcome)=>void;assignmentClient?:AssignmentClient;outcomeClient?:OutcomeClient;
}) {
  const selectionKey=filterKey+':'+allDates;
  const result=report?designerSales(report,projectIds,designer,allDates):null,[inspect,setInspect]=useState<{staff:string;metric:Metric;snapshot:DesignerReport;filters:string}|null>(null),[page,setPage]=useState(0);
  const selected=result&&inspect?.snapshot===snapshot&&inspect.filters===selectionKey?[result.total,...result.rows].find(r=>r.staffId===inspect.staff):null;
  const open=(row:DesignerSalesRow,metric:Metric)=>{if(!snapshot)return;setInspect({staff:row.staffId,metric,snapshot,filters:selectionKey});setPage(0);};
  const button=(row:DesignerSalesRow,metric:Metric)=><button onClick={()=>open(row,metric)} aria-label={`${designerName(row.staffId)}: ${labels[metric]}`}><strong>{row[metric].length}</strong></button>;
  const value=(row:DesignerSalesRow)=>{const amount=salesScopeValue(row.goingAhead.flatMap(j=>j.goingAhead),true);return amount===null?'Value incomplete':money(amount);};
  const projects=new Map((hub?.projects??[]).map(p=>[p.id,p]));
  return <section aria-label="Accepted jobs by designer">
    <h3>Accepted jobs by assigned designer</h3><Select label="Acceptance period" value={allDates?'all':'selected'} onChange={e=>{onPeriod(e.target.value==='all');setInspect(null);}}><option value="selected">Selected report dates</option><option value="all">All recorded acceptance dates</option></Select><p>{allDates?'All recorded acceptances, including undated acceptance evidence.':`Accepted during ${report?.start??period?.start} to ${report?.end??period?.end} (New Zealand dates).`} {report?<>Current outcome as of {new Date(report.asOf).toLocaleString('en-NZ',{timeZone:'Pacific/Auckland'})}.</>:pending?'Reading accepted-job evidence…':'Accepted-job evidence unavailable.'}</p>
    <p className={styles.note}>Credited to the assigned sales designer, independently of who visited or whether a visit is recorded. Each job counts once; all accepted base and add-on scopes are listed. Test records are excluded from sales totals and retained separately for review. Net accepted jobs excludes cancelled, refunded or withdrawn acceptance. Completed sales retain their credit. Values are accepted scope values including GST, not cash received or refund balances.</p>
    <div className={styles.metrics}>{(['jobs','goingAhead','excluded'] as const).map(metric=><button key={metric} disabled={!result} onClick={()=>result&&open(result.total,metric)}><span>{labels[metric]}</span><strong>{result?result.total[metric].length:pending?'Reading…':'Unavailable'}</strong></button>)}</div>
    {result&&result.total.undated.length>0&&<Button variant="quiet" onClick={()=>open(result.total,'undated')}>{result.total.undated.length} jobs have an unknown or future acceptance date. Inspect all-date coverage.</Button>}
    {result&&result.total.tests.length>0&&<Button variant="quiet" onClick={()=>open(result.total,'tests')}>{result.total.tests.length} excluded test records. Inspect or restore.</Button>}
    {result&&!result.total.jobs.length&&<p>No recorded accepted scopes in this selection. Missing acceptance dates are shown separately; no visit record is required.</p>}
      <div className={styles.table}><table aria-label="Accepted jobs by designer"><thead><tr><th>Designer</th><th>Accepted jobs</th><th>Net accepted jobs</th><th>Excluded</th><th>Net accepted scope value</th></tr></thead><tbody>{result?.total.jobs.length?[result.total,...result.rows].map(row=><tr key={row.staffId}><th>{designerName(row.staffId)}</th><td>{button(row,'jobs')}</td><td>{button(row,'goingAhead')}</td><td>{button(row,'excluded')}</td><td>{value(row)}</td></tr>):<tr><td colSpan={5} role={pending?'status':undefined}>{result?'No recorded accepted scopes in this selection.':pending?'Reading the complete accepted-job roster…':'Accepted-job evidence unavailable.'}</td></tr>}</tbody></table></div>
      <div className={styles.mobileRows}>{result?[result.total,...result.rows].map(row=><article key={row.staffId} className={styles.mobileRow}><h3>{designerName(row.staffId)}</h3><p>Accepted jobs {button(row,'jobs')} · Net accepted jobs {button(row,'goingAhead')} · Excluded {button(row,'excluded')}</p><p>{value(row)} accepted scope value</p></article>):<p role={pending?'status':undefined}>{pending?'Reading accepted-job evidence…':'Accepted-job evidence unavailable.'}</p>}</div>
    {result&&result.rows.some(r=>r.staffId==='unassigned'&&r.jobs.length>0)&&<p>Unassigned jobs remain in team totals. Assign the sales designer in the job details; phase owners and visit attendees do not supply this assignment.</p>}
    {selected&&inspect&&report&&<Drawer open title={`${designerName(selected.staffId)} · ${labels[inspect.metric]}`} onClose={()=>setInspect(null)}>
      {!hub?<p role="status">Reading project names and supporting evidence…</p>:<div className={styles.records}><div className={styles.assignmentActions}>{(Object.keys(labels) as Metric[]).map(metric=><Button key={metric} variant="quiet" onClick={()=>open(selected,metric)}>{labels[metric]}: {selected[metric].length}</Button>)}</div>
        <p>{selected[inspect.metric].length} unique jobs. {inspect.metric==='tests'?'Test records are outside sales totals and shown across all acceptance dates. Clear the report-only outcome to restore eligibility.':'Latest recorded accepted revision per scope supplies its acceptance date and value.'} Withdrawn acceptance stays in history. No refund amount or date is inferred.</p>
        <ul>{selected[inspect.metric].slice(page*20,(page+1)*20).map(job=><li key={job.projectId}>
          <strong>{projects.get(job.projectId)?.name??'Accepted project'}</strong><p>{job.exclusion?salesExclusionLabels[job.exclusion]:'Current accepted work'} · {job.scopes.length} accepted scopes · {job.goingAhead.length} net accepted scopes</p>
          {!job.scopes.length&&<p>No recorded accepted scopes. The test classification remains available to clear.</p>}
          {job.scopes.map(scope=><p key={scope.id}>{scope.reference} · {scope.addOn?'Add-on':'Base scope'} · {scope.lastAcceptedAt?new Date(scope.lastAcceptedAt).toLocaleDateString('en-NZ',{timeZone:'Pacific/Auckland'}):'Acceptance date unknown'} · {scope.lastAcceptedValueCents===null?'Value unknown':money(scope.lastAcceptedValueCents)} · {scope.accepted?'Currently accepted':'Acceptance withdrawn'}</p>)}
          <SalesDesignerAssignment value={report.assignments.find(a=>a.projectId===job.projectId)??unassignedDesigner(job.projectId)} onChange={onAssignment} client={assignmentClient} readOnly={synthetic&&!assignmentClient}/>
          <ProjectSalesOutcome value={report.salesOutcomes.find(o=>o.projectId===job.projectId)??unrecordedSalesOutcome(job.projectId)} onChange={onOutcome} client={outcomeClient} readOnly={synthetic&&!outcomeClient}/>
          <a href={synthetic?`/qa/marketing-performance-fixture/project?project=${job.projectId}&return=${encodeURIComponent(window.location.search)}`:`/staff/projects/proj_${job.projectId}?tab=quotes`} target="_blank" rel="noreferrer">Inspect quotes and payment history (new tab)</a>
        </li>)}</ul>
        {!selected[inspect.metric].length&&<p>No matching jobs.</p>}
        <div className={styles.pager}><Button disabled={!page} onClick={()=>setPage(p=>p-1)}>Previous</Button><span>Page {page+1} of {Math.max(1,Math.ceil(selected[inspect.metric].length/20))}</span><Button disabled={(page+1)*20>=selected[inspect.metric].length} onClick={()=>setPage(p=>p+1)}>Next</Button></div>
      </div>}
    </Drawer>}
  </section>;
}
