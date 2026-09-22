// @vitest-environment node
import {PGlite} from '@electric-sql/pglite';
import {readFileSync,writeFileSync} from 'node:fs';
import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const mocks=vi.hoisted(()=>({query:vi.fn()}));
vi.mock('../apps/portal/lib/praxis/server',async original=>({...await original<typeof import('../apps/portal/lib/praxis/server')>(),withPraxisReadTransaction:(_config:unknown,callback:(q:unknown)=>unknown)=>callback(mocks.query)}));
import {parseSpecialistQuery,readPraxisSpecialistWorkload} from '../apps/portal/lib/praxis/specialist-workload-read';
import {buildSpecialistWorkload} from '../apps/portal/lib/praxis/specialist-workload-projection';
import type {ConnectorConfig} from '../apps/portal/lib/praxis/server';
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const config={sourceKey:'synthetic',connectionId:id(1),environment:'test'} as ConnectorConfig;
const query=()=>parseSpecialistQuery(new URL('https://test.invalid/?start=2020-09-16&end=2020-09-22&limit=20'));
let db:PGlite,asOf='2020-09-22T08:00:00Z';
const read=()=>readPraxisSpecialistWorkload(query(),config,id(99));
const file=(p:string)=>readFileSync(p,'utf8');
beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create role sanctuary_praxis_reader;
    create schema praxis_reporting;grant usage on schema praxis_reporting to sanctuary_praxis_reader;
    create table public.projects(id uuid primary key,name text,archived_at timestamptz,updated_at timestamptz default '2020-09-01');
    create table public.schedule_crews(id uuid primary key,name text,is_active boolean,updated_at timestamptz default '2020-09-01');
    create table public.scheduled_jobs(id uuid primary key,job_id uuid,crew_id uuid,status text,planned_start date,forecast_start date,forecast_end_exclusive date,actual_start date,actual_finish date,updated_at timestamptz default '2020-09-01');
    create table public.design_package_requests(id uuid primary key,project_id uuid,status text,assigned_designer uuid,requested_at timestamptz default '2020-09-01',due_at timestamptz,started_at timestamptz,completed_at timestamptz,cancelled_at timestamptz,updated_at timestamptz default '2020-09-01');`);
  const bootstrap=file('supabase/migrations/20260916000002_praxis_reporting_current_bootstrap.sql');
  await db.exec(bootstrap.slice(bootstrap.indexOf('create or replace function praxis_reporting.forbidden_nested_key_v1'),bootstrap.indexOf('create or replace view praxis_reporting.enquiry_requests_v1')));
  await db.exec(file('supabase/migrations/20260917000001_praxis_projection_aggregate_bounds.sql'));
  await db.exec(file('supabase/migrations/20260922000003_praxis_specialist_workload.sql'));
  mocks.query.mockImplementation(async(strings:TemplateStringsArray,...values:unknown[])=>{
    if(strings.join('').includes('transaction_timestamp()'))return [{as_of:asOf}];
    return (await db.query(strings.reduce((text,p,i)=>text+(i?`$${i}`:'')+p,''),values)).rows;
  });
});
beforeEach(async()=>{asOf='2020-09-22T08:00:00Z';await db.exec(`truncate public.projects,public.schedule_crews,public.scheduled_jobs,public.design_package_requests;
  insert into public.projects(id,name) values('${id(1)}','Synthetic Project');
  insert into public.schedule_crews(id,name,is_active) values('${id(2)}','Synthetic Crew',true);`);});
afterAll(async()=>{await db.close();});
async function installs(size=1,patch='') {for(let n=0;n<size;n++)await db.exec(`insert into public.scheduled_jobs(id,job_id,crew_id,status,planned_start) values('${id(100+n)}','${id(1)}','${id(2)}','not_started','2020-09-20')`);if(patch)await db.exec(`update public.scheduled_jobs set ${patch}`);}
async function design(patch='') {await db.exec(`insert into public.design_package_requests(id,project_id,status,assigned_designer) values('${id(500)}','${id(1)}','OPEN','11111111-1111-4111-8111-111111111111')`);if(patch)await db.exec(`update public.design_package_requests set ${patch}`);}
describe('complete specialist source evidence',()=>{
  it('reads exact safe SQL view with distinct crew/domain-designer names and complete counts before paging',async()=>{
    await installs(65);await design();const first=await read();expect(first.counts).toEqual({installation:{current:65,completed:0,inconsistent:0},design:{current:1,completed:0,inconsistent:0}});
    expect(first.assignments.map(a=>a.identity.displayName)).toEqual(['Synthetic Crew','Joe']);
    const ids:string[]=[];for(let offset=0;offset<66;offset+=20){const page=await readPraxisSpecialistWorkload({...query(),offset,snapshot:first.snapshot},config,id(99));ids.push(...page.details.items.map(i=>i.domain+':'+i.recordId));expect(page.counts).toEqual(first.counts);}
    expect(ids).toHaveLength(66);expect(new Set(ids).size).toBe(66);
    if(process.env.PRAXIS_SPECIALIST_FIXTURE_PATH){asOf=new Date().toISOString();writeFileSync(process.env.PRAXIS_SPECIALIST_FIXTURE_PATH,JSON.stringify(await read(),null,2));}
  });
  it('filters exact identities beyond initial page without narrowing global counts',async()=>{
    await installs(65);await design();const result=await readPraxisSpecialistWorkload({...query(),filter:{domain:'design',bucket:'current',identity:{kind:'designer',key:'11111111-1111-4111-8111-111111111111'}}},config,id(99));
    expect(result.details.total).toBe(1);expect(result.counts.installation.current).toBe(65);expect(result.details.items[0]?.identity.kind).toBe('designer');
  });
  it('retains13historical reversed finishes as inconsistent, never selected-period completions',async()=>{
    await installs(13,"status='done',actual_start='2019-03-20',actual_finish='2019-03-18'");const result=await read();
    expect(result.counts.installation).toEqual({current:0,completed:0,inconsistent:13});expect(result.qualityCounts.installation.finishBeforeStart).toBe(13);
    expect(result.details.items[0]?.dates).toMatchObject({actualStart:'2019-03-20',actualFinish:'2019-03-18'});
  });
  it('separates current status, period completion, cancelled/archived/outside-period and unassigned/undated coverage',async()=>{
    await installs(1,"status='done',actual_start='2020-09-01',actual_finish='2020-09-17'");await design('assigned_designer=null');
    let result=await read();expect(result.counts.installation.completed).toBe(1);expect(result.qualityCounts.design).toMatchObject({unassignedCurrent:1,undatedCurrent:1});
    await db.exec("update public.design_package_requests set status='CANCELLED'");result=await read();expect(result.coverage.design.cancelledRecords).toBe(1);
    await db.exec("update public.scheduled_jobs set actual_finish='2020-09-15'");result=await read();expect(result.coverage.installation.completedOutsidePeriod).toBe(1);
    await db.exec("update public.projects set archived_at='2020-09-01';update public.scheduled_jobs set status='not_started',actual_finish=null");result=await read();expect(result.counts.installation.inconsistent).toBe(1);expect(result.qualityCounts.installation.archivedCurrent).toBe(1);
  });
  it('uses current DONE and NZ completion dates through today; names remain assignment not performer',async()=>{
    await design("status='DONE',started_at='2020-09-20T00:00:00Z',completed_at='2020-09-21T12:30:00Z'");const result=await read();expect(result.counts.design.completed).toBe(1);expect(result.details.items[0]?.identity.displayName).toBe('Joe');
    await db.exec("update public.design_package_requests set completed_at='2020-09-23T00:00:00Z'");expect((await read()).qualityCounts.design.futureActualDate).toBe(1);
    await db.exec("update public.design_package_requests set completed_at=null");expect((await read()).qualityCounts.design.missingCompletion).toBe(1);
  });
  it('reports missing project/inactive crew/unknown designer without guessing identity',async()=>{
    await installs();await design(`assigned_designer='${id(80)}'`);await db.exec("update public.schedule_crews set is_active=false;delete from public.projects");const result=await read();
    expect(result.counts.installation.inconsistent).toBe(1);expect(result.qualityCounts.installation.inactiveCrew).toBe(1);expect(result.details.items.every(i=>i.projectName===null)).toBe(true);expect(result.qualityCounts.design.unknownIdentityName).toBe(1);
  });
  it('rejects changed full-population snapshots including label/binding/filter/NZday and previous-first-page changes',async()=>{
    await installs(65);const first=await read();await db.exec("update public.schedule_crews set name='Changed synthetic crew'");
    await expect(readPraxisSpecialistWorkload({...query(),snapshot:first.snapshot},config,id(99))).rejects.toMatchObject({status:409});
    await expect(readPraxisSpecialistWorkload({...query(),offset:20,snapshot:first.snapshot},config,id(99))).rejects.toMatchObject({status:409});
  });
  it('withholds malformed/omitted evidence outside page and filter, no partial aggregate',async()=>{
    await installs(65);await db.exec(`update public.scheduled_jobs set status='invalid' where id='${id(164)}'`);await expect(read()).rejects.toMatchObject({status:503});
    await db.exec("update public.scheduled_jobs set status='not_started';update public.projects set name=repeat('x',1100)");await expect(read()).rejects.toMatchObject({status:503});
  });
  it('normalizes absence and denies malformed/future/crossdomain or unpinnedlaterpage queries',()=>{
    for(const suffix of ['&bucket=','&identityKey='+id(1),'&domain=design&identityKind=crew','&offset=20','&snapshot=x','&start=2020-09-16','&version=2','&to=2020-09-22'])expect(()=>parseSpecialistQuery(new URL('https://test.invalid/?start=2020-09-16&end=2020-09-22'+suffix))).toThrow();
    expect(()=>parseSpecialistQuery(new URL('https://test.invalid/?start=2020-09-22&end=2020-09-23'),new Date('2020-09-22T00:00:00Z'))).toThrow();
  });
  it('denies duplicate projection records and assignment overflow',async()=>{
    await installs();const raw=(await db.query('select * from praxis_reporting.specialist_workload_v1')).rows[0]!;
    expect(()=>buildSpecialistWorkload([raw,raw],query(),asOf)).toThrow();
    const many=Array.from({length:201},(_,n)=>({...raw,record_id:id(1000+n),payload:{...(raw.payload as object),identityKey:id(2000+n)}}));
    expect(()=>buildSpecialistWorkload(many,query(),asOf)).toThrow();
  });
  it('detects changed binding/filter and NZ midnight across DST without changing page size',async()=>{
    await installs(65);const first=await read();
    await expect(readPraxisSpecialistWorkload({...query(),snapshot:first.snapshot}, {...config,connectionId:id(90)},id(99))).rejects.toMatchObject({status:409});
    await expect(readPraxisSpecialistWorkload({...query(),snapshot:first.snapshot,filter:{...query().filter,bucket:'current'}},config,id(99))).rejects.toMatchObject({status:409});
    asOf='2020-09-26T11:59:59Z';const beforeMidnight=await read();asOf='2020-09-26T12:00:00Z';
    await expect(readPraxisSpecialistWorkload({...query(),snapshot:beforeMidnight.snapshot},config,id(99))).rejects.toMatchObject({status:409});
    const afterMidnight=await read();asOf='2020-09-26T14:00:00Z';
    expect((await readPraxisSpecialistWorkload({...query(),snapshot:afterMidnight.snapshot},config,id(99))).snapshot).toBe(afterMidnight.snapshot);
  });
  it('whole-population cap fails closed instead of reporting first10000',async()=>{
    mocks.query.mockResolvedValueOnce([{as_of:asOf}]).mockResolvedValueOnce(Array(10001).fill({}));
    await expect(read()).rejects.toMatchObject({status:503});
  });
  it('preserves native PostgreSQL payload dates through the real projection when supplied',()=>{
    if(!process.env.PRAXIS_SPECIALIST_NATIVE_ROWS_PATH)return;
    const rows=JSON.parse(readFileSync(process.env.PRAXIS_SPECIALIST_NATIVE_ROWS_PATH,'utf8'));
    const result=buildSpecialistWorkload(rows,query(),new Date().toISOString());
    expect(result.counts.installation.inconsistent).toBe(65);expect(result.qualityCounts.installation.finishBeforeStart).toBe(65);
    expect(result.counts.design.current).toBe(1);
  });
});
