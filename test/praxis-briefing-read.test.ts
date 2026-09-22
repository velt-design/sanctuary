// @vitest-environment node
import {PGlite} from '@electric-sql/pglite';
import postgres from 'postgres';
import {writeFileSync} from 'node:fs';
import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const mocks=vi.hoisted(()=>({query:vi.fn()}));
vi.mock('../apps/portal/lib/praxis/server',async original=>({...await original<typeof import('../apps/portal/lib/praxis/server')>(),withPraxisReadTransaction:(_c:unknown,callback:(q:unknown)=>unknown)=>callback(mocks.query)}));
import {briefingFingerprint,parseBriefingQuery,readPraxisBriefing} from '../apps/portal/lib/praxis/briefing-read';
import type {ConnectorConfig} from '../apps/portal/lib/praxis/server';
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const config={sourceKey:'synthetic',connectionId:id(999),environment:'test'} as ConnectorConfig;
const at='2026-09-22T00:00:00.000Z';
let db:{exec:(sql:string)=>Promise<unknown>;query:(sql:string,args:unknown[])=>Promise<{rows:unknown[]}>;close:()=>Promise<void>};
const native=process.env.PRAXIS_BRIEFING_NATIVE_URL;
beforeAll(async()=>{
  vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date(at));
  if(native){const url=new URL(native);if(url.hostname!=='127.0.0.1'||url.username!=='postgres'||url.pathname!=='/briefing_fixture')throw new Error('Only disposable local briefing fixture allowed.');const client=postgres(native,{max:1});db={exec:sql=>client.unsafe(sql),query:async(sql,args)=>({rows:await client.unsafe(sql,args as never[])}),close:()=>client.end()};}
  else db=new PGlite();
  await db.exec(`create schema praxis_reporting;
    create table praxis_reporting.projects_v1(id uuid,project_id uuid,parent_id uuid,recorded_at timestamptz default '2026-09-01',payload jsonb,omission_count int default 0);
    create table praxis_reporting.contacts_v1(like praxis_reporting.projects_v1 including all);
    create table praxis_reporting.quotes_v1(like praxis_reporting.projects_v1 including all);
    create table praxis_reporting.quote_versions_v1(like praxis_reporting.projects_v1 including all);
    create table praxis_reporting.enquiry_requests_v1(like praxis_reporting.projects_v1 including all);
    create table praxis_reporting.workload_v1(project_id uuid,work_item_id uuid,payload jsonb,omission_count int default 0);
    create table praxis_reporting.specialist_workload_v1(domain text,record_id uuid,project_id uuid,payload jsonb,omission_count int default 0);`);
  await db.exec('create role briefing_reader;grant usage on schema praxis_reporting to briefing_reader;grant select on all tables in schema praxis_reporting to briefing_reader;');
  mocks.query.mockImplementation(async(strings:TemplateStringsArray,...values:unknown[])=>{
    if(strings.join('').includes('transaction_timestamp()'))return [{as_of:at}];
    await db.exec('set role briefing_reader');
    try{return (await db.query(strings.reduce((text,p,i)=>text+(i?`$${i}`:'')+p,''),values)).rows;}finally{await db.exec('reset role');}
  });
});
afterAll(async()=>{await db.close();vi.useRealTimers();});
beforeEach(async()=>{
  await db.exec('truncate praxis_reporting.projects_v1,praxis_reporting.contacts_v1,praxis_reporting.quotes_v1,praxis_reporting.quote_versions_v1,praxis_reporting.enquiry_requests_v1,praxis_reporting.workload_v1,praxis_reporting.specialist_workload_v1');
  await db.exec(`insert into praxis_reporting.contacts_v1(id,payload) values('${id(2)}','{"name":"Synthetic Customer","email":"synthetic@example.invalid"}');
  insert into praxis_reporting.projects_v1(id,project_id,parent_id,payload) values('${id(1)}','${id(1)}','${id(2)}','{"name":"Synthetic Project","contactId":"${id(2)}","pipelineStage":"Sent","archivedAt":null,"createdAt":"2026-09-01T00:00:00Z","notes":"not exported"}');
  insert into praxis_reporting.quotes_v1(id,project_id,payload) values('${id(3)}','${id(1)}','{"quoteRef":"Q-SYNTHETIC"}');
  insert into praxis_reporting.quote_versions_v1(id,project_id,parent_id,payload) values('${id(4)}','${id(1)}','${id(3)}','{"versionNumber":1,"status":"SENT","sentAt":"2026-09-02T00:00:00Z","acceptedAt":null,"supersededAt":null,"expiresAt":"2026-10-01T00:00:00Z","totalIncGstCents":123450}');
  insert into praxis_reporting.enquiry_requests_v1(id,project_id,payload) values('${id(5)}','${id(1)}','{"contactId":"${id(2)}","enquiryType":"residential","createdAt":"2026-09-01T00:00:00Z","message":"not exported"}');
  insert into praxis_reporting.workload_v1 values('${id(1)}','${id(6)}','{"projectName":"Synthetic Project","modelVersion":2,"statePresent":true,"projectState":"ACTIVE","manual":true,"retired":false,"title":"Synthetic follow-up","status":"BLOCKED","assigneeUserId":null,"ownerKey":null,"assigneeName":null,"dueAt":"2026-09-20T00:00:00Z","completedAt":null,"completedBy":null,"recordedAt":"2026-09-01T00:00:00Z"}',0);
  insert into praxis_reporting.specialist_workload_v1 values('installation','${id(7)}','${id(1)}','{"status":"done","identityKey":null,"identityName":null,"identityActive":null,"projectPresent":true,"archived":false,"plannedStart":null,"forecastStart":null,"forecastEndExclusive":null,"actualStart":"2026-09-15","actualFinish":"2026-09-14","recordedAt":"2026-09-01T00:00:00Z"}',0),
  ('design','${id(8)}','${id(1)}','{"status":"DONE","identityKey":null,"projectPresent":true,"archived":false,"requestedAt":"2026-09-01T00:00:00Z","dueAt":null,"startedAt":null,"completedAt":"2026-09-15T00:00:00Z","cancelledAt":null,"recordedAt":"2026-09-01T00:00:00Z"}',0);`);
});
const read=()=>readPraxisBriefing(config,id(99));
describe('complete compact briefing source SQL',()=>{
  it('exports all six compact families and strict identities with contact identity email but without notes/messages; preserves anomalies',async()=>{
    const value=await read();for(const domain of Object.values(value.domains))expect(domain).toMatchObject({status:'available',complete:true,count:1,limit:5000});
    expect(JSON.stringify(value)).not.toMatch(/not exported|notes/);
    expect(value.domains.projects.status==='available'&&value.domains.projects.records[0]!.facts.contactEmail).toBe('synthetic@example.invalid');
    expect(value.cash).toEqual({status:'unavailable',reason:'business_cash_not_projected'});
    expect(value.domains.installation.status==='available'&&value.domains.installation.records[0]!.facts.actualFinish).toBe('2026-09-14');
    if(process.env.PRAXIS_BRIEFING_WIRE_PATH)writeFileSync(process.env.PRAXIS_BRIEFING_WIRE_PATH,JSON.stringify(value,null,2));
  });
  it('preserves null contact email and withholds an oversized identity value',async()=>{
    await db.exec("update praxis_reporting.contacts_v1 set payload=jsonb_set(payload,'{email}','null')");
    const absent=await read();expect(absent.domains.projects.status==='available'&&absent.domains.projects.records[0]!.facts.contactEmail).toBeNull();
    await db.exec("update praxis_reporting.contacts_v1 set payload=jsonb_set(payload,'{email}',to_jsonb(repeat('x',255)))");
    expect((await read()).domains.projects).toMatchObject({status:'unavailable',reason:'invalid_projection'});
  });
  it('does not mistake equal counts for unchanged business records, ignores update-only provenance',async()=>{
    const before=await read();await db.exec(`update praxis_reporting.projects_v1 set recorded_at='2026-09-20';`);const neutral=await read();
    expect(neutral.domains.projects.status==='available'&&neutral.domains.projects.fingerprint).toBe(before.domains.projects.status==='available'&&before.domains.projects.fingerprint);
    await db.exec(`update praxis_reporting.workload_v1 set payload=jsonb_set(payload,'{status}','"OPEN"');`);const after=await read();
    expect(after.domains.manualWork.status==='available'&&after.domains.manualWork.count).toBe(1);
    expect(after.domains.manualWork.status==='available'&&after.domains.manualWork.fingerprint).not.toBe(before.domains.manualWork.status==='available'&&before.domains.manualWork.fingerprint);
  });
  it('reporting role cannot mutate the synthetic safe projection',async()=>{await db.exec('set role briefing_reader');try{await expect(db.exec('delete from praxis_reporting.projects_v1')).rejects.toThrow();}finally{await db.exec('reset role');}});
  it('sorts business fields and records canonically for fingerprints',()=>{expect(briefingFingerprint([{id:id(1),projectId:null,facts:{b:2,a:1}}])).toBe(briefingFingerprint([{projectId:null,id:id(1),facts:{a:1,b:2}}]));});
  it('returns complete populations beyond the former first50',async()=>{
    await db.exec(`insert into praxis_reporting.enquiry_requests_v1(id,project_id,payload) select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'${id(1)}',payload from generate_series(1,55) n cross join praxis_reporting.enquiry_requests_v1;`);
    expect((await read()).domains.enquiries).toMatchObject({status:'available',count:56});
  });
  it('preserves date-only expiry and normalizes timestamp offsets without inventing a date timezone',async()=>{
    for(const [input,expected] of [['2026-10-01','2026-10-01'],['2026-10-01T12:00:00+12:00','2026-10-01T00:00:00.000Z'],[null,null]]) {
      await db.exec(`update praxis_reporting.quote_versions_v1 set payload=jsonb_set(payload,'{expiresAt}','${JSON.stringify(input)}'::jsonb)`);
      const value=await read();expect(value.domains.quoteVersions.status==='available'&&value.domains.quoteVersions.records[0]!.facts.expiresAt).toBe(expected);
    }
    await db.exec("update praxis_reporting.quote_versions_v1 set payload=jsonb_set(payload,'{expiresAt}','\"2026-02-30\"')");
    expect((await read()).domains.quoteVersions).toMatchObject({status:'unavailable',reason:'invalid_projection'});
  });
  it('captures a complete synthetic business population above the former limit, including all project work coverage',async()=>{
    await db.exec(`insert into praxis_reporting.contacts_v1(id,payload)
      select ('50000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
        jsonb_build_object('name','Synthetic customer '||n,'email','synthetic-'||n||'@example.invalid') from generate_series(1,1197) n;
      insert into praxis_reporting.projects_v1(id,project_id,parent_id,payload)
      select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
        ('50000000-0000-4000-8000-'||lpad(((n-1)%1197+1)::text,12,'0'))::uuid,
        jsonb_set(jsonb_set(payload,'{name}',to_jsonb('Synthetic project '||n)),'{contactId}',to_jsonb('50000000-0000-4000-8000-'||lpad(((n-1)%1197+1)::text,12,'0')))
        from generate_series(1,1309) n cross join praxis_reporting.projects_v1;
      insert into praxis_reporting.workload_v1(project_id,work_item_id,payload,omission_count)
        select id,null,'{"modelVersion":2,"statePresent":true}',0 from praxis_reporting.projects_v1 where id<>'${id(1)}';
      insert into praxis_reporting.enquiry_requests_v1(id,project_id,payload)
        select ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'${id(1)}',payload from generate_series(1,1166) n cross join praxis_reporting.enquiry_requests_v1;
      insert into praxis_reporting.quote_versions_v1(id,project_id,parent_id,payload)
        select ('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,project_id,parent_id,
          jsonb_set(jsonb_set(payload,'{versionNumber}',to_jsonb(n+1)),'{expiresAt}',case when n%3=0 then 'null'::jsonb when n%3=1 then '"2026-10-01"'::jsonb else '"2026-10-01T00:00:00Z"'::jsonb end)
        from generate_series(1,626) n cross join praxis_reporting.quote_versions_v1;`);
    const value=await read();
    for(const [name,count] of Object.entries({projects:1310,enquiries:1167,quoteVersions:627,manualWork:1,installation:1,design:1})) {
      const domain=value.domains[name as keyof typeof value.domains];
      expect(domain).toMatchObject({status:'available',complete:true,count,limit:5000});
      if(domain.status==='available')expect(domain.records).toHaveLength(count);
    }
    expect(Buffer.byteLength(JSON.stringify(value))).toBeGreaterThan(262144);
    expect(Buffer.byteLength(JSON.stringify(value))).toBeLessThan(2*1024*1024);
    if(process.env.PRAXIS_BRIEFING_SCALE_WIRE_PATH)writeFileSync(process.env.PRAXIS_BRIEFING_SCALE_WIRE_PATH,JSON.stringify(value));
  });
  it('withholds overflow as unavailable, not a truncated complete array',async()=>{
    await db.exec(`insert into praxis_reporting.enquiry_requests_v1(id,project_id,payload) select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'${id(1)}',payload from generate_series(1,5000) n cross join praxis_reporting.enquiry_requests_v1;`);
    expect((await read()).domains.enquiries).toEqual({status:'unavailable',reason:'record_limit',limit:5000});
  });
  it('retains archived/cancelled current records and excludes only established test records',async()=>{
    await db.exec(`update praxis_reporting.projects_v1 set payload=jsonb_set(payload,'{archivedAt}','"2026-09-20T00:00:00Z"');update praxis_reporting.workload_v1 set payload=jsonb_set(payload,'{status}','"CANCELLED"');
    insert into praxis_reporting.enquiry_requests_v1(id,payload) values('f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70','{}');`);
    const value=await read();expect(value.domains.projects).toMatchObject({status:'available',count:1});expect(value.domains.manualWork).toMatchObject({status:'available',count:1});expect(value.domains.enquiries).toMatchObject({status:'available',count:1});
  });
  it.each(['omission','duplicate','future'])('marks invalid entire family unavailable: %s',async kind=>{
    if(kind==='omission')await db.exec('update praxis_reporting.enquiry_requests_v1 set omission_count=1');
    if(kind==='duplicate')await db.exec('insert into praxis_reporting.enquiry_requests_v1 select * from praxis_reporting.enquiry_requests_v1');
    if(kind==='future')await db.exec(`update praxis_reporting.enquiry_requests_v1 set recorded_at='2099-01-01'`);
    expect((await read()).domains.enquiries).toMatchObject({status:'unavailable',reason:'invalid_projection'});
  });
  it('missing work model preserves unavailable instead of empty manual work',async()=>{await db.exec(`update praxis_reporting.workload_v1 set payload=jsonb_set(payload,'{modelVersion}','null');`);expect((await read()).domains.manualWork).toMatchObject({status:'unavailable'});});
  it('missing optional view becomes unavailable without hiding other domains',async()=>{
    await db.exec('alter table praxis_reporting.specialist_workload_v1 rename to held_specialist');
    try {const value=await read();expect(value.domains.design).toMatchObject({status:'unavailable',reason:'projection_missing'});expect(value.domains.enquiries).toMatchObject({status:'available'});}finally{await db.exec('alter table praxis_reporting.held_specialist rename to specialist_workload_v1');}
  });
  it('rejects the whole snapshot exceeding2MiB rather than dropping families',async()=>{
    await db.exec(`insert into praxis_reporting.enquiry_requests_v1(id,project_id,payload) select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'${id(1)}',jsonb_set(payload,'{enquiryType}',to_jsonb(repeat('x',256))) from generate_series(1,4500) n cross join praxis_reporting.enquiry_requests_v1;`);
    await expect(read()).rejects.toThrow('payload limit');
  });
  it('rejects caller filters and cursor attempts',()=>{expect(()=>parseBriefingQuery(new URL('https://example.invalid/?limit=20'))).toThrow();expect(()=>parseBriefingQuery(new URL('https://example.invalid/'))).not.toThrow();});
});
