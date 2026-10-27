'use client';
import { overviewProjectIds } from './overviewProjectSelection';
import { useMemo,useState } from 'react';
import DesignerSales from './DesignerSales';
import VisitHistoryCoverage from './VisitHistoryCoverage';
import type { OutcomeClient } from './ProjectSalesOutcome';
import type { SalesOutcome } from '@/lib/marketingPerformance/salesOutcome';
import { Button,Select } from '@/components/ui/foundation/FoundationControls';
import { Drawer } from './MarketingDrawer';
import { AlertBanner } from '@/components/ui/foundation/FoundationAlert';
import { money,type HubReport,type HubFilters } from '@/lib/marketingPerformance/hub';
import { designerPerformance,median,siteVisitResults,type DesignerSummary } from '@/lib/marketingPerformance/designer';
import { salesDesignerOption } from '@/lib/marketingPerformance/salesDesigner';
import type { DesignerReport } from '@/lib/marketingPerformance/designerContract';
import useDesigner,{type DesignerLoader} from './useDesigner';
import DesignerRecords from './DesignerRecords';
import type { SalesDesigner } from '@/lib/marketingPerformance/salesDesigner';
import type { AssignmentClient } from './SalesDesignerAssignment';
import { jobAttributions,type JobAttribution } from '@/lib/marketingPerformance/jobAttribution';
import styles from './DesignerPerformance.module.css';

export type DesignerMetric='assigned'|'attended'|'projects'|'customers'|'booked'|'provisional'|'notAttended'|'unrecorded'|'originals'|'quoted'|'accepted'|'paid'|'value'|'quoteDays'|'depositDays'|'coverage'|'originalVisits'|'measurement'|'followUp'|'unconfirmed'|'averageOrder'|'closeRate';
export const designerName=(id:string)=>id==='team'?'Team':id==='unassigned'?'Unassigned':salesDesignerOption(id)?.displayName??'Unrecognised staff identity';
export const designerMetrics:[DesignerMetric,string][]=[['assigned','Designer projects'],['attended','Visits completed'],['projects','Projects visited'],['customers','Customers visited'],['originals','Original-visit projects'],['quoted','Quoted'],['accepted','Jobs won'],['averageOrder','Avg order value'],['closeRate','Close rate'],['paid','Paid sales'],['value','Paid scope value'],['quoteDays','Days to quote'],['depositDays','Days to deposit']];
export function designerMetricValue(row:DesignerSummary,key:DesignerMetric):string {
  if(key==='averageOrder'||key==='closeRate'){const results=siteVisitResults(row);const value=key==='averageOrder'?results.averageOrderValueCents:results.closeRate;return value===null?'Unavailable':key==='averageOrder'?money(Math.round(value)):`${Math.round(value)}%`;}
  if(key==='assigned')return String(new Set(row.assignedVisits.map(v=>v.projectId)).size);
  if(key==='projects'||key==='customers')return String(row[key]);
  if(['attended','booked','provisional','notAttended','unrecorded'].includes(key))return String(row[key as 'attended'].length);
  if(key==='originals')return String(row.outcomes.length);
  if(key==='value'){const paid=row.outcomes.flatMap(o=>o.paid);if(!row.outcomes.length)return 'Unavailable';if(paid.some(s=>s.valueCents===null))return 'Value incomplete';return money(paid.reduce((n,s)=>n+s.valueCents!,0));}
  if(key==='quoteDays'||key==='depositDays'){const n=median(row.outcomes.map(o=>o[key]));return n===null?'Unavailable':`${n.toFixed(1)} days`;}
  if(key==='quoted'||key==='accepted'||key==='paid'){if(!row.outcomes.length)return 'Unavailable';const unknown=key==='quoted'?row.outcomes.some(o=>o.undatedQuotes.length):key==='accepted'?row.outcomes.some(o=>o.undatedAcceptances.length):false;return `${row.outcomes.filter(o=>o[key].length).length}${unknown?' · Date coverage incomplete':''}`;}
  return '';
}
export default function DesignerPerformance({hub,filters,apply,loader,synthetic=false,revision=0,assignmentClient,outcomeClient,evidence,retryEvidence,projectError}:{projectError?:string;hub:HubReport|null;filters:HubFilters;apply:(f:HubFilters)=>void;loader?:DesignerLoader;synthetic?:boolean;revision?:number;assignmentClient?:AssignmentClient;outcomeClient?:OutcomeClient;evidence?:ReturnType<typeof useDesigner>;retryEvidence?:()=>void}){
  const [retry,setRetry]=useState(0),[inspect,setInspect]=useState<{key:DesignerMetric;staffId:string;report:DesignerReport;filters:string}|null>(null);
  const local=useDesigner(evidence?null:filters,revision+retry,loader);
  const {report,busy,error:readError}=evidence??local;
  const error=readError||(!hub?projectError:'');
  const [changes,setChanges]=useState<{report:DesignerReport;values:SalesDesigner[]}|null>(null);
  const [outcomeChanges,setOutcomeChanges]=useState<{report:DesignerReport;values:SalesOutcome[]}|null>(null);
  const assignmentReport=useMemo(()=>report&&changes?.report===report?{...report,assignments:[...report.assignments.filter(a=>!changes.values.some(v=>v.projectId===a.projectId)),...changes.values]}:report,[report,changes]);
  const effective=useMemo(()=>assignmentReport&&outcomeChanges?.report===report?{...assignmentReport,salesOutcomes:[...assignmentReport.salesOutcomes.filter(a=>!outcomeChanges.values.some(v=>v.projectId===a.projectId)),...outcomeChanges.values]}:assignmentReport,[assignmentReport,outcomeChanges,report]);
  const outcomeChanged=(value:SalesOutcome)=>{if(report)setOutcomeChanges(previous=>({report,values:[...(previous?.report===report?previous.values:[]).filter(v=>v.projectId!==value.projectId),value]}));};
  const assigned=(value:SalesDesigner)=>{if(report)setChanges(previous=>({report,values:[...(previous?.report===report?previous.values:[]).filter(v=>v.projectId!==value.projectId),value]}));};
  const ids=overviewProjectIds(hub,filters);
  // Visit evidence can include unlinked/orphan records. The complete Hub
  // intersection remains required even when no project filters are selected.
  const projectSelectionMissing=!hub;
  const waitingForProjects=projectSelectionMissing&&!error;
  const result=effective&&!busy&&!projectSelectionMissing?designerPerformance(effective,ids,filters.designer):null;
  const attributions=useMemo(()=>effective&&hub&&!busy?jobAttributions(effective,hub,ids):new Map<string,JobAttribution>(),[effective,hub,busy,ids]);
  const undatedAttended=result?.coverage.filter(c=>!c.visit.day&&c.visit.status==='attended').length??0;
  const recordedRoster=effective?[...effective.visits.flatMap(v=>v.staff),...effective.assignments.flatMap(a=>a.designerKey?[a.designerKey]:[])].filter(id=>salesDesignerOption(id)):[];
  // A selected zero-activity designer must stay visible through clear and refresh.
  const roster=[...new Set([...recordedRoster,...[...attributions.values()].map(value=>value.designerKey),...(filters.designer&&filters.designer!=='unassigned'?[filters.designer]:[])])].sort();
  const stale=report&&(!report.source.enabled||report.source.failed||!report.source.lastSuccess||Date.parse(report.asOf)-Date.parse(report.source.lastSuccess)>1800000);
  const filterKey=JSON.stringify(filters);
  const selectedRow=result&&inspect&&report===inspect.report&&filterKey===inspect.filters?[result!.total,...result!.rows].find(r=>r.staffId===inspect.staffId):null;
  const selection=inspect&&selectedRow?{key:inspect.key,row:selectedRow}:null;
  const open=(key:DesignerMetric,row:DesignerSummary)=>{if(report)setInspect({key,staffId:row.staffId,report,filters:filterKey});};
  const resultMetric=(row:DesignerSummary,key:DesignerMetric)=>{
    const value=designerMetricValue(row,key),summary=siteVisitResults(row);
    const unavailable=value==='Unavailable';
    const reason=key==='averageOrder'?(summary.dateIncomplete?'Acceptance dates incomplete':summary.valueIncomplete?'Accepted value missing':!summary.eligible?'No eligible originals':!summary.won?'No jobs won':''):key==='closeRate'&&summary.dateIncomplete?'Acceptance dates incomplete':key==='accepted'&&!summary.eligible?'No eligible originals':'';
    return <><button aria-label={`${designerName(row.staffId)}: ${designerMetrics.find(m=>m[0]===key)![1]}, ${value}`} onClick={()=>open(key,row)}>{unavailable?'—':value}</button>{reason&&<small>{reason}</small>}{key==='closeRate'&&summary.assumedOriginals>0&&<small>{summary.assumedOriginals} original purposes assumed</small>}</>;
  };
  return <section className={styles.section} aria-label="Site visits and sales" aria-busy={busy||waitingForProjects}>
    <div className={styles.heading}><div><h2>Site visit results</h2><p>Who visited, what turned into a job, and the value of those jobs.</p></div>
      <Select label="Designer" value={filters.designer??''} onChange={e=>{setInspect(null);apply({...filters,designer:e.target.value});}}><option value="">All designers</option>{roster.map(id=><option key={id} value={id}>{designerName(id)}</option>)}<option value="unassigned">Unassigned</option></Select></div>
    <div>{busy||waitingForProjects?<p role="status">{report?'Reading complete project membership…':'Loading accepted jobs, visits and sale evidence…'}</p>:error?<AlertBanner tone="error" title="Designer evidence unavailable" action={<Button onClick={()=>retryEvidence?retryEvidence():setRetry(n=>n+1)} variant="secondary">Retry</Button>}>{error} No partial totals are shown.</AlertBanner>:null}</div>
      {report&&stale&&<p className={styles.notice} role="status">{!report.source.enabled?'Outlook records are withheld because the calendar source is disabled. Activity below includes manual history only; conversion is unavailable.':report.source.failed?'The latest calendar update failed. Figures below use saved records.':'Calendar source needs a fresh update. Figures below use saved records.'} <a href="/staff/site-visits" target="_blank" rel="noreferrer">Review calendar source</a></p>}
      <p className={styles.note}>Visits in the selected dates. Jobs won means currently accepted, with outcomes checked to {report?new Date(report.asOf).toLocaleDateString('en-NZ',{timeZone:'Pacific/Auckland'}):'the report date'}.</p>
      <VisitHistoryCoverage report={result?effective:null} performance={result} projectIds={ids} hub={hub} allDates={filters.acceptedDates==='all'} selectionKey={filterKey} selectedPerson={Boolean(filters.designer)} pending={busy||waitingForProjects} synthetic={synthetic} attributions={attributions}/>
      <div className={styles.mobileRows} aria-label="Site visit results on small screens">{!result&&<div className={styles.mobileRow}><strong>Team</strong><dl>{['Visits completed','Jobs won','Avg order value','Close rate'].map(label=><div key={label}><dt>{label}</dt><dd>{busy||waitingForProjects?'Reading...':'Unavailable'}</dd></div>)}</dl></div>}{(result?[result.total,...result.rows]:[]).map(row=><div key={row.staffId} className={styles.mobileRow}><div><strong>{designerName(row.staffId)}</strong><Button variant="quiet" onClick={()=>open('attended',row)}>Details</Button></div><dl>{(['attended','accepted','averageOrder','closeRate'] as const).map(key=><div key={key}><dt>{designerMetrics.find(m=>m[0]===key)![1]}</dt><dd>{resultMetric(row,key)}{key==='closeRate'&&<small>{row.outcomes.length?`${siteVisitResults(row).won} won / ${row.outcomes.length} original projects`:'No eligible original visits'}</small>}</dd></div>)}</dl></div>)}</div>
      <div className={`${styles.table} ${styles.visitTable}`} role="region" tabIndex={0} aria-label="Site visit comparison"><table aria-label="Recorded visit conversion"><thead><tr><th>Person</th><th>Visits completed</th><th>Jobs won</th><th>Avg order value</th><th>Close rate</th><th><span className={styles.moreHeading}>Details</span></th></tr></thead><tbody>{!result&&<tr><td colSpan={6} role={busy||waitingForProjects?'status':undefined}>{busy||waitingForProjects?'Reading the complete visit roster...':'Visit evidence unavailable.'}</td></tr>}{(result?[result.total,...result.rows]:[]).map(row=>{const summary=siteVisitResults(row);return <tr key={row.staffId}><th scope="row">{designerName(row.staffId)}{row.staffId==='team'&&<small>Each visit and job once</small>}</th>{(['attended','accepted','averageOrder','closeRate'] as const).map(key=><td key={key}>{resultMetric(row,key)}{key==='closeRate'&&<small>{summary.eligible?`${summary.won} won / ${summary.eligible} original projects${summary.eligible<10?'; Small cohort':''}`:'No eligible original visits'}</small>}</td>)}<td><Button variant="quiet" onClick={()=>open('attended',row)}>More</Button></td></tr>;})}</tbody></table></div>
      <p className={styles.note}>Close rate = jobs won / eligible original-visit projects. Repeat visits count as visits, not new opportunities. Average order value includes GST and excludes add-ons. Joint visitors each get credit; team totals count each job once.</p>
      {undatedAttended>0&&<button className={styles.undated} disabled={!result} onClick={()=>result&&open('coverage',result.total)}>{undatedAttended} further attended {undatedAttended===1?'visit has':'visits have'} no date and cannot enter the selected period. Review dates.</button>}
      {result&&!result.total.outcomes.length&&<p className={styles.notice}>Conversion is unavailable for this selection. It needs a dated original visit with verified attendance and project. Review the records below.</p>}
      {result&&!result.total.visits.length&&<p>{filters.designer?`No dated personal visit workload is recorded for ${designerName(filters.designer)} in this period. Assigned sales evidence is shown separately.`:'No dated visit workload matches this selection. This does not establish that no visits took place.'}</p>}
      <Button className={styles.reviewButton} variant="quiet" disabled={!result} onClick={()=>result&&open('coverage',result.total)}>{result?`Review ${result.coverage.length} records`:'Review records'} needing attendance, purpose, date or attribution checks</Button>
      {report&&<details className={styles.definitions}><summary>More visit activity, definitions and history</summary><div className={styles.activity}>{(['booked','provisional','notAttended','unrecorded'] as const).map((key,i)=><Button key={key} variant="quiet" disabled={!result} onClick={()=>result&&open(key,result.total)}>{['Booked / no outcome','Provisional','Did not take place','Past bookings without attendance'][i]}: {result?result.total[key].length:busy||waitingForProjects?'Reading...':'Unavailable'}</Button>)}</div><p>Conversion is credited to the actual attendees of the original visit, independently of assigned sales responsibility. The Designer filter selects that person’s visit results here and assigned sales in the separate section below. Current project-owner filters only narrow projects. Only explicit attendance counts as attended. Return measurements and follow-ups add workload but no new sales credit. Conversion uses the first recorded, dated original visit for each project. Conflicting originals and uncertain or pre-visit payments are excluded. Historical records may be incomplete; earlier missing visits cannot be inferred from the first calendar import.</p><p>Jobs won counts distinct projects with a currently accepted initial scope after the qualifying visit, whether or not a deposit has arrived. Cancelled, refunded and withdrawn jobs retain visit history but no positive accepted or paid credit. Average order value divides the sum of those accepted initial scope values by jobs won. Missing acceptance dates leave close rate and average unavailable; missing accepted value leaves the average unavailable. Quoted, accepted and paid figures count distinct projects after the qualifying visit. Paid sales require a positive unreversed first deposit against a currently accepted initial scope. Scope value is the full accepted NZD amount including GST, not cash received. Add-on scopes do not count as acquisition. Projects without a deposit are not automatically lost. Accepted scope changes or payment reversals can restate outcomes.</p><p>Timing medians use only ordered known pairs. Date-only visits need an outcome on a later Auckland day; exact timed visits allow ordered same-day pairs. Missing dates stay unknown. Unknown-date visit records are shown in review across all dates. Project counts and customer counts deduplicate saved IDs; missing links cannot enter those counts.</p><p>Outlook first imported: {report.source.firstImportedAt?new Date(report.source.firstImportedAt).toLocaleDateString('en-NZ',{timeZone:'Pacific/Auckland'}):'Not recorded'}. Latest successful sync: {report.source.lastSuccess?new Date(report.source.lastSuccess).toLocaleString('en-NZ',{timeZone:'Pacific/Auckland'}):'Not recorded'}. Read at {new Date(report.asOf).toLocaleString('en-NZ',{timeZone:'Pacific/Auckland'})} NZ.</p></details>}
      <div className={styles.salesSection}>
      <DesignerSales report={result?effective:null} attributions={attributions} snapshot={report} pending={busy||waitingForProjects} period={filters} filterKey={filterKey} projectIds={ids} designer={filters.designer??''} allDates={filters.acceptedDates==='all'} onPeriod={all=>apply({...filters,acceptedDates:all?'all':'selected'})} hub={hub} synthetic={synthetic} onAssignment={assigned} onOutcome={outcomeChanged} assignmentClient={assignmentClient} outcomeClient={outcomeClient}/>
      </div>
      <Drawer open={Boolean(selection)} onClose={()=>setInspect(null)} title={selection?`${designerName(selection!.row.staffId)} · ${selection!.key==='coverage'?'Records needing review':designerMetrics.find(m=>m[0]===selection!.key)?.[1]??selection!.key}`:'Visit records'}>{selection&&hub&&report&&result&&effective&&<DesignerRecords key={`${selection!.row.staffId}:${selection!.key}:${report.asOf}`} metric={selection!.key} row={selection!.row} coverage={result.coverage} hub={hub} synthetic={synthetic} assignments={effective!.assignments} onAssignment={assigned} assignmentClient={assignmentClient}/>}{selection&&!hub&&<p role="status">Reading project names and supporting evidence…</p>}</Drawer>
  </section>;
}
