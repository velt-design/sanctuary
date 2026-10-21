import { aucklandDay } from './contract';
import type { DesignerReport,DesignerVisit,DesignerScope } from './designerContract';
import { projectOwnerOption } from '@/lib/projects/commandCentre/projectOwners';

export const visitIssueLabels:Record<string,string>={date:'Date not recorded',future:'Attendance dated in the future',identity:'Attendee identity not verified',link:'Project not linked',purpose:'Original purpose not confirmed',source:'Source or review questions unresolved',originals:'Conflicting original visits',originalIncomplete:'Another original record needs verification',chronology:'Sale predates visit or ordering is unknown'};
const periodVisit=(v:DesignerVisit,r:DesignerReport)=>Boolean(v.day&&v.day>=r.start&&v.day<=r.end);
const activeVisit=(v:DesignerVisit)=>!v.removed&&!v.withdrawn&&v.kind!=='excluded';
const instantDay=(s:string)=>aucklandDay(new Date(s));
export function afterVisit(at:string|null,v:DesignerVisit,asOf:string):boolean {
  if(!at||Date.parse(at)>Date.parse(asOf)||!v.day)return false;
  return v.at?Date.parse(at)>=Date.parse(v.at):instantDay(at)>v.day;
}
function visitIssues(v:DesignerVisit,r:DesignerReport):string[]{
  const issues:string[]=[];
  if(!v.day)issues.push('date');
  if(v.day&&(v.day>instantDay(r.asOf)||(v.at&&Date.parse(v.at)>Date.parse(r.asOf))))issues.push('future');
  if(!v.staff.length||v.unmappedStaff||v.staff.some(id=>!projectOwnerOption(id)))issues.push('identity');
  if(!v.projectId)issues.push('link');
  if(v.kind==='review'||v.duplicate||v.changed||v.questions)issues.push('source');
  return issues;
}
type DesignerOutcome={visit:DesignerVisit;quoted:DesignerScope[];accepted:DesignerScope[];paid:DesignerScope[];undatedQuotes:DesignerScope[];undatedAcceptances:DesignerScope[];quoteDays:number|null;depositDays:number|null};
export type DesignerSummary={staffId:string;visits:DesignerVisit[];attended:DesignerVisit[];booked:DesignerVisit[];provisional:DesignerVisit[];notAttended:DesignerVisit[];unrecorded:DesignerVisit[];projects:number;customers:number;outcomes:DesignerOutcome[]};
const unique=(values:(string|null)[])=>new Set(values.filter(Boolean)).size;
const days=(at:string|null,v:DesignerVisit,asOf:string)=>afterVisit(at,v,asOf)?v.at?(Date.parse(at!)-Date.parse(v.at))/86400000:(Date.parse(instantDay(at!)+'T00:00:00Z')-Date.parse(v.day!+'T00:00:00Z'))/86400000:null;
export function median(values:(number|null)[]){const sorted=values.filter((v):v is number=>v!==null).sort((a,b)=>a-b);return sorted.length?(sorted[Math.floor(sorted.length/2)]+sorted[Math.floor((sorted.length-1)/2)])/2:null;}
export function designerPerformance(report:DesignerReport,projectIds:Set<string>|null=null,designer='') {
  const all=report.visits.filter(v=>activeVisit(v)&&(!projectIds||v.projectId&&projectIds.has(v.projectId)));
  const visible=(v:DesignerVisit)=>!designer||(designer==='unassigned'?v.unmappedStaff>0||!v.staff.length||v.staff.some(id=>!projectOwnerOption(id)):v.staff.includes(designer));
  const period=all.filter(v=>periodVisit(v,report)&&visible(v));
  const issues=new Map<string,string[]>(all.map(v=>[v.id,visitIssues(v,report)]));
  const originals=new Map<string,DesignerVisit[]>();
  for(const v of all)if(v.status==='attended'&&v.purpose==='initial'&&!v.cancelled&&v.projectId)originals.set(v.projectId,[...(originals.get(v.projectId)??[]),v]);
  const outcomes:DesignerOutcome[]=[];
  for(const [projectId,visits] of originals){
    const ordered=[...visits].sort((a,b)=>(a.day??'').localeCompare(b.day??'')||(a.at??'').localeCompare(b.at??'')||a.id.localeCompare(b.id));
    const first=ordered[0];
    // Unresolved originals could precede the apparent first. Never silently allocate them away.
    const incomplete=ordered.some(v=>issues.get(v.id)!.length);
    if(incomplete){for(const v of ordered)if(!issues.get(v.id)!.length)issues.set(v.id,['originalIncomplete']);continue;}
    const conflict=ordered.some(v=>[...v.staff].sort().join('|')!==[...first.staff].sort().join('|'))
      ||ordered.some((v,i)=>i>0&&v.day===first.day&&(!v.at||!first.at||v.at===first.at));
    if(conflict){for(const v of visits)issues.set(v.id,[...issues.get(v.id)!,'originals']);continue;}
    const scopes=report.scopes.filter(s=>s.projectId===projectId&&!s.addOn);
    if(scopes.some(s=>(s.paymentEvidence&&!s.paidAt)||(s.paidAt&&!afterVisit(s.paidAt,first,report.asOf)))){for(const v of visits)issues.set(v.id,[...issues.get(v.id)!,'chronology']);continue;}
    if(!periodVisit(first,report)||!visible(first))continue;
    const quoted=scopes.filter(s=>afterVisit(s.firstSentAt,first,report.asOf));
    const accepted=scopes.filter(s=>s.accepted&&afterVisit(s.acceptedAt,first,report.asOf));
    const paid=scopes.filter(s=>afterVisit(s.paidAt,first,report.asOf));
    const quoteAt=scopes.some(s=>s.undatedSend)?null:scopes.map(s=>s.firstSentAt).filter((s):s is string=>Boolean(s)).sort()[0]??null;
    const paidAt=paid.map(s=>s.paidAt!).sort()[0]??null;
    outcomes.push({visit:first,quoted,accepted,paid,undatedQuotes:scopes.filter(s=>s.undatedSend),undatedAcceptances:scopes.filter(s=>s.accepted&&!s.acceptedAt),quoteDays:days(quoteAt,first,report.asOf),depositDays:days(paidAt,first,report.asOf)});
  }
  const summarize=(staffId:string,visits:DesignerVisit[],cohort:DesignerOutcome[]):DesignerSummary=>{
    const attended=visits.filter(v=>v.status==='attended'&&!v.cancelled&&!visitIssues(v,report).some(i=>['future','source'].includes(i)));
    return {staffId,visits,attended,booked:visits.filter(v=>!v.cancelled&&v.kind==='visit'&&(v.status===null||v.status==='booked')),
      provisional:visits.filter(v=>!v.cancelled&&v.kind==='provisional'),notAttended:visits.filter(v=>v.status==='not_attended'||v.status==='cancelled'||v.cancelled),
      unrecorded:visits.filter(v=>v.day!<instantDay(report.asOf)&&!v.cancelled&&v.status!=='attended'&&v.status!=='not_attended'),
      projects:unique(attended.map(v=>v.projectId)),customers:unique(attended.map(v=>v.contactId)),outcomes:cohort};
  };
  const staff=[...new Set(all.filter(v=>visible(v)&&(!v.day||periodVisit(v,report))).flatMap(v=>[...v.staff.filter(id=>projectOwnerOption(id)),...(!v.staff.length||v.unmappedStaff||v.staff.some(id=>!projectOwnerOption(id))?['unassigned']:[])]))].sort();
  const rows=staff.filter(s=>!designer||s===designer).map(s=>summarize(s,period.filter(v=>s==='unassigned'?v.unmappedStaff>0||!v.staff.length||v.staff.some(id=>!projectOwnerOption(id)):v.staff.includes(s)),outcomes.filter(o=>o.visit.staff.includes(s))));
  const coverage=all.filter(visible).filter(v=>!v.day||periodVisit(v,report)).map(v=>({visit:v,reasons:[...issues.get(v.id)!,...(v.purpose==='initial'||v.purpose==='measurement'||v.purpose==='follow_up'?[]:['purpose']),...(v.day&&v.day<instantDay(report.asOf)&&!v.cancelled&&v.status!=='attended'&&v.status!=='not_attended'?['attendance']:[])]})).filter(v=>v.reasons.length);
  return {rows,total:summarize('team',period,outcomes),coverage,issues};
}
