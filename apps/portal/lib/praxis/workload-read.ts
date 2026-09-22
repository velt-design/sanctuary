import 'server-only';
import { createHash } from 'node:crypto';
import { projectOwnerOption } from '../projects/commandCentre/projectOwners';
import { parseOverviewLimit } from './overview-read';
import { PraxisConnectorError, withPraxisReadTransaction, type ConnectorConfig, type PraxisServerDependencies } from './server';

type Bucket = 'open'|'blocked'|'completed'|'inconsistent';
export type WorkloadQueryV2 = { start:string;end:string;limit:number;version:2;offset:number;snapshot:string|null;
  filter:{bucket:'all'|Bucket;identity:null|{kind:'staff'|'projectOwner'|'unassigned'|'completionRecorder';key:string|null};due:'all'|'beforeToday'} };
export type WorkloadQuery = { start: string; end: string; limit: number } | WorkloadQueryV2;
const isV2 = (query:WorkloadQuery):query is WorkloadQueryV2 => 'version' in query && query.version===2;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const invalidPeriod = () => new PraxisConnectorError(400,'INVALID_QUERY','Choose 1–90 New Zealand calendar days ending no later than today and a bounded detail limit.');
function workloadDate(value:string|null):string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value))
    || new Date(value).toISOString().slice(0,10)!==value) throw invalidPeriod();
  return value;
}
export function parseWorkloadQuery(url: URL, now = new Date()): WorkloadQuery {
  const version=url.searchParams.get('version');
  if(version!==null && version!=='2') throw invalidPeriod();
  const allowed=version==='2' ? ['start','end','limit','version','bucket','identityKind','identityKey','due','offset','snapshot'] : ['start','end','limit'];
  if ([...url.searchParams.keys()].some(key => !allowed.includes(key))
    || [...url.searchParams.keys()].some(key => url.searchParams.getAll(key).length !== 1)) {
    throw invalidPeriod();
  }
  const limit = parseOverviewLimit(new URL(`https://validation.invalid/?limit=${url.searchParams.get('limit') ?? 20}`));
  const start=workloadDate(url.searchParams.get('start')),end=workloadDate(url.searchParams.get('end'));
  const parts = new Intl.DateTimeFormat('en-NZ', { timeZone:'Pacific/Auckland',year:'numeric',month:'2-digit',day:'2-digit' }).formatToParts(now);
  const part = (type:string) => parts.find(value=>value.type===type)!.value;
  const today=`${part('year')}-${part('month')}-${part('day')}`;
  const duration=Date.parse(end)-Date.parse(start);
  if (duration<0 || duration>89*86400000 || end>today) throw invalidPeriod();
  if(version===null) return {start,end,limit};
  const bucket=url.searchParams.get('bucket') ?? 'all',due=url.searchParams.get('due') ?? 'all';
  const kind=url.searchParams.get('identityKind'),key=url.searchParams.get('identityKey');
  const offsetText=url.searchParams.get('offset') ?? '0',snapshot=url.searchParams.get('snapshot');
  if (!['all','open','blocked','completed','inconsistent'].includes(bucket) || !['all','beforeToday'].includes(due)
    || !/^(0|[1-9][0-9]*)$/.test(offsetText) || !Number.isSafeInteger(Number(offsetText))
    || (snapshot!==null && !/^[a-f0-9]{64}$/.test(snapshot)) || (Number(offsetText)>0 && snapshot===null)
    || (kind===null && key!==null) || (kind!==null && !['staff','projectOwner','unassigned','completionRecorder'].includes(kind))
    || (kind==='staff' && (key===null || !uuid.test(key)))
    || (kind==='projectOwner' && (key===null || key.trim()!==key || key.length<1 || key.length>100))
    || (kind==='unassigned' && key!==null)
    || (kind==='completionRecorder' && (bucket!=='completed' || (key!==null && !uuid.test(key))))
    || (due==='beforeToday' && bucket!=='open' && bucket!=='blocked')) throw invalidPeriod();
  return {version:2,start,end,limit,offset:Number(offsetText),snapshot,filter:{bucket:bucket as WorkloadQueryV2['filter']['bucket'],
    identity:kind===null ? null : {kind:kind as NonNullable<WorkloadQueryV2['filter']['identity']>['kind'],key:kind==='staff'||kind==='completionRecorder' ? key?.toLowerCase() ?? null : key},due:due as WorkloadQueryV2['filter']['due']}};
}
function queryUrl(query:WorkloadQuery) {
  const params=new URLSearchParams({start:query.start,end:query.end,limit:String(query.limit)});
  if(isV2(query)) {
    params.set('version','2');params.set('offset',String(query.offset));params.set('bucket',query.filter.bucket);params.set('due',query.filter.due);
    if(query.snapshot!==null)params.set('snapshot',query.snapshot);
    if(query.filter.identity) {params.set('identityKind',query.filter.identity.kind);if(query.filter.identity.key!==null)params.set('identityKey',query.filter.identity.key);}
  }
  return new URL(`https://validation.invalid/?${params}`);
}
type Identity = { kind:'staff'|'projectOwner'|'unassigned'; key:string|null; sourceName?:string|null };
type Detail = { workItemId:string;projectId:string;projectName:string;title:string;status:'OPEN'|'BLOCKED'|'DONE';
  bucket:'open'|'blocked'|'completed'|'inconsistent';projectState:'ACTIVE'|'WAITING'|'CLOSED'|'ARCHIVED';
  identity:Identity;dueAt:string;completedAt:string|null;completedBy:string|null;recordedAt:string };
type Aggregate = { incomplete:boolean;counts:Record<'open'|'blocked'|'completed'|'inconsistent',number>;
  projectionHash:string;matchingCounts:Record<Bucket,number>;dueCounts:{openOverdue:number;blockedPastDue:number};
  identities:Identity[];
  assignments:Array<{identity:Identity;open:number;blocked:number;openOverdue:number;blockedPastDue:number}>;
  recorders:Array<{userId:string|null;sourceName:string|null;count:number}>;items:Detail[];
  coverage:Record<'totalProjects'|'missingModelProjects'|'missingStateProjects'|'excludedNonManualItems'|'excludedRetiredManualItems'|'cancelledManualItems'|'completedOutsidePeriod'|'excludedTestProjects',number> };
const unavailable = () => new PraxisConnectorError(503,'PROJECTION_NOT_READY','Complete recorded workload evidence is unavailable.',true);
function label(identity:Identity) {
  const owner = identity.kind==='projectOwner' ? projectOwnerOption(identity.key) : null;
  return { kind:identity.kind,key:identity.key,displayName:identity.kind==='unassigned' ? 'Unassigned' : owner?.displayName ?? identity.sourceName ?? (identity.kind==='staff' ? 'Unknown staff name' : 'Unknown project owner'),
    nameKnown:identity.kind==='unassigned' || owner !== null || Boolean(identity.sourceName) };
}
export async function readPraxisWorkload(query:WorkloadQuery,config:ConnectorConfig,requestId:string,dependencies?:PraxisServerDependencies) {
  query=parseWorkloadQuery(queryUrl(query));
  const page=isV2(query) ? query : null;
  const filter=page?.filter ?? {bucket:'all',identity:null,due:'all'};
  const offset=page?.offset ?? 0;
  const result=await withPraxisReadTransaction(config,async transaction => {
    const times=await transaction<{as_of:Date|string}[]>`select transaction_timestamp() as as_of`;
    const rows=await transaction<Aggregate[]>`
      with source as materialized (select * from praxis_reporting.workload_v1),
      records as materialized (
        select *,payload->>'status' as status,payload->>'projectState' as state,
          (payload->>'manual')::boolean as manual,(payload->>'retired')::boolean as retired,
          ((payload->>'completedAt')::timestamptz at time zone 'Pacific/Auckland')::date between ${query.start}::date and ${query.end}::date as in_period,
          jsonb_build_object('kind',case when payload->>'assigneeUserId' is not null then 'staff' when payload->>'ownerKey' is not null then 'projectOwner' else 'unassigned' end,
            'key',coalesce(payload->>'assigneeUserId',payload->>'ownerKey'),'sourceName',case when payload->>'assigneeUserId' is not null then payload->>'assigneeName' else null end) as identity
        from source where project_id <> '10c5db1a-602c-4f0c-8193-855b186215bb'::uuid
      ), eligible as materialized (
        select *,((payload->>'dueAt')::timestamptz at time zone 'Pacific/Auckland')::date < (transaction_timestamp() at time zone 'Pacific/Auckland')::date as past_due,
          case when status='DONE' then 'completed' when state in ('CLOSED','ARCHIVED') then 'inconsistent'
          when status='OPEN' then 'open' else 'blocked' end as bucket
        from records where work_item_id is not null and manual and not retired
          and payload->>'modelVersion'='2' and payload->>'statePresent'='true'
          and (status in ('OPEN','BLOCKED') or (status='DONE' and in_period and (payload->>'completedAt')::timestamptz<=transaction_timestamp()))
      ), matching as materialized (
        select * from eligible where (${filter.bucket}::text='all' or bucket=${filter.bucket})
          and (${filter.due}::text='all' or past_due)
          and (${filter.identity?.kind ?? null}::text is null
            or (${filter.identity?.kind ?? null}::text='completionRecorder' and payload->>'completedBy' is not distinct from ${filter.identity?.key ?? null}::text)
            or (identity->>'kind'=${filter.identity?.kind ?? null}::text and identity->>'key' is not distinct from ${filter.identity?.key ?? null}::text))
      ), limited as (select * from matching order by bucket,(payload->>'dueAt')::timestamptz,work_item_id limit ${query.limit} offset ${offset})
      select (select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(source)::text,E'\n' order by project_id,work_item_id nulls first),''),'UTF8')),'hex') from source) as "projectionHash",
        (select jsonb_build_object('open',count(*) filter(where bucket='open'),'blocked',count(*) filter(where bucket='blocked'),
          'completed',count(*) filter(where bucket='completed'),'inconsistent',count(*) filter(where bucket='inconsistent')) from matching) as "matchingCounts",
        (select jsonb_build_object('openOverdue',count(*) filter(where bucket='open' and past_due),'blockedPastDue',count(*) filter(where bucket='blocked' and past_due)) from eligible) as "dueCounts",
        exists(select 1 from records where omission_count<>0
        or jsonb_typeof(payload->'projectName') is distinct from 'string' or length(payload->>'projectName') not between 1 and 1024
        or (payload->>'statePresent'='true' and (state is null or state not in ('ACTIVE','WAITING','CLOSED','ARCHIVED')))
        or (work_item_id is not null and (jsonb_typeof(payload->'title') is distinct from 'string' or length(payload->>'title') not between 1 and 160
          or jsonb_typeof(payload->'manual') is distinct from 'boolean' or jsonb_typeof(payload->'retired') is distinct from 'boolean'
          or exists(select 1 from jsonb_each(payload) field where field.key in ('assigneeName','completedByName') and field.value<>'null'::jsonb
            and (jsonb_typeof(field.value)<>'string' or length(field.value#>>'{}') not between 1 and 1024))
          or (payload->>'ownerKey' is not null and (jsonb_typeof(payload->'ownerKey')<>'string' or length(payload->>'ownerKey') not between 1 and 100))
          or status is null or status not in ('OPEN','BLOCKED','DONE','CANCELLED')
          or payload->>'dueAt' is null or not isfinite((payload->>'dueAt')::timestamptz)
          or payload->>'recordedAt' is null or not isfinite((payload->>'recordedAt')::timestamptz) or (payload->>'recordedAt')::timestamptz > transaction_timestamp()
          or (status='DONE' and (payload->>'completedAt' is null or not isfinite((payload->>'completedAt')::timestamptz) or (payload->>'completedAt')::timestamptz>transaction_timestamp()))))) as incomplete,
        (select jsonb_build_object('open',count(*) filter(where bucket='open'),'blocked',count(*) filter(where bucket='blocked'),
          'completed',count(*) filter(where bucket='completed'),'inconsistent',count(*) filter(where bucket='inconsistent')) from eligible) as counts,
        coalesce((select jsonb_agg(distinct identity) from eligible),'[]') as identities,
        coalesce((select jsonb_agg(a order by identity::text) from (select identity,count(*) filter(where bucket='open') as open,
          count(*) filter(where bucket='blocked') as blocked,count(*) filter(where bucket='open' and past_due) as "openOverdue",
          count(*) filter(where bucket='blocked' and past_due) as "blockedPastDue" from eligible where bucket in ('open','blocked') group by identity) a),'[]') as assignments,
        coalesce((select jsonb_agg(r order by "userId" nulls last) from (select payload->>'completedBy' as "userId",payload->>'completedByName' as "sourceName",count(*) as count
          from eligible where bucket='completed' group by 1,2) r),'[]') as recorders,
        (select jsonb_build_object('totalProjects',count(distinct project_id),'missingModelProjects',count(distinct project_id) filter(where payload->>'modelVersion' is distinct from '2'),
          'missingStateProjects',count(distinct project_id) filter(where payload->>'statePresent' is distinct from 'true'),
          'excludedNonManualItems',count(*) filter(where work_item_id is not null and not manual),
          'excludedRetiredManualItems',count(*) filter(where manual and retired),'cancelledManualItems',count(*) filter(where manual and not retired and status='CANCELLED'),
          'completedOutsidePeriod',count(*) filter(where manual and not retired and status='DONE' and not in_period),
          'excludedTestProjects',(select count(distinct project_id) from source where project_id='10c5db1a-602c-4f0c-8193-855b186215bb'::uuid)) from records) as coverage,
        coalesce((select jsonb_agg(jsonb_build_object('workItemId',work_item_id,'projectId',project_id,'projectName',payload->>'projectName',
          'title',payload->>'title','status',status,'bucket',bucket,'projectState',state,'identity',identity,'dueAt',payload->>'dueAt',
          'completedAt',payload->>'completedAt','completedBy',payload->>'completedBy','recordedAt',payload->>'recordedAt') order by bucket,(payload->>'dueAt')::timestamptz,work_item_id) from limited),'[]') as items
    `;
    return {asOf:new Date(times[0]!.as_of).toISOString(),rows};
  },dependencies);
  const row=result.rows[0];
  if (result.rows.length!==1 || !row || row.incomplete!==false || row.identities.length>200 || row.assignments.length>200 || row.recorders.length>200
    || [...Object.values(row.counts),...Object.values(row.matchingCounts),...Object.values(row.dueCounts),...Object.values(row.coverage),...row.assignments.flatMap(a=>[a.open,a.blocked,a.openOverdue,a.blockedPastDue]),...row.recorders.map(r=>r.count)]
      .some(n=>!Number.isSafeInteger(n)||n<0)) throw unavailable();
  const assignments=row.assignments.map(a=>({identity:label(a.identity),open:a.open,blocked:a.blocked,...(page ? {openOverdue:a.openOverdue,blockedPastDue:a.blockedPastDue} : {})}));
  const completionRecorders=row.recorders.map(r=>({userId:r.userId,count:r.count,displayName:r.sourceName ?? (r.userId ? 'Unknown staff name' : 'Unknown completion recorder'),nameKnown:Boolean(r.sourceName)}));
  const unknowns=new Set<string>();
  for(const identity of row.identities.map(label)) if(!identity.nameKnown) unknowns.add(`${identity.kind}:${identity.key}`);
  for(const r of completionRecorders) if(!r.nameKnown) unknowns.add(`staff:${r.userId ?? 'unknown-recorder'}`);
  const total=Object.values(row.matchingCounts).reduce((sum,n)=>sum+n,0);
  const dayParts=new Intl.DateTimeFormat('en-NZ',{timeZone:'Pacific/Auckland',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(result.asOf));
  const snapshot=createHash('sha256').update(JSON.stringify({version:2,projection:row.projectionHash,sourceKey:config.sourceKey,connectionId:config.connectionId,
    environment:config.environment,start:query.start,end:query.end,filter,day:dayParts.filter(p=>p.type!=='literal').map(p=>p.value),
    labels:row.identities.map(identity=>JSON.stringify(label(identity))).sort()})).digest('hex');
  if(page?.snapshot!==null && page?.snapshot!==undefined && page.snapshot!==snapshot)
    throw new PraxisConnectorError(409,'WORKLOAD_SNAPSHOT_CHANGED','Recorded workload changed. Refresh before continuing through the list.',true);
  if(offset>total) throw invalidPeriod();
  if(row.items.length!==Math.min(Math.max(total-offset,0),query.limit)) throw unavailable();
  const nextOffset=offset+row.items.length<total ? offset+row.items.length : null;
  return {schemaVersion:page ? 'sanctuary.praxis.workload.v2' as const : 'sanctuary.praxis.workload.v1' as const,requestId,
    ...(page ? {snapshot,dueCounts:row.dueCounts} : {}),
    source:{sourceKey:config.sourceKey,connectionId:config.connectionId,environment:config.environment,authority:'canonical' as const,asOf:result.asOf,retrievedAt:new Date().toISOString()},
    query,timezone:'Pacific/Auckland' as const,coverage:'recorded_manual_work' as const,counts:row.counts,assignments,completionRecorders,
    coverageCounts:{...row.coverage,unmappedIdentityCount:unknowns.size},
    details:{total,returned:row.items.length,limit:query.limit,truncated:offset>0||nextOffset!==null,...(page ? {offset,nextOffset,matchingCounts:row.matchingCounts} : {}),items:row.items.map(i=>({...i,identity:label(i.identity),dueAt:new Date(i.dueAt).toISOString(),completedAt:i.completedAt ? new Date(i.completedAt).toISOString():null,recordedAt:new Date(i.recordedAt).toISOString()}))},
    limitations:[...(page ? ['Overdue means open work due before today in New Zealand; blocked past-due work is separate. Counts overlap workload statuses.',
      'Pages require unchanged recorded evidence; refresh if the snapshot changes. Completion recorder is not the performer.'] : []),'Recorded explicit manual work only; this is not all staff work, capacity or performance.',
      'A period including today is partial and includes completions only up to the source snapshot time, in New Zealand time.',
      'Assignments are current. Completion recorder is not proof of who performed the work; reopened items are not currently completed.',
      'Staff UUIDs, project-owner keys and unassigned work remain separate. Unknown names require an authoritative mapping.',
      'Deferred cadences, retired manual items and cancelled tasks are excluded. Missing model/state coverage is reported, not inferred.',
      'Crew installation work and specialist workflows are not included.'],
  };
}
