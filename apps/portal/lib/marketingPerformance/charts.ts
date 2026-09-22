import { aucklandDay, summarize, UNKNOWN_SOURCE, type MarketingRow } from './contract';
import { weeklyEnquiries } from './trends';
import { normalizePipelineStageKey, PIPELINE_STAGES } from '@/lib/projects/pipelineDefinition';
import type { HubProject } from './hub';

export const chartMetrics = { enquiries:'Enquiries', qualified:'Qualified enquiries', quote:'Sent-quote projects', accepted:'Accepted-scope projects', won:'Payment-verified projects' } as const;
export type ChartMetric = keyof typeof chartMetrics;
export function sourceColour(source:string) {
  if(source===UNKNOWN_SOURCE)return '#77736c';
  const fixed:Record<string,string>={google:'#276987',meta:'#725298',newsletter:'#467346'};
  if(Object.hasOwn(fixed,source.toLowerCase()))return fixed[source.toLowerCase()];
  const palette=['#936127','#397b72','#98545c','#566c9c'];
  return palette[[...source].reduce((n,c)=>n+c.charCodeAt(0),0)%palette.length];
}
export function enquiryWeeks(rows:MarketingRow[],start:string,end:string) {
  const sources=[...new Set(rows.map(r=>r.source??UNKNOWN_SOURCE))].sort();
  const weeks=weeklyEnquiries(rows,start,end).map(w=>({...w, label:w.start.slice(5),values:sources.map(()=>0)}));
  for(const row of rows){
    const day=aucklandDay(new Date(row.receivedAt));
    const week=weeks.find(w=>w.start<=day&&w.end>=day);
    if(week)week.values[sources.indexOf(row.source??UNKNOWN_SOURCE)]++;
  }
  return {sources,weeks};
}
export function sourceMeasures(rows:MarketingRow[],metric:ChartMetric,scale:string) {
  const groups=new Map<string,MarketingRow[]>();
  for(const row of rows){const key=row.source??UNKNOWN_SOURCE;groups.set(key,[...(groups.get(key)??[]),row]);}
  return [...groups].map(([source,group])=>{
    const s=summarize(group), count=s[metric];
    const denominator=metric==='enquiries'?rows.length:metric==='qualified'?s.eligible:s.origins;
    const assessed=s.qualified+s.notQualified;
    const unavailable=metric==='qualified'&&!assessed || scale==='rate'&&!denominator;
    return {source,count,denominator,unreviewed:s.unreviewed,unavailable,value:unavailable?0:scale==='rate'?100*count/denominator:count,
      display:unavailable?'Unavailable':scale==='rate'?`${(100*count/denominator).toFixed(1)}%`:String(count)};
  }).sort((a,b)=>b.value-a.value||a.source.localeCompare(b.source));
}
export const portfolioStates=['ACTIVE','WAITING','CLOSED','ARCHIVED','UNKNOWN'] as const;
export const stateColours=['#397b72','#936127','#725298','#77736c','#98545c'];
export function portfolioStages(projects:HubProject[]) {
  return [...PIPELINE_STAGES,{key:'__unknown',label:'Unknown stage'}].map(stage=>{
    const rows=projects.filter(p=>(normalizePipelineStageKey(p.stage)??'__unknown')===stage.key);
    return {...stage, total:rows.length,values:portfolioStates.map(state=>rows.filter(p=>p.state===state).length)};
  });
}
