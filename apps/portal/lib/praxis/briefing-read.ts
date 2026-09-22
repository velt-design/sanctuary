import 'server-only';
import {createHash} from 'node:crypto';
import {BRIEFING_LIMIT,BRIEFING_MAX_BYTES,BRIEFING_SCHEMA,briefingRecordSchemas,briefingSchema,type BriefingDomain,type BriefingSnapshot} from './briefing-contract';
import {PraxisConnectorError,withPraxisReadTransaction,type ConnectorConfig,type PraxisServerDependencies} from './server';
import {DESIGN_PACKAGE_DESIGNERS} from '../designPackages/designers';
import {projectOwnerOption} from '../projects/commandCentre/projectOwners';
const TEST_PROJECT='10c5db1a-602c-4f0c-8193-855b186215bb',TEST_ENQUIRY='f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70';
type Row={id:string;project_id:string|null;parent_id?:string|null;recorded_at?:string|Date;payload:Record<string,unknown>;omission_count:number};
function canonical(value:unknown):unknown {return Array.isArray(value)?value.map(canonical):value!==null&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,item])=>[key,canonical(item)])):value;}
export function briefingFingerprint(records:readonly {id:string;projectId:string|null;facts:unknown}[]) {
  return createHash('sha256').update(JSON.stringify(canonical([...records].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0).map(({id,projectId,facts})=>({id,projectId,facts}))))).digest('hex');
}
export function parseBriefingQuery(url:URL) {if([...url.searchParams].length)throw new PraxisConnectorError(400,'INVALID_QUERY','The current briefing snapshot accepts no query parameters.');}
const unavailable=(reason:'projection_missing'|'invalid_projection'|'record_limit')=>({status:'unavailable' as const,reason,limit:BRIEFING_LIMIT});
const select=(p:Record<string,unknown>,keys:string[])=>Object.fromEntries(keys.map(key=>[key,p[key]]));
function projectBriefingDomain(domain:BriefingDomain,rows:Row[]|null,asOf:string,context:{projects:Row[]|null;contacts:Row[]|null;quotes:Row[]|null;manualReady:boolean}) {
  if(rows===null)return unavailable('projection_missing');
  if(rows.length>BRIEFING_LIMIT)return unavailable('record_limit');
  try {
    if(domain==='projects'&&(context.contacts===null||context.contacts.length>BRIEFING_LIMIT))throw new Error();
    if(domain==='quoteVersions'&&(context.quotes===null||context.quotes.length>BRIEFING_LIMIT))throw new Error();
    if(domain==='manualWork'&&!context.manualReady)throw new Error();
    const seen=new Set<string>();
    const records=rows.map(row=>{
      if(row.omission_count!==0||seen.has(row.id))throw new Error();seen.add(row.id);
      const p=row.payload;
      let facts:unknown;
      if(domain==='enquiries')facts=select(p,['contactId','enquiryType','createdAt']);
      else if(domain==='projects') {
        const contact=context.contacts!.find(c=>c.id===p.contactId);
        if(!contact||contact.omission_count!==0)throw new Error();
        facts={name:p.name,contactId:p.contactId,contactName:contact.payload.name,contactEmail:contact.payload.email,stage:p.pipelineStage,archivedAt:p.archivedAt,createdAt:p.createdAt};
      } else if(domain==='quoteVersions') {
        const quote=context.quotes!.find(q=>q.id===row.parent_id);
        if(!quote||quote.project_id!==row.project_id||quote.omission_count!==0)throw new Error();
        facts={...select(p,['versionNumber','status','sentAt','acceptedAt','supersededAt','expiresAt','totalIncGstCents']),quoteId:row.parent_id,quoteRef:quote.payload.quoteRef};
      } else if(domain==='manualWork') {
        const kind=p.assigneeUserId!==null?'staff':p.ownerKey!==null?'projectOwner':'unassigned';
        const owner=kind==='projectOwner'?projectOwnerOption(String(p.ownerKey)):null;
        facts={...select(p,['title','status','projectState','dueAt','completedAt','completedBy']),identityKind:kind,identityKey:p.assigneeUserId??p.ownerKey??null,
          identityName:kind==='unassigned'?'Unassigned':kind==='staff'?p.assigneeName??'Unknown staff name':owner?.displayName??'Unknown project owner'};
      } else {
        const name=domain==='installation'?p.identityName:DESIGN_PACKAGE_DESIGNERS.find(d=>d.id===p.identityKey)?.name;
        facts={...select(p,domain==='installation'?['status','identityActive','projectPresent','archived','plannedStart','forecastStart','forecastEndExclusive','actualStart','actualFinish']:['status','projectPresent','archived','requestedAt','dueAt','startedAt','completedAt','cancelledAt']),
          identityKind:domain==='installation'?'crew':'designer',identityKey:p.identityKey,identityName:p.identityKey===null?'Unassigned':name??(domain==='installation'?'Unknown crew':'Unknown designer')};
      }
      const item=briefingRecordSchemas[domain].parse({id:row.id,projectId:domain==='projects'?row.id:row.project_id,recordedAt:new Date(String(row.recorded_at??p.recordedAt)).toISOString(),facts});
      if(Date.parse(item.recordedAt)>Date.parse(asOf))throw new Error();
      if('createdAt' in item.facts&&Date.parse(item.facts.createdAt)>Date.parse(asOf))throw new Error();
      if(domain==='manualWork'&&'identityKind' in item.facts){
        if((item.facts.identityKind==='unassigned')!==(item.facts.identityKey===null))throw new Error();
        if(item.facts.identityKind==='staff'&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.facts.identityKey??''))throw new Error();
      }
      return item;
    }).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    return {status:'available' as const,complete:true as const,count:records.length,limit:BRIEFING_LIMIT,fingerprint:briefingFingerprint(records),records};
  }catch{return unavailable('invalid_projection');}
}
export async function readPraxisBriefing(config:ConnectorConfig,requestId:string,dependencies?:PraxisServerDependencies):Promise<BriefingSnapshot> {
  const read=await withPraxisReadTransaction(config,async sql=>{
    const [time]=await sql<{as_of:Date|string}[]>`select transaction_timestamp() as as_of`;
    const [views]=await sql<Record<string,boolean>[]>`select to_regclass('praxis_reporting.enquiry_requests_v1') is not null as enquiries,to_regclass('praxis_reporting.projects_v1') is not null as projects,to_regclass('praxis_reporting.contacts_v1') is not null as contacts,to_regclass('praxis_reporting.quotes_v1') is not null as quotes,to_regclass('praxis_reporting.quote_versions_v1') is not null as versions,to_regclass('praxis_reporting.workload_v1') is not null as manual,to_regclass('praxis_reporting.specialist_workload_v1') is not null as specialist`;
    const projects=views!.projects?await sql<Row[]>`select id,project_id,parent_id,recorded_at,jsonb_build_object('name',payload->'name','contactId',payload->'contactId','pipelineStage',payload->'pipelineStage','archivedAt',payload->'archivedAt','createdAt',payload->'createdAt') as payload,omission_count from praxis_reporting.projects_v1 where id<>${TEST_PROJECT}::uuid order by id limit ${BRIEFING_LIMIT+1}`:null;
    const contacts=views!.contacts&&views!.projects?await sql<Row[]>`select id,project_id,parent_id,recorded_at,jsonb_build_object('name',payload->'name','email',payload->'email') as payload,omission_count from praxis_reporting.contacts_v1 where id in(select parent_id from praxis_reporting.projects_v1 where id<>${TEST_PROJECT}::uuid) order by id limit ${BRIEFING_LIMIT+1}`:null;
    const quotes=views!.quotes?await sql<Row[]>`select id,project_id,parent_id,recorded_at,jsonb_build_object('quoteRef',payload->'quoteRef') as payload,omission_count from praxis_reporting.quotes_v1 where project_id is distinct from ${TEST_PROJECT}::uuid order by id limit ${BRIEFING_LIMIT+1}`:null;
    const enquiries=views!.enquiries?await sql<Row[]>`select id,project_id,parent_id,recorded_at,jsonb_build_object('contactId',payload->'contactId','enquiryType',payload->'enquiryType','createdAt',payload->'createdAt') as payload,omission_count from praxis_reporting.enquiry_requests_v1 where id<>${TEST_ENQUIRY}::uuid and project_id is distinct from ${TEST_PROJECT}::uuid order by id limit ${BRIEFING_LIMIT+1}`:null;
    const quoteVersions=views!.versions?await sql<Row[]>`select id,project_id,parent_id,recorded_at,jsonb_build_object('versionNumber',payload->'versionNumber','status',payload->'status','sentAt',payload->'sentAt','acceptedAt',payload->'acceptedAt','supersededAt',payload->'supersededAt','expiresAt',payload->'expiresAt','totalIncGstCents',payload->'totalIncGstCents') as payload,omission_count from praxis_reporting.quote_versions_v1 where project_id is distinct from ${TEST_PROJECT}::uuid order by id limit ${BRIEFING_LIMIT+1}`:null;
    const manualWork=views!.manual?await sql<Row[]>`select work_item_id as id,project_id,payload,omission_count from praxis_reporting.workload_v1 where project_id<>${TEST_PROJECT}::uuid and work_item_id is not null and payload->>'manual'='true' and payload->>'retired'='false' order by work_item_id limit ${BRIEFING_LIMIT+1}`:null;
    const [coverage]=views!.manual?await sql<{ready:boolean;projects:string}[]>`select coalesce(bool_and(coalesce(omission_count=0 and payload->>'modelVersion'='2' and payload->>'statePresent'='true' and (work_item_id is null or (payload->>'manual' in ('true','false') and payload->>'retired' in ('true','false'))),false)),true) as ready,count(distinct project_id)::text as projects from praxis_reporting.workload_v1 where project_id<>${TEST_PROJECT}::uuid`:[{ready:false,projects:'0'}];
    const installation=views!.specialist?await sql<Row[]>`select record_id as id,project_id,payload,omission_count from praxis_reporting.specialist_workload_v1 where domain='installation' and project_id<>${TEST_PROJECT}::uuid order by record_id limit ${BRIEFING_LIMIT+1}`:null;
    const design=views!.specialist?await sql<Row[]>`select record_id as id,project_id,payload,omission_count from praxis_reporting.specialist_workload_v1 where domain='design' and project_id<>${TEST_PROJECT}::uuid order by record_id limit ${BRIEFING_LIMIT+1}`:null;
    return {asOf:new Date(time!.as_of).toISOString(),projects,contacts,quotes,enquiries,quoteVersions,manualWork,installation,design,manualReady:coverage!.ready===true&&projects!==null&&projects.length<=BRIEFING_LIMIT&&Number(coverage!.projects)===projects.length};
  },dependencies);
  const domains=Object.fromEntries((Object.keys(briefingRecordSchemas) as BriefingDomain[]).map(domain=>[domain,projectBriefingDomain(domain,read[domain],read.asOf,read)]));
  const result=briefingSchema.parse({schemaVersion:BRIEFING_SCHEMA,requestId,source:{sourceKey:config.sourceKey,connectionId:config.connectionId,environment:config.environment,authority:'canonical',asOf:read.asOf,retrievedAt:new Date().toISOString()},
    semantics:'net_state_between_observations',exclusion:'labelled_measurement_test_20260916',domains,cash:{status:'unavailable',reason:'business_cash_not_projected'},
    limitations:['Complete bounded current records per available domain; unavailable domains are not empty populations.','Differences between observations are net state changes, not complete activity history. Intermediate completion, reopening or reassignment can be missed.','Pipeline stages are workflow labels, not payment or acceptance evidence. Enquiry receipts exclude other unrecorded enquiry channels.','Manual work excludes non-manual and deliberately retired items. Missing V2 project models or states makes that domain unavailable.','Crew/designer assignments and completion recorders do not establish actual performers, capacity or performance. Reversed/future operational dates remain source-quality anomalies.','Cash and business-wide accounting are unavailable; no revenue, margin or deposit inference.']});
  if(Buffer.byteLength(JSON.stringify(result),'utf8')>BRIEFING_MAX_BYTES)throw new PraxisConnectorError(503,'PROJECTION_NOT_READY','Complete briefing exceeds the payload limit.',true);
  return result;
}
