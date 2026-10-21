import { aucklandDay } from './contract';
import type { DesignerReport,DesignerScope } from './designerContract';

export type SalesExclusion='cancelled'|'refunded'|'closed_lost'|'acceptance_withdrawn'|'outcome_unknown';
export const salesExclusionLabels:Record<SalesExclusion,string>={cancelled:'Cancelled',refunded:'Refunded',closed_lost:'Closed as lost',acceptance_withdrawn:'Acceptance no longer current',outcome_unknown:'Project outcome unavailable'};
export function projectSalesExclusion(report:DesignerReport,projectId:string):SalesExclusion|null {
  const project=report.salesProjects.find(p=>p.projectId===projectId),outcome=report.salesOutcomes.find(o=>o.projectId===projectId)?.outcome;
  // An owner correction cannot clear an independent authoritative cancellation.
  if(project?.closedOutcome==='CANCELLED')return 'cancelled';
  if(project?.closedOutcome?.startsWith('LOST'))return 'closed_lost';
  if(outcome)return outcome;
  return project?null:'outcome_unknown';
}
export type DesignerSaleJob={projectId:string;designerKey:string|null;scopes:DesignerScope[];goingAhead:DesignerScope[];exclusion:SalesExclusion|null};
export type DesignerSalesRow={staffId:string;jobs:DesignerSaleJob[];goingAhead:DesignerSaleJob[];excluded:DesignerSaleJob[];undated:DesignerSaleJob[]};
export function designerSales(report:DesignerReport,projectIds:Set<string>|null=null,designer='',allDates=false) {
  const assignments=new Map(report.assignments.map(a=>[a.projectId,a.designerKey]));
  const all=report.scopes.filter(s=>s.everAccepted&&(!projectIds||projectIds.has(s.projectId))&&(!designer||(assignments.get(s.projectId)??'unassigned')===designer));
  const inPeriod=(s:DesignerScope)=>Boolean(s.lastAcceptedAt&&Date.parse(s.lastAcceptedAt)<=Date.parse(report.asOf)&&aucklandDay(new Date(s.lastAcceptedAt))>=report.start&&aucklandDay(new Date(s.lastAcceptedAt))<=report.end);
  const group=(scopes:DesignerScope[]):DesignerSaleJob[]=>[...new Set(scopes.map(s=>s.projectId))].map(projectId=>{
    const selected=scopes.filter(s=>s.projectId===projectId),reason=projectSalesExclusion(report,projectId);
    const goingAhead=reason?[]:selected.filter(s=>s.accepted);
    return {projectId,designerKey:assignments.get(projectId)??null,scopes:selected,goingAhead,exclusion:reason??(goingAhead.length?null:'acceptance_withdrawn')};
  });
  const jobs=group(all.filter(s=>allDates?(!s.lastAcceptedAt||Date.parse(s.lastAcceptedAt)<=Date.parse(report.asOf)):inPeriod(s))),undated=group(all.filter(s=>!s.lastAcceptedAt||Date.parse(s.lastAcceptedAt)>Date.parse(report.asOf)));
  const summarize=(staffId:string,population:DesignerSaleJob[],unknown:DesignerSaleJob[]):DesignerSalesRow=>({staffId,jobs:population,goingAhead:population.filter(j=>j.goingAhead.length),excluded:population.filter(j=>!j.goingAhead.length),undated:unknown});
  const staff=[...new Set([...jobs,...undated].map(j=>j.designerKey??'unassigned'))].sort();
  return {total:summarize('team',jobs,undated),rows:staff.map(s=>summarize(s,jobs.filter(j=>(j.designerKey??'unassigned')===s),undated.filter(j=>(j.designerKey??'unassigned')===s)))};
}
export function salesScopeValue(scopes:DesignerScope[],current=false):number|null {
  return scopes.some(s=>(current?s.valueCents:s.lastAcceptedValueCents)===null)?null:scopes.reduce((sum,s)=>sum+(current?s.valueCents!:s.lastAcceptedValueCents!),0);
}
