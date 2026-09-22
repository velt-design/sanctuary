// Disposable PostgreSQL 17 only (local binaries or an isolated Docker container).
// Never accepts a service/database URL or mounts the repository into a container.
import { spawnSync } from 'node:child_process';
import { mkdtempSync,readFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
const bin=process.env.PRAXIS_DISPOSABLE_POSTGRES_BIN;
if(bin&&!path.isAbsolute(bin))throw new Error('PRAXIS_DISPOSABLE_POSTGRES_BIN must be an absolute local PostgreSQL17 bin directory.');
const image=process.env.PRAXIS_REPORTING_DB_IMAGE?.trim() || 'postgres:17-alpine';
const container=`sanctuary-praxis-specialist-${process.pid}-${Date.now()}`;
const directory=bin ? mkdtempSync(path.join(tmpdir(),'sanctuary-praxis-specialist-')) : null;
const data=directory ? path.join(directory,'data') : null;
const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
function run(name,args,input){return spawnSync(path.join(bin,`${name}${process.platform==='win32'?'.exe':''}`),args,{cwd:root,encoding:'utf8',windowsHide:true,input,timeout:60000,stdio:name==='pg_ctl'?'ignore':'pipe'});}
function success(result){if(result.error||result.status!==0)throw new Error(result.error?.message??result.stderr);return result.stdout?.trim()??'';}
function docker(args,input){return spawnSync('docker',args,{cwd:root,encoding:'utf8',windowsHide:true,input,timeout:60000,maxBuffer:10*1024*1024});}
function sql(statement,reader=false,allowFailure=false){
  const args=['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',String(bin?port:5432),'-U',reader?'workload_probe':'postgres','-d','postgres'];
  const result=bin ? run('psql',args,statement) : docker(['exec','-i',container,'psql',...args],statement);
  return allowFailure?result:success(result);
}
const read=file=>readFileSync(path.join(root,file),'utf8');
let started=false;
try{
  if(bin){
    success(run('initdb',['-D',data,'-U','postgres','-A','trust','--no-locale','--encoding=UTF8']));
    success(run('pg_ctl',['-D',data,'-l',path.join(directory,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']));started=true;
  }else{
    // Trust is confined to a disposable container with no network or host ports.
    success(docker(['run','--detach','--rm','--network','none','--name',container,'--env','POSTGRES_HOST_AUTH_METHOD=trust',image]));started=true;
    let ready=false;
    for(let attempt=0;attempt<60;attempt++){
      if(docker(['exec',container,'pg_isready','-h','127.0.0.1','-U','postgres']).status===0){ready=true;break;}
      await new Promise(resolve=>setTimeout(resolve,500));
    }
    if(!ready)throw new Error('Disposable workload PostgreSQL did not become ready.');
  }
  const major=Math.floor(Number(sql('show server_version_num'))/10000);
  assert.equal(major,17,'Workload denial proof requires PostgreSQL 17.');
  sql(`create role anon;create role authenticated;create role service_role;create role sanctuary_praxis_reader;
    create role workload_probe login inherit;grant sanctuary_praxis_reader to workload_probe;
    create schema praxis_reporting;grant usage on schema praxis_reporting to sanctuary_praxis_reader;
    create table public.projects(id uuid primary key,name text,archived_at timestamptz,updated_at timestamptz default now());
    create table public.schedule_crews(id uuid primary key,name text,is_active boolean,updated_at timestamptz default now());
    create table public.scheduled_jobs(id uuid primary key,job_id uuid,crew_id uuid,status text,planned_start date,forecast_start date,forecast_end_exclusive date,actual_start date,actual_finish date,updated_at timestamptz default now());
    create table public.design_package_requests(id uuid primary key,project_id uuid,status text,assigned_designer uuid,requested_at timestamptz default now(),due_at timestamptz,started_at timestamptz,completed_at timestamptz,cancelled_at timestamptz,updated_at timestamptz default now());`);
  const bootstrap=read('supabase/migrations/20260916000002_praxis_reporting_current_bootstrap.sql');
  sql(bootstrap.slice(bootstrap.indexOf('create or replace function praxis_reporting.forbidden_nested_key_v1'),bootstrap.indexOf('create or replace view praxis_reporting.enquiry_requests_v1')));
  sql(read('supabase/migrations/20260917000001_praxis_projection_aggregate_bounds.sql'));
  sql(`insert into public.projects(id,name) values('20000000-0000-4000-8000-000000000001','Synthetic Project');
    insert into public.schedule_crews(id,name,is_active) values('30000000-0000-4000-8000-000000000001','Synthetic Crew',true);
    insert into public.scheduled_jobs(id,job_id,crew_id,status,actual_start,actual_finish)
      select ('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','done','2020-09-20','2020-09-18' from generate_series(1,65) i;
    insert into public.design_package_requests(id,project_id,status,assigned_designer) values('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','OPEN','11111111-1111-4111-8111-111111111111');`);
  const snapshot=()=>sql("select md5(string_agg(row_to_json(t)::text,'' order by id)) from public.scheduled_jobs t");const before=snapshot();
  // Apply the exact merged marketing functions alongside the specialist view.
  // Minimal auth prerequisites prove access isolation, not the entire marketing schema.
  sql(`create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    insert into auth.users values('90000000-0000-4000-8000-000000000001','ordinary@example.test',now());
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function public.has_portal_access() returns boolean language sql stable as $$select auth.uid() is not null$$;`);
  sql('begin;'+read('supabase/migrations/20260922000002_marketing_performance_read.sql')+read('supabase/migrations/20260922000003_marketing_performance_developer_access.sql')+'commit;');
  const marketingDefinition=()=>sql("select md5(pg_get_functiondef(oid)||coalesce(proacl::text,'')) from pg_proc where oid='public.marketing_performance_read(date,date)'::regprocedure");
  const marketingBefore=marketingDefinition();
  const migration=read('supabase/migrations/20260922053001_praxis_specialist_workload.sql');
  sql(migration.replace(/commit;\s*$/,'rollback;'));
  assert.equal(sql("select to_regclass('praxis_reporting.specialist_workload_v1') is null"),'t');
  sql(migration);assert.equal(snapshot(),before);
  assert.equal(marketingDefinition(),marketingBefore,'Specialist apply must preserve the marketing function and ACL.');
  const marketingCall="select public.marketing_performance_read('2020-09-01','2020-09-22')";
  const readerMarketing=sql(marketingCall,true,true);
  assert.notEqual(readerMarketing.status,0);assert.match(readerMarketing.stderr,/permission denied/i);
  const ordinaryMarketing=sql("set role authenticated;set request.jwt.claim.sub='90000000-0000-4000-8000-000000000001';"+marketingCall,false,true);
  assert.notEqual(ordinaryMarketing.status,0);assert.match(ordinaryMarketing.stderr,/Developer access required/);
  assert.equal(sql('select count(*) from praxis_reporting.specialist_workload_v1',true),'66');
  const rows=JSON.parse(sql("select json_agg(t) from (select * from praxis_reporting.specialist_workload_v1 order by domain,record_id) t",true));
  assert.equal(rows[0].domain,'design');assert.equal(rows[0].payload.identityKey,'11111111-1111-4111-8111-111111111111');
  assert.equal(rows[1].payload.actualStart,'2020-09-20');assert.equal(rows[1].payload.actualFinish,'2020-09-18');
  assert.equal(rows[1].payload.identityName,'Synthetic Crew');assert.equal(rows[1].omission_count,0);
  const expected=['actualFinish','actualStart','archived','forecastEndExclusive','forecastStart','identityActive','identityKey','identityName','plannedStart','projectName','projectPresent','recordedAt','status'].sort();
  assert.deepEqual(Object.keys(rows[1].payload).sort(),expected);
  for(const statement of ['select * from public.projects','select * from public.schedule_crews','select * from public.scheduled_jobs','select * from public.design_package_requests',
    "update public.scheduled_jobs set status='done'",'delete from praxis_reporting.specialist_workload_v1']){
    const result=sql(statement,true,true);assert.notEqual(result.status,0);assert.match(result.stderr,/permission denied|not automatically updatable/i);
  }
  assert.equal(sql("select has_table_privilege('anon','praxis_reporting.specialist_workload_v1','select') or has_table_privilege('authenticated','praxis_reporting.specialist_workload_v1','select') or has_table_privilege('service_role','praxis_reporting.specialist_workload_v1','select')"),'f');
  if(process.env.PRAXIS_SPECIALIST_NATIVE_ROWS_PATH){const fs=await import('node:fs');fs.writeFileSync(process.env.PRAXIS_SPECIALIST_NATIVE_ROWS_PATH,JSON.stringify(rows));}
  console.log(`PASS: PostgreSQL17 (${bin?'native':'Docker'}) specialist exact migration rollback/apply,66 safe source rows, preserved inconsistent dates, unchanged business rows, reporting-only access and base/write denials; merged marketing function/ACL unchanged, reporting caller and ordinary staff denied marketing access.`);
}finally{
  if(started){if(bin)success(run('pg_ctl',['-D',data,'-m','fast','-w','stop']));else success(docker(['rm','--force','--volumes',container]));}
  if(directory){
    const resolved=path.resolve(directory);if(path.dirname(resolved)!==path.resolve(tmpdir())||!path.basename(resolved).startsWith('sanctuary-praxis-specialist-'))throw new Error('Unsafe cleanup path.');
    rmSync(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
}
