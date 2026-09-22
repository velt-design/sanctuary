// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { writeFileSync } from 'node:fs';
import { afterAll,beforeAll,beforeEach,describe,expect,it,vi } from 'vitest';
vi.mock('server-only',()=>({}));
const mocks=vi.hoisted(()=>({query:vi.fn()}));
vi.mock('../apps/portal/lib/praxis/server',async original=>({...await original<typeof import('../apps/portal/lib/praxis/server')>(),withPraxisReadTransaction:(_config:unknown,callback:(query:unknown)=>unknown)=>callback(mocks.query)}));
import { parseWorkloadQuery,readPraxisWorkload } from '../apps/portal/lib/praxis/workload-read';
import type { ConnectorConfig } from '../apps/portal/lib/praxis/server';
const config={sourceKey:'sanctuary',connectionId:'10000000-0000-4000-8000-000000000001',environment:'test'} as ConnectorConfig;
const query={start:'2020-09-16',end:'2020-09-16',limit:2};
let db:PGlite;
let snapshotTime:string|null=null;
beforeAll(async()=>{db=new PGlite();await db.exec('create schema praxis_reporting;create table praxis_reporting.workload_v1(project_id uuid,work_item_id uuid,payload jsonb,omission_count integer default 0)');
  mocks.query.mockImplementation(async(strings:TemplateStringsArray,...values:unknown[])=>{
    let sql=strings.reduce((text,part,index)=>text+(index?`$${index}`:'')+part,'');
    if(snapshotTime)sql=sql.replaceAll('transaction_timestamp()',`'${snapshotTime}'::timestamptz`);
    return (await db.query(sql,values)).rows;
  });});
beforeEach(async()=>{snapshotTime=null;await db.exec('truncate praxis_reporting.workload_v1');});
afterAll(async()=>{await db.close();});
async function seed(size=1,patch:Record<string,unknown>={}) {
  const payload={projectName:'Synthetic Project',modelVersion:2,projectState:'ACTIVE',statePresent:true,title:'Prepare design',status:'OPEN',dueAt:'2020-09-16T00:00:00Z',manual:true,retired:false,assigneeUserId:null,ownerKey:'jordan',assigneeName:null,completedAt:null,completedBy:null,completedByName:null,recordedAt:'2020-09-16T01:00:00Z',...patch};
  await db.query(`insert into praxis_reporting.workload_v1 select ('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('30000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,$1::jsonb,0 from generate_series(1,$2) i`,[JSON.stringify(payload),size]);
}
describe('recorded manual workload',()=>{
  it('returns complete counts independent of details and authoritative owner labels',async()=>{
    await seed(125);const result=await readPraxisWorkload(query,config,'test');
    expect(result.counts).toEqual({open:125,blocked:0,completed:0,inconsistent:0});
    expect(result.details).toMatchObject({total:125,returned:2,truncated:true});
    expect(result.assignments[0]).toEqual({identity:{kind:'projectOwner',key:'jordan',displayName:'Jordan',nameKnown:true},open:125,blocked:0});
  });
  it('separates current staff assignment from completion recorder and preserves NZ period',async()=>{
    await seed(1,{status:'DONE',assigneeUserId:'40000000-0000-4000-8000-000000000001',assigneeName:'Synthetic Assignee',completedBy:'50000000-0000-4000-8000-000000000001',completedByName:'Synthetic Recorder',completedAt:'2020-09-15T13:00:00Z',projectState:'ARCHIVED'});
    const result=await readPraxisWorkload(query,config,'test');expect(result.counts.completed).toBe(1);expect(result.assignments).toEqual([]);
    expect(result.completionRecorders[0]).toMatchObject({displayName:'Synthetic Recorder',nameKnown:true,count:1});
    expect(result.details.items[0].identity).toMatchObject({kind:'staff',displayName:'Synthetic Assignee'});
  });
  it.each([
    [{status:'BLOCKED',ownerKey:null},'blocked',1], [{projectState:'WAITING'},'open',1],
    [{projectState:'CLOSED'},'inconsistent',1], [{projectState:'ARCHIVED'},'inconsistent',1],
    [{status:'CANCELLED'},'open',0], [{manual:false},'open',0], [{retired:true},'open',0],
    [{modelVersion:null},'open',0], [{statePresent:false,projectState:null},'open',0],
  ] as const)('reports states without inferred work %#',async(patch,bucket,expected)=>{
    await seed(1,patch);expect((await readPraxisWorkload(query,config,'test')).counts[bucket]).toBe(expected);
  });
  it('withholds omitted or invalid rows beyond detail limit',async()=>{
    await seed(21);await db.exec(`update praxis_reporting.workload_v1 set omission_count=1 where right(work_item_id::text,12)='000000000021'`);
    await expect(readPraxisWorkload(query,config,'test')).rejects.toThrow('Complete recorded workload');
    await db.exec(`update praxis_reporting.workload_v1 set omission_count=0,payload=payload||'{"dueAt":null}' where right(work_item_id::text,12)='000000000021'`);
    await expect(readPraxisWorkload(query,config,'test')).rejects.toThrow('Complete recorded workload');
  });
  it('counts current DONE only and reports completions outside period',async()=>{
    await seed(1,{status:'DONE',completedAt:'2020-09-14T00:00:00Z'});let result=await readPraxisWorkload(query,config,'test');
    expect(result.counts.completed).toBe(0);expect(result.coverageCounts.completedOutsidePeriod).toBe(1);
    await db.exec(`update praxis_reporting.workload_v1 set payload=payload||'{"status":"OPEN","completedAt":null}'`);
    result=await readPraxisWorkload(query,config,'test');expect(result.counts.open).toBe(1);expect(result.counts.completed).toBe(0);
  });
  it('rejects duplicate/unbounded/unsupported parameters',()=>{
    for(const suffix of ['&limit=0','&limit=51','&start=2020-09-16','&comparisonStart=2020-09-15'])expect(()=>parseWorkloadQuery(new URL(`https://example.test/?start=2020-09-16&end=2020-09-16${suffix}`))).toThrow();
  });
  it('reports missing model/state and exclusions explicitly',async()=>{
    await seed(1,{modelVersion:null,statePresent:false,projectState:null});
    let result=await readPraxisWorkload(query,config,'test');
    expect(result.coverageCounts).toMatchObject({totalProjects:1,missingModelProjects:1,missingStateProjects:1});
    expect(result.details.total).toBe(0);
    await db.exec(`update praxis_reporting.workload_v1 set payload=payload||'{"modelVersion":2,"statePresent":true,"projectState":"ACTIVE","retired":true}'`);
    result=await readPraxisWorkload(query,config,'test');expect(result.coverageCounts.excludedRetiredManualItems).toBe(1);
  });
  it('keeps unknown staff and unassigned distinct, including identities beyond detail limit',async()=>{
    await seed(3,{ownerKey:null});
    await db.exec(`update praxis_reporting.workload_v1 set payload=payload||'{"projectState":"CLOSED","assigneeUserId":"40000000-0000-4000-8000-000000000001"}' where right(work_item_id::text,12)='000000000003'`);
    const result=await readPraxisWorkload({...query,limit:1},config,'test');
    expect(result.coverageCounts.unmappedIdentityCount).toBe(1);
    expect(result.assignments[0].identity).toEqual({kind:'unassigned',key:null,displayName:'Unassigned',nameKnown:true});
  });
  it('uses Auckland daylight-saving date and identifies unknown completion recorder',async()=>{
    await seed(1,{status:'DONE',completedAt:'2020-09-27T11:30:00Z'});
    const result=await readPraxisWorkload({start:'2020-09-28',end:'2020-09-28',limit:20},config,'test');
    expect(result.counts.completed).toBe(1);
    expect(result.completionRecorders[0]).toEqual({userId:null,count:1,displayName:'Unknown completion recorder',nameKnown:false});
  });
  it.each([
    ['2026-09-21T12:00:01Z','2026-09-21','2026-09-22'], // NZ standard time midnight
    ['2026-09-27T11:00:01Z','2026-09-27','2026-09-28'], // after spring DST change
    ['2026-04-05T12:00:01Z','2026-04-05','2026-04-06'], // after autumn DST change
  ])('accepts today at Auckland midnight %s, including DST, and rejects tomorrow',(instant,yesterday,today)=>{
    const url=(day:string)=>new URL(`https://example.test/?start=${day}&end=${day}`);
    expect(parseWorkloadQuery(url(yesterday),new Date(instant))).toMatchObject({start:yesterday,end:yesterday});
    expect(parseWorkloadQuery(url(today),new Date(instant))).toMatchObject({start:today,end:today});
    const tomorrow=new Date(Date.parse(today)+86400000).toISOString().slice(0,10);
    expect(()=>parseWorkloadQuery(url(tomorrow),new Date(instant))).toThrow();
    expect(()=>parseWorkloadQuery(url(today),new Date(Date.parse(instant)-2000))).toThrow();
    expect(parseWorkloadQuery(url(yesterday),new Date(Date.parse(instant)-2000))).toMatchObject({start:yesterday,end:yesterday});
  });
  it('allows up to90 days including today and rejects invalid dates or ranges',()=>{
    const now=new Date('2026-09-21T12:00:01Z');
    const end='2026-09-22',start=new Date(Date.parse(end)-89*86400000).toISOString().slice(0,10);
    expect(parseWorkloadQuery(new URL(`https://example.test/?start=${start}&end=${end}`),now)).toMatchObject({start,end});
    for(const params of ['start=2026-02-30&end=2026-03-01','start=2026-09-23&end=2026-09-22',
      `start=${new Date(Date.parse(end)-90*86400000).toISOString().slice(0,10)}&end=${end}`]) {
      expect(()=>parseWorkloadQuery(new URL(`https://example.test/?${params}`),now)).toThrow();
    }
  });
  it('returns a completion from today up to the actual SQL snapshot and fails closed on future corruption',async()=>{
    const [clock]= (await db.query<{today:string;completed:string}>(`select (clock_timestamp() at time zone 'Pacific/Auckland')::date::text as today,
      (clock_timestamp()-interval '1 millisecond')::text as completed`)).rows;
    await seed(1,{status:'DONE',completedAt:clock!.completed});
    const todayQuery={start:clock!.today,end:clock!.today,limit:20};
    const result=await readPraxisWorkload(todayQuery,config,'test');
    expect(result.counts.completed).toBe(1);
    expect(Date.parse(result.details.items[0]!.completedAt!)).toBeLessThanOrEqual(Date.parse(result.source.asOf));
    expect(result.limitations.join(' ')).toContain('including today is partial');
    await db.exec(`update praxis_reporting.workload_v1 set payload=jsonb_set(payload,'{completedAt}',to_jsonb(clock_timestamp()+interval '1 day'))`);
    await expect(readPraxisWorkload(todayQuery,config,'test')).rejects.toThrow('Complete recorded workload');
  });
});

describe('workload v2 filtered pages',()=>{
  const v2=(suffix='')=>parseWorkloadQuery(new URL(`https://example.test/?version=2&start=2020-09-16&end=2020-09-16${suffix}`));
  it('retains v1 wire and normalizes absent v2 options strictly',async()=>{
    await seed();const legacy=await readPraxisWorkload(query,config,'test');
    expect(legacy).not.toHaveProperty('snapshot');expect(legacy).not.toHaveProperty('dueCounts');
    expect(legacy.details).not.toHaveProperty('offset');expect(legacy.assignments[0]).not.toHaveProperty('openOverdue');
    expect(v2()).toEqual({version:2,start:query.start,end:query.end,limit:20,offset:0,snapshot:null,filter:{bucket:'all',identity:null,due:'all'}});
    for(const suffix of ['&version=2','&bucket=','&due=','&identityKind=','&identityKey=x','&identityKind=unassigned&identityKey=',
      '&identityKind=staff','&identityKind=staff&identityKey=nope','&identityKind=projectOwner&identityKey=',
      '&identityKind=completionRecorder','&bucket=completed&due=beforeToday','&due=beforeToday','&offset=1','&offset=-1','&offset=01','&offset=9007199254740992','&snapshot='])
      expect(()=>v2(suffix),suffix).toThrow();
  });
  it('paginates 125 tied due dates once each, with complete totals and stable fingerprint independent of limit',async()=>{
    await seed(125);const first=await readPraxisWorkload(v2('&limit=17'),config,'test');
    expect(first.schemaVersion).toBe('sanctuary.praxis.workload.v2');expect(first.query).toHaveProperty('snapshot',null);
    expect(first.dueCounts).toEqual({openOverdue:125,blockedPastDue:0});
    expect(first.assignments[0]).toMatchObject({openOverdue:125,blockedPastDue:0});
    const ids=first.details.items.map(i=>i.workItemId);let next=first.details.nextOffset;
    while(next!==null && next!==undefined) {
      const page=await readPraxisWorkload(v2(`&limit=23&offset=${next}&snapshot=${first.snapshot}`),config,'test');
      expect(page.snapshot).toBe(first.snapshot);expect(page.counts.open).toBe(125);expect(page.details.total).toBe(125);
      expect(page.details.truncated).toBe(true);ids.push(...page.details.items.map(i=>i.workItemId));next=page.details.nextOffset;
    }
    expect(ids).toHaveLength(125);expect(new Set(ids).size).toBe(125);expect(ids).toEqual([...ids].sort());
    const previous=await readPraxisWorkload(v2(`&limit=17&offset=0&snapshot=${first.snapshot}`),config,'test');
    expect(previous.details.items).toEqual(first.details.items);expect(previous.snapshot).toBe(first.snapshot);
    await expect(readPraxisWorkload(v2(`&offset=126&snapshot=${first.snapshot}`),config,'test')).rejects.toMatchObject({status:400});
  });
  it.each(['title','assignment','completion','delete','insert','excluded'])('requires restart after %s changes beyond first page',async(change)=>{
    await seed(60);const first=await readPraxisWorkload(v2(),config,'test');
    const last="where right(work_item_id::text,12)='000000000060'";
    if(change==='delete')await db.exec(`delete from praxis_reporting.workload_v1 ${last}`);
    else if(change==='insert')await db.exec(`insert into praxis_reporting.workload_v1 select '20000000-0000-4000-8000-000000000999','30000000-0000-4000-8000-000000000999',payload,0 from praxis_reporting.workload_v1 limit 1`);
    else {const patch=change==='title'?{title:'Changed task'}:change==='assignment'?{ownerKey:'ellen'}:change==='completion'?{status:'DONE',completedAt:'2020-09-16T02:00:00Z'}:{manual:false};
      await db.query(`update praxis_reporting.workload_v1 set payload=payload||$1::jsonb ${last}`,[JSON.stringify(patch)]);}
    await expect(readPraxisWorkload(v2(`&offset=20&snapshot=${first.snapshot}`),config,'test')).rejects.toMatchObject({status:409,code:'WORKLOAD_SNAPSHOT_CHANGED'});
    await expect(readPraxisWorkload(v2(`&offset=0&snapshot=${first.snapshot}`),config,'test')).rejects.toMatchObject({status:409,code:'WORKLOAD_SNAPSHOT_CHANGED'});
  });
  it('filters exact identities beyond the first 20, keeping global totals separate',async()=>{
    await seed(60);await db.exec(`update praxis_reporting.workload_v1 set payload=payload||'{"ownerKey":"ellen","status":"BLOCKED"}' where right(work_item_id::text,12)='000000000060'`);
    const result=await readPraxisWorkload(v2('&bucket=blocked&identityKind=projectOwner&identityKey=ellen&due=beforeToday'),config,'test');
    expect(result.counts).toEqual({open:59,blocked:1,completed:0,inconsistent:0});
    expect(result.details).toMatchObject({total:1,returned:1,nextOffset:null,truncated:false,matchingCounts:{open:0,blocked:1,completed:0,inconsistent:0}});
    expect(result.details.items[0].workItemId.endsWith('060')).toBe(true);expect(result.dueCounts).toEqual({openOverdue:59,blockedPastDue:1});
    await expect(readPraxisWorkload(v2(`&bucket=open&snapshot=${result.snapshot}`),config,'test')).rejects.toMatchObject({code:'WORKLOAD_SNAPSHOT_CHANGED'});
    await expect(readPraxisWorkload(v2(`&snapshot=${result.snapshot}`),{...config,connectionId:'10000000-0000-4000-8000-000000000099'},'test')).rejects.toMatchObject({code:'WORKLOAD_SNAPSHOT_CHANGED'});
  });
  it('distinguishes recorder from assignee and supports unknown recorder and unassigned',async()=>{
    const staff='40000000-0000-4000-8000-000000000001',recorder='50000000-0000-4000-8000-000000000001';
    await seed(1,{status:'DONE',assigneeUserId:staff,completedBy:recorder,completedAt:'2020-09-16T02:00:00Z'});
    expect((await readPraxisWorkload(v2(`&bucket=completed&identityKind=completionRecorder&identityKey=${staff}`),config,'test')).details.total).toBe(0);
    expect((await readPraxisWorkload(v2(`&bucket=completed&identityKind=completionRecorder&identityKey=${recorder}`),config,'test')).details.total).toBe(1);
    expect((await readPraxisWorkload(v2(`&bucket=completed&identityKind=staff&identityKey=${staff}`),config,'test')).details.total).toBe(1);
    await db.exec(`update praxis_reporting.workload_v1 set payload=payload||'{"completedBy":null,"assigneeUserId":null,"ownerKey":null}'`);
    expect((await readPraxisWorkload(v2('&bucket=completed&identityKind=completionRecorder'),config,'test')).details.total).toBe(1);
    expect((await readPraxisWorkload(v2('&identityKind=unassigned'),config,'test')).details.total).toBe(1);
  });
  it('does not hide corrupt evidence behind a filter or later page',async()=>{
    await seed(60);await db.exec(`update praxis_reporting.workload_v1 set omission_count=1 where right(work_item_id::text,12)='000000000060'`);
    await expect(readPraxisWorkload(v2('&identityKind=projectOwner&identityKey=ellen'),config,'test')).rejects.toMatchObject({code:'PROJECTION_NOT_READY'});
  });
  it.each([
    ['2020-09-26T11:59:59Z','2020-09-26T12:00:01Z','2020-09-26T00:00:00Z'],
    ['2020-09-27T10:59:59Z','2020-09-27T11:00:01Z','2020-09-27T00:00:00Z'],
    ['2020-04-05T11:59:59Z','2020-04-05T12:00:01Z','2020-04-05T00:00:00Z'],
  ])('uses NZ calendar overdue at midnight/DST %s and invalidates prior pages',async(before,after,due)=>{
    await seed(2,{dueAt:due,recordedAt:'2020-01-01T00:00:00Z'});snapshotTime=before;
    const q=()=>parseWorkloadQuery(new URL('https://example.test/?version=2&start=2020-01-01&end=2020-01-01&limit=1'));
    const first=await readPraxisWorkload(q(),config,'test');expect(first.dueCounts?.openOverdue).toBe(0);
    snapshotTime=after;
    await expect(readPraxisWorkload({...q(),version:2,offset:1,snapshot:first.snapshot!,filter:{bucket:'all',identity:null,due:'all'}},config,'test'))
      .rejects.toMatchObject({code:'WORKLOAD_SNAPSHOT_CHANGED'});
    const refreshed=await readPraxisWorkload(q(),config,'test');expect(refreshed.dueCounts?.openOverdue).toBe(2);
    expect(refreshed.snapshot).not.toBe(first.snapshot);
  });
  it('exports synthetic actual-SQL v2 wire when requested',async()=>{
    await seed(25);const result=await readPraxisWorkload(v2(),config,'70000000-0000-4000-8000-000000000001');
    expect(result.details.returned).toBe(20);expect(result.query).toHaveProperty('snapshot',null);
    if(process.env.PRAXIS_WORKLOAD_V2_FIXTURE_PATH)writeFileSync(process.env.PRAXIS_WORKLOAD_V2_FIXTURE_PATH,JSON.stringify(result,null,2));
  });
});
