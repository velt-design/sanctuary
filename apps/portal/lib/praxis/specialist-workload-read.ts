import {createHash} from 'node:crypto';
import {z} from 'zod';
import {DESIGN_PACKAGE_DESIGNERS} from '../designPackages/designers';
import {parseWorkloadQuery} from './workload-read';
import {PraxisConnectorError,withPraxisReadTransaction,type ConnectorConfig,type PraxisServerDependencies} from './server';
import type {SpecialistQuery,SpecialistWorkload} from './specialist-workload-contract';
import {buildSpecialistWorkload} from './specialist-workload-projection';

const invalid=()=>new PraxisConnectorError(400,'INVALID_QUERY','Choose a valid specialist work filter and 1–90 New Zealand dates through today.');
export function parseSpecialistQuery(url:URL,now=new Date()):SpecialistQuery {
  const p=url.searchParams,allowed=['start','end','limit','offset','snapshot','domain','bucket','identityKind','identityKey'];
  if([...p.keys()].some(k=>!allowed.includes(k)||p.getAll(k).length!==1))throw invalid();
  const base=new URL('https://validation.invalid');for(const key of ['start','end','limit'])if(p.has(key))base.searchParams.set(key,p.get(key)!);
  const {start,end,limit}=parseWorkloadQuery(base,now);
  const domain=p.get('domain')??'all',bucket=p.get('bucket')??'all',kind=p.get('identityKind'),key=p.get('identityKey');
  const offset=p.get('offset')??'0',snapshot=p.get('snapshot');
  if(!['all','installation','design'].includes(domain)||!['all','current','completed','inconsistent'].includes(bucket)
    || !/^(0|[1-9][0-9]*)$/.test(offset)||!Number.isSafeInteger(Number(offset))
    || (snapshot!==null&&!/^[a-f0-9]{64}$/.test(snapshot))||(Number(offset)>0&&snapshot===null)
    || (kind!==null&&!['crew','designer'].includes(kind))||(kind===null&&key!==null)
    || (key!==null&&!z.string().uuid().safeParse(key).success)
    || (domain==='installation'&&kind==='designer')||(domain==='design'&&kind==='crew'))throw invalid();
  return {start,end,limit,offset:Number(offset),snapshot,filter:{domain:domain as SpecialistQuery['filter']['domain'],bucket:bucket as SpecialistQuery['filter']['bucket'],
    identity:kind===null?null:{kind:kind as 'crew'|'designer',key:key?.toLowerCase()??null}}};
}
const specialistUnavailable=()=>new PraxisConnectorError(503,'SOURCE_UNAVAILABLE','Specialist work evidence could not be verified.',true);
export async function readPraxisSpecialistWorkload(query:SpecialistQuery,config:ConnectorConfig,requestId:string,dependencies?:PraxisServerDependencies):Promise<SpecialistWorkload> {
  // Normalize caller input through the same bounded HTTP contract.
  const p=new URLSearchParams({start:query.start,end:query.end,limit:String(query.limit),offset:String(query.offset),domain:query.filter.domain,bucket:query.filter.bucket});
  if(query.snapshot!==null)p.set('snapshot',query.snapshot);
  if(query.filter.identity){p.set('identityKind',query.filter.identity.kind);if(query.filter.identity.key!==null)p.set('identityKey',query.filter.identity.key);}
  query=parseSpecialistQuery(new URL(`https://validation.invalid/?${p}`),new Date());
  const result=await withPraxisReadTransaction(config,async sql=>{
    const time=await sql<{as_of:string}[]>`select transaction_timestamp()::text as as_of`;
    // One complete bounded population, never a first-page aggregate. Overflow
    // withholds the entire response. Filtering/paging follows validation.
    const rows=await sql`select domain,record_id::text,project_id::text,payload,omission_count from praxis_reporting.specialist_workload_v1 order by domain,record_id limit 10001`;
    return {rows,asOf:new Date(time[0]!.as_of).toISOString()};
  },dependencies);
  if(result.rows.length>10000)throw specialistUnavailable();
  const projection=buildSpecialistWorkload(result.rows,query,result.asOf);
  const snapshot=createHash('sha256').update(JSON.stringify({rows:result.rows,roster:DESIGN_PACKAGE_DESIGNERS,
    sourceKey:config.sourceKey,connectionId:config.connectionId,environment:config.environment,
    start:query.start,end:query.end,filter:query.filter,day:projection.day})).digest('hex');
  if(query.snapshot!==null&&query.snapshot!==snapshot)throw new PraxisConnectorError(409,'WORKLOAD_SNAPSHOT_CHANGED','Recorded workload changed. Refresh before continuing through the list.',true);
  if(query.offset>projection.total)throw invalid();
  const items=projection.items.slice(query.offset,query.offset+query.limit);
  return {schemaVersion:'sanctuary.praxis.specialist-workload.v1',requestId,snapshot,source:{sourceKey:config.sourceKey,connectionId:config.connectionId,
    environment:config.environment,authority:'canonical',asOf:result.asOf,retrievedAt:(new Date()).toISOString()},query,timezone:'Pacific/Auckland',
    counts:projection.counts,assignments:projection.assignments,coverage:projection.coverage,qualityCounts:projection.qualityCounts,
    details:{total:projection.total,returned:items.length,limit:query.limit,offset:query.offset,nextOffset:query.offset+items.length<projection.total?query.offset+items.length:null,
      truncated:projection.total>items.length,matchingCounts:projection.matchingCounts,items},
    limitations:['Installation crews and domain designers are distinct assignments, not individual labour capacity or performance.',
      'A DONE design request records completion and its current assigned designer; it does not prove who performed the work.',
      'Current work uses present status. Completion counts use current DONE records with coherent recorded finishes in the selected NZ period; today is partial as of the source snapshot.',
      'Date and assignment quality counts overlap. Inconsistent records are separate from current and period-completed counts; historical anomalies are not completions in this period.',
      'Archived and cancelled records and completions outside the period are identified in coverage. No legacy task mirrors, unscheduled eligibility guesses or duration calculations are included.']};
}

