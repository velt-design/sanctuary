import {z} from 'zod';
import {DESIGN_PACKAGE_DESIGNERS} from '../designPackages/designers';
import {PraxisConnectorError} from './server';
import type {SpecialistCounts,SpecialistCoverage,SpecialistDetail,SpecialistDomain,SpecialistIdentity,SpecialistIssue,SpecialistQuality,SpecialistQuery} from './specialist-workload-contract';

const instant=z.string().datetime({offset:true}).transform(v=>new Date(v).toISOString());
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
const common={projectName:z.string().min(1).max(1024).nullable(),projectPresent:z.boolean(),archived:z.boolean(),
  identityKey:z.string().uuid().nullable(),identityName:z.string().min(1).max(1024).nullable(),identityActive:z.boolean().nullable(),recordedAt:instant};
const installation=z.object({...common,status:z.enum(['not_started','in_progress','paused','done']),plannedStart:date.nullable(),forecastStart:date.nullable(),
  forecastEndExclusive:date.nullable(),actualStart:date.nullable(),actualFinish:date.nullable()}).strict();
const design=z.object({...common,status:z.enum(['OPEN','IN_PROGRESS','BLOCKED','DONE','CANCELLED']),requestedAt:instant,dueAt:instant.nullable(),startedAt:instant.nullable(),completedAt:instant.nullable(),cancelledAt:instant.nullable()}).strict();
const row=z.object({domain:z.enum(['installation','design']),record_id:z.string().uuid(),project_id:z.string().uuid(),payload:z.unknown(),omission_count:z.literal(0)}).strict();
const unavailable=()=>new PraxisConnectorError(503,'SOURCE_UNAVAILABLE','Specialist work evidence could not be verified.',true);
const counts=():SpecialistCounts=>({current:0,completed:0,inconsistent:0});
const coverage=():SpecialistCoverage=>({totalRecords:0,cancelledRecords:0,archivedRecords:0,excludedArchivedRecords:0,completedOutsidePeriod:0,excludedTestRecords:0});
const quality=():SpecialistQuality=>({missingProject:0,archivedCurrent:0,missingCompletion:0,futureActualDate:0,finishBeforeStart:0,completionWithoutDone:0,
  missingStart:0,unassignedCurrent:0,undatedCurrent:0,inactiveCrew:0,unknownIdentityName:0});
function specialistNzDay(value:string) {
  const parts=new Intl.DateTimeFormat('en-NZ',{timeZone:'Pacific/Auckland',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
  return ['year','month','day'].map(k=>parts.find(p=>p.type===k)!.value).join('-');
}
export function buildSpecialistWorkload(raw:readonly unknown[],query:SpecialistQuery,asOf:string) {
  const day=specialistNzDay(asOf),allCounts={installation:counts(),design:counts()},matchingCounts={installation:counts(),design:counts()};
  const covered={installation:coverage(),design:coverage()},qualities={installation:quality(),design:quality()};
  const assignments=new Map<string,{identity:SpecialistIdentity;counts:SpecialistCounts}>(),items:SpecialistDetail[]=[];
  const seen=new Set<string>();
  try {
    for(const rawRow of raw) {
      const source=row.parse(rawRow),domain=source.domain,key=`${domain}:${source.record_id}`;
      if(seen.has(key))throw unavailable();seen.add(key);
      const p=domain==='installation'?installation.parse(source.payload):design.parse(source.payload);
      if(Date.parse(p.recordedAt)>Date.parse(asOf))throw unavailable();
      if(p.projectPresent!==Boolean(p.projectName))throw unavailable();
      const cov=covered[domain],q=qualities[domain];cov.totalRecords++;
      if(source.project_id==='10c5db1a-602c-4f0c-8193-855b186215bb'){cov.excludedTestRecords++;continue;}
      const designer=DESIGN_PACKAGE_DESIGNERS.find(d=>d.id===p.identityKey);
      const name=domain==='installation'?p.identityName:designer?.name??null;
      const identity:SpecialistIdentity={kind:domain==='installation'?'crew':'designer',key:p.identityKey,
        displayName:p.identityKey===null?'Unassigned':name??(domain==='installation'?'Unknown crew':'Unknown designer'),
        nameKnown:p.identityKey===null||name!==null,active:domain==='installation'?p.identityActive:null};
      if(p.archived)cov.archivedRecords++;
      if(p.status==='CANCELLED'){cov.cancelledRecords++;continue;}
      const dates:SpecialistDetail['dates']='actualFinish' in p ? {kind:'installation',plannedStart:p.plannedStart,forecastStart:p.forecastStart,
        forecastEndExclusive:p.forecastEndExclusive,actualStart:p.actualStart,actualFinish:p.actualFinish}
        : {kind:'design',requestedAt:p.requestedAt,dueAt:p.dueAt,startedAt:p.startedAt,completedAt:p.completedAt,cancelledAt:p.cancelledAt};
      const finish=dates.kind==='installation'?dates.actualFinish:dates.completedAt,start=dates.kind==='installation'?dates.actualStart:dates.startedAt;
      const done=p.status==='done'||p.status==='DONE',current=!done;
      const finishDay=finish===null?null:dates.kind==='installation'?finish:specialistNzDay(finish);
      const issues:SpecialistIssue[]=[];
      if(!p.projectPresent)issues.push('missingProject');
      if(p.archived&&current)issues.push('archivedCurrent');
      if(done&&finish===null)issues.push('missingCompletion');
      if((finish!==null&&(dates.kind==='installation'?finish>day:Date.parse(finish)>Date.parse(asOf)))
        ||(start!==null&&(dates.kind==='installation'?start>day:Date.parse(start)>Date.parse(asOf))))issues.push('futureActualDate');
      if(start!==null&&finish!==null&&Date.parse(finish)<Date.parse(start))issues.push('finishBeforeStart');
      if(!done&&finish!==null)issues.push('completionWithoutDone');
      for(const issue of issues)q[issue]++;
      if((done||p.status==='in_progress'||p.status==='IN_PROGRESS')&&start===null)q.missingStart++;
      if(current&&identity.key===null)q.unassignedCurrent++;
      if(current&&(dates.kind==='installation'?dates.plannedStart===null&&dates.forecastStart===null:dates.dueAt===null))q.undatedCurrent++;
      if(identity.kind==='crew'&&identity.active===false)q.inactiveCrew++;
      if(!identity.nameKnown)q.unknownIdentityName++;
      let bucket:SpecialistDetail['bucket'];
      if(issues.length)bucket='inconsistent';
      else if(p.archived){cov.excludedArchivedRecords++;continue;}
      else if(done){if(finishDay!<query.start||finishDay!>query.end){cov.completedOutsidePeriod++;continue;}bucket='completed';}
      else bucket='current';
      const detail:SpecialistDetail={recordId:source.record_id,projectId:source.project_id,projectName:p.projectName,domain,status:p.status,bucket,identity,
        archived:p.archived,recordedAt:p.recordedAt,issues,dates};
      allCounts[domain][bucket]++;
      const identityKey=`${identity.kind}:${identity.key}`;
      const assignment=assignments.get(identityKey)??{identity,counts:counts()};
      if(JSON.stringify(assignment.identity)!==JSON.stringify(identity))throw unavailable();
      assignment.counts[bucket]++;assignments.set(identityKey,assignment);
      if((query.filter.domain==='all'||query.filter.domain===domain)&&(query.filter.bucket==='all'||query.filter.bucket===bucket)
        &&(query.filter.identity===null||(query.filter.identity.kind===identity.kind&&query.filter.identity.key===identity.key))) {
        items.push(detail);matchingCounts[domain][bucket]++;
      }
    }
    if(assignments.size>200)throw unavailable();
  }catch{throw unavailable();}
  // Source domain/status buckets do not move when today's date advances; dates
  // and record UUID settle ties without using a changing request timestamp.
  items.sort((a,b)=>a.domain.localeCompare(b.domain)||a.bucket.localeCompare(b.bucket)||a.recordId.localeCompare(b.recordId));
  return {day,counts:allCounts,matchingCounts,coverage:covered,qualityCounts:qualities,
    assignments:[...assignments.values()].sort((a,b)=>a.identity.kind.localeCompare(b.identity.kind)||(a.identity.key??'').localeCompare(b.identity.key??'')),total:items.length,items};
}
