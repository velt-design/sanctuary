import { aucklandDay } from './contract';
import type { DesignerReport,DesignerScope } from './designerContract';

export type SalesExclusion='test'|'cancelled'|'refunded'|'closed_lost'|'acceptance_withdrawn'|'outcome_unknown';
export const salesExclusionLabels:Record<SalesExclusion,string>={test:'Test record (excluded)',cancelled:'Cancelled',refunded:'Refunded',closed_lost:'Closed as lost',acceptance_withdrawn:'Acceptance no longer current',outcome_unknown:'Project outcome unavailable'};
export const isTestSalesProject=(report:DesignerReport,projectId:string)=>report.salesOutcomes.some(o=>o.projectId===projectId&&o.outcome==='test');
export function projectSalesExclusion(report:DesignerReport,projectId:string):SalesExclusion|null {
  const project=report.salesProjects.find(p=>p.projectId===projectId),outcome=report.salesOutcomes.find(o=>o.projectId===projectId)?.outcome;
  // An owner correction cannot clear an independent authoritative cancellation.
  if(project?.closedOutcome==='CANCELLED')return 'cancelled';
  if(project?.closedOutcome?.startsWith('LOST'))return 'closed_lost';
  if(outcome)return outcome;
  return project?null:'outcome_unknown';
}
export type DesignerSaleJob={projectId:string;designerKey:string|null;scopes:DesignerScope[];goingAhead:DesignerScope[];exclusion:SalesExclusion|null};
export type DesignerSalesRow={staffId:string;jobs:DesignerSaleJob[];goingAhead:DesignerSaleJob[];excluded:DesignerSaleJob[];undated:DesignerSaleJob[];tests:DesignerSaleJob[]};
export function designerSales(report:DesignerReport,projectIds:Set<string>|null=null,designer='',allDates=false) {
  const assignments=new Map(report.assignments.map(a=>[a.projectId,a.designerKey]));
  const all=report.scopes.filter(s=>s.everAccepted&&(!projectIds||projectIds.has(s.projectId))&&(!designer||(assignments.get(s.projectId)??'unassigned')===designer));
  const business=all.filter(s=>!isTestSalesProject(report,s.projectId));
  const inPeriod=(s:DesignerScope)=>Boolean(s.lastAcceptedAt&&Date.parse(s.lastAcceptedAt)<=Date.parse(report.asOf)&&aucklandDay(new Date(s.lastAcceptedAt))>=report.start&&aucklandDay(new Date(s.lastAcceptedAt))<=report.end);
  const group=(scopes:DesignerScope[]):DesignerSaleJob[]=>[...new Set(scopes.map(s=>s.projectId))].map(projectId=>{
    const selected=scopes.filter(s=>s.projectId===projectId),reason=projectSalesExclusion(report,projectId);
    const goingAhead=reason?[]:selected.filter(s=>s.accepted);
    return {projectId,designerKey:assignments.get(projectId)??null,scopes:selected,goingAhead,exclusion:reason??(goingAhead.length?null:'acceptance_withdrawn')};
  });
  const jobs=group(business.filter(s=>allDates?(!s.lastAcceptedAt||Date.parse(s.lastAcceptedAt)<=Date.parse(report.asOf)):inPeriod(s))),undated=group(business.filter(s=>!s.lastAcceptedAt||Date.parse(s.lastAcceptedAt)>Date.parse(report.asOf)));
  const tests:DesignerSaleJob[]=report.salesOutcomes.filter(o=>o.outcome==='test'&&(!projectIds||projectIds.has(o.projectId))&&(!designer||(assignments.get(o.projectId)??'unassigned')===designer)).map(o=>({projectId:o.projectId,designerKey:assignments.get(o.projectId)??null,scopes:all.filter(s=>s.projectId===o.projectId),goingAhead:[],exclusion:'test'}));
  const summarize=(staffId:string,population:DesignerSaleJob[],unknown:DesignerSaleJob[],testJobs:DesignerSaleJob[]):DesignerSalesRow=>({staffId,jobs:population,goingAhead:population.filter(j=>j.goingAhead.length),excluded:population.filter(j=>!j.goingAhead.length),undated:unknown,tests:testJobs});
  const staff=[...new Set([...jobs,...undated,...tests].map(j=>j.designerKey??'unassigned'))].sort();
  return {total:summarize('team',jobs,undated,tests),rows:staff.map(s=>summarize(s,jobs.filter(j=>(j.designerKey??'unassigned')===s),undated.filter(j=>(j.designerKey??'unassigned')===s),tests.filter(j=>(j.designerKey??'unassigned')===s)))};
}
export function salesScopeValue(scopes:DesignerScope[],current=false):number|null {
  return scopes.some(s=>(current?s.valueCents:s.lastAcceptedValueCents)===null)?null:scopes.reduce((sum,s)=>sum+(current?s.valueCents!:s.lastAcceptedValueCents!),0);
}
