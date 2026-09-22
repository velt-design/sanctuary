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
const container=`sanctuary-praxis-workload-${process.pid}-${Date.now()}`;
const directory=bin ? mkdtempSync(path.join(tmpdir(),'sanctuary-praxis-workload-')) : null;
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
    create schema praxis_reporting;create schema auth;revoke all on schema auth from public;
    grant usage on schema praxis_reporting to sanctuary_praxis_reader;
    create table auth.users(id uuid,raw_user_meta_data jsonb,email text,deleted_at timestamptz,banned_until timestamptz);
    create table public.portal_users(user_id uuid);
    create table public.projects(id uuid,name text,archived_at timestamptz,updated_at timestamptz default now());
    create table public.project_work_model_versions(project_id uuid,model_version integer);
    create table public.project_operational_states(project_id uuid,state text,updated_at timestamptz default now());
    create table public.project_owner_assignments(project_id uuid,owner_key text,updated_at timestamptz default now());
    create table public.project_work_items(id uuid,project_id uuid,title text,status text,due_at timestamptz,origin text,source_type text,source_key text,series_key text,
      assignee_user_id uuid,completed_at timestamptz,completed_by uuid,updated_at timestamptz default now());`);
  // Use the actual production sanitizer and bounds correction, not a test stub.
  const bootstrap=read('supabase/migrations/20260916000002_praxis_reporting_current_bootstrap.sql');
  sql(bootstrap.slice(bootstrap.indexOf('create or replace function praxis_reporting.forbidden_nested_key_v1'),bootstrap.indexOf('create or replace view praxis_reporting.enquiry_requests_v1')));
  sql(read('supabase/migrations/20260917000001_praxis_projection_aggregate_bounds.sql'));
  sql(`insert into auth.users values('10000000-0000-4000-8000-000000000001','{"full_name":" Synthetic Staff ","password":"synthetic-private-marker","unrelated":"do not project"}','private@example.test',null,null);
    insert into public.portal_users values('10000000-0000-4000-8000-000000000001');
    insert into public.projects(id,name) values('20000000-0000-4000-8000-000000000001','Synthetic Project');
    insert into public.project_work_model_versions values('20000000-0000-4000-8000-000000000001',2);
    insert into public.project_operational_states(project_id,state) values('20000000-0000-4000-8000-000000000001','ACTIVE');
    insert into public.project_work_items(id,project_id,title,status,due_at,origin,source_type,assignee_user_id) values
      ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Prepare design','OPEN',now(),'MANUAL','MANUAL','10000000-0000-4000-8000-000000000001');`);
  const snapshot=()=>sql("select row_to_json(t)::text from public.project_work_items t;");const before=snapshot();
  const migration=read('supabase/migrations/20260922000001_praxis_staff_workload.sql');
  sql(migration.replace(/^begin;/,'begin;').replace(/commit;\s*$/,'rollback;'));
  assert.equal(sql("select to_regclass('praxis_reporting.workload_v1') is null"),'t');
  sql(migration);sql(migration);assert.equal(snapshot(),before);
  const payload=JSON.parse(sql('select payload from praxis_reporting.workload_v1',true));
  assert.equal(payload.assigneeName,'Synthetic Staff');assert.equal(payload.manual,true);assert.equal(payload.retired,false);
  assert.doesNotMatch(JSON.stringify(payload),/private@example|synthetic-private-marker|unrelated|raw_user_meta_data|password/);
  for(const title of ['Call client','Confirm site_visit','Confirm site-visit','Confirm site visits']){
    sql(`update public.project_work_items set title='${title}'`);assert.equal(sql("select payload->>'retired' from praxis_reporting.workload_v1",true),'true');
  }
  sql("update auth.users set raw_user_meta_data='{}';");assert.equal(sql("select payload->'assigneeName' from praxis_reporting.workload_v1",true),'null');
  sql("update auth.users set raw_user_meta_data='{\"name\":\"Fallback name\"}',banned_until=now()+interval '1 day';");
  assert.equal(sql("select payload->'assigneeName' from praxis_reporting.workload_v1",true),'null');
  for(const statement of ['select * from auth.users','select * from public.portal_users','select * from public.project_work_items',
    "update public.project_work_items set status='DONE'",'delete from praxis_reporting.workload_v1']){
    const result=sql(statement,true,true);assert.notEqual(result.status,0);assert.match(result.stderr,/permission denied|not automatically updatable/i);
  }
  assert.equal(sql("select has_table_privilege('anon','praxis_reporting.workload_v1','select') or has_table_privilege('authenticated','praxis_reporting.workload_v1','select') or has_table_privilege('service_role','praxis_reporting.workload_v1','select')"),'f');
  console.log(`PASS: PostgreSQL17 (${bin?'native':'Docker'}) exact workload migration rollback/replay, unchanged business rows, production sanitiser, narrow staff names, retirement rules, reporting-only access and base/auth/write denial with read-only defaults off.`);
}finally{
  if(started){if(bin)success(run('pg_ctl',['-D',data,'-m','fast','-w','stop']));else success(docker(['rm','--force','--volumes',container]));}
  if(directory){
    const resolved=path.resolve(directory);if(path.dirname(resolved)!==path.resolve(tmpdir())||!path.basename(resolved).startsWith('sanctuary-praxis-workload-'))throw new Error('Unsafe cleanup path.');
    rmSync(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
}
