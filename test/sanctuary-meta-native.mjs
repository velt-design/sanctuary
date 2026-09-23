// Disposable local PostgreSQL only. Synthetic prerequisite schema, not a full-schema claim.
// Run: node test/sanctuary-meta-native.mjs
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const container = `sanctuary-meta-native-${process.pid}-${Date.now()}`;
const migration = readFileSync(new URL('../supabase/migrations/20260923050001_sanctuary_meta_reporting.sql', import.meta.url), 'utf8');
const correction = readFileSync(new URL('../supabase/migrations/20260923050002_sanctuary_meta_scoped_deletes.sql', import.meta.url), 'utf8');
const safeupdate = process.env.SANCTUARY_META_SAFEUPDATE === 'true';
const actor = '10000000-0000-4000-8000-000000000001', connection = '20000000-0000-4000-8000-000000000001';
const literal = (value) => value === null ? 'null' : `'${String(value).replaceAll("'", "''")}'`;
function docker(args, input) {
 const result = spawnSync('docker', args, { encoding:'utf8', input, maxBuffer:8*1024*1024, windowsHide:true });
 if (result.status !== 0) throw new Error(result.stderr || result.error?.message || 'Docker failed');
 return result.stdout.trim();
}
const args = (db='postgres') => ['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',db];
const sql = (body, db) => docker(args(db), (safeupdate ? "load 'safeupdate';\n" : '') + body);
const command = (action, operation=null, query=null, step=null, payload=null) => `select public.sanctuary_meta_command(${[actor,'123','a'.repeat(64),'synthetic',connection,'test',action,operation,query,step,payload].map(literal).join(',')});`;
const query = JSON.stringify({start:'2026-08-01',end:'2026-08-07',retain:true});
const payload = () => JSON.stringify({version:'sanctuary-meta-campaigns-v1',source:'meta',complete:true,period:{start:'2026-08-01',end:'2026-08-07'},fetchedAt:new Date().toISOString()});
const call = (db,...values) => JSON.parse(sql('set role service_role;'+command(...values),db));
function session(db,name) {
 const child=spawn('docker',args(db),{stdio:['pipe','pipe','pipe'],windowsHide:true}); let out='',err='';
 child.stdout.on('data',chunk=>{out+=chunk;}); child.stderr.on('data',chunk=>{err+=chunk;});
 const done=new Promise(resolve=>child.on('exit',code=>resolve({code,out,err})));
 child.stdin.write(`set application_name=${literal(name)};\n`);
 if(safeupdate) child.stdin.write("load 'safeupdate';\n");
 return {send:body=>child.stdin.write(body+'\n'),end:()=>child.stdin.end(),done};
}
async function until(check,label) {
 const deadline=Date.now()+10000;
 while(Date.now()<deadline){if(check())return;await new Promise(resolve=>setTimeout(resolve,40));}
 throw new Error('Timed out: '+label);
}
async function competing(db,firstSql,secondSql,expectedFailure) {
 const first=session(db,'meta-first'),second=session(db,'meta-second');
 try {
  first.send('begin;set local role service_role;'+firstSql);
  await until(()=>sql("select count(*) from pg_stat_activity where application_name='meta-first' and state='idle in transaction'",db)==='1','first transaction owns lock');
  second.send('set role service_role;'+secondSql);second.end();
  await until(()=>sql("select count(*) from pg_stat_activity where application_name='meta-second' and wait_event_type='Lock'",db)==='1','second real connection waits on lock');
  first.send('commit;');first.end();
  assert.equal((await first.done).code,0);
  const result=await second.done;
  if(expectedFailure){assert.notEqual(result.code,0);assert.match(result.err,expectedFailure);}else assert.equal(result.code,0,result.err);
 } finally {first.end();second.end();}
}
function fixture(name) {sql(`create database ${name} template meta_template`);return name;}
function ready(db){const op=call(db,'claim',null,query).operation;for(const step of ['identity_check','account_read','report_read']){call(db,'before',op,null,step);call(db,'after',op,null,step);}return op;}
try {
 docker(safeupdate ? ['run','-d','--rm','--name',container,'--user','postgres','--entrypoint','sh','public.ecr.aws/supabase/postgres:17.6.1.167','-c','initdb -D /tmp/meta-proof -U postgres --auth=trust >/dev/null && exec postgres -D /tmp/meta-proof']
  : ['run','-d','--rm','--name',container,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine']);
 await until(()=>{try{return docker(['exec',container,'pg_isready','-U','postgres']).includes('accepting');}catch{return false;}},'PostgreSQL startup');
 assert.match(sql('show server_version'),/^17\./);
 sql(`create role anon;create role authenticated;create role service_role;create role praxis_reporting;
 create schema auth;create schema private;create schema praxis_reporting;create schema cron;
 create table cron.job(name text primary key,schedule text,command text);
 create function cron.schedule(text,text,text) returns integer language sql as 'insert into cron.job values($1,$2,$3);select 1';
 create table auth.users(id uuid primary key,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
 create table public.portal_users(user_id uuid primary key references auth.users(id),role text not null check(role in ('admin','staff')),created_at timestamptz default now());
 create table praxis_reporting.source_identity_v1(singleton boolean primary key check(singleton),source_key text not null,connection_id uuid not null,environment text not null);
 insert into auth.users values('${actor}',now(),null,null);insert into public.portal_users(user_id,role) values('${actor}','staff');
 insert into praxis_reporting.source_identity_v1 values(true,'synthetic','${connection}','test');
 create table public.existing_business_marker(id integer primary key,value text not null);insert into public.existing_business_marker values(1,'synthetic pre-existing row');`);
 const preserved=sql("select md5(string_agg(row_to_json(t)::text,',')) from (select * from public.existing_business_marker)t");
 sql(migration.replace(/commit;\s*$/i,'rollback;'));
 assert.equal(sql("select count(*) from pg_class where relname like 'sanctuary_meta_%'"),'0');
 assert.equal(sql('select count(*) from cron.job'),'0');
 sql(migration);
 assert.equal(sql('select count(*) from private.sanctuary_meta_control'),'0');
 assert.equal(sql("select md5(string_agg(row_to_json(t)::text,',')) from (select * from public.existing_business_marker)t"),preserved);
 assert.equal(sql('select count(*) from cron.job'),'1');
 for(const role of ['anon','authenticated','praxis_reporting']) assert.throws(()=>sql(`set role ${role};`+command('read')),/permission denied/);
 assert.throws(()=>sql('set role service_role;select * from private.sanctuary_meta_snapshot'),/permission denied/);
 sql(`insert into private.sanctuary_meta_control(actor_id,account_id,binding_hash,enabled,expires_at,source_key,connection_id,environment) values('${actor}','123','${'a'.repeat(64)}',true,now()+interval '1 day','synthetic','${connection}','test')`);
 if(safeupdate) assert.throws(()=>call('postgres','delete'),/DELETE requires a WHERE clause/);
 const originalDefinition=sql("select md5(prosrc) from pg_proc where oid='public.sanctuary_meta_command(uuid,text,text,text,uuid,text,text,uuid,text,text,text)'::regprocedure");
 sql(correction.replace(/commit;\s*$/i,'rollback;'));
 assert.equal(sql("select md5(prosrc) from pg_proc where oid='public.sanctuary_meta_command(uuid,text,text,text,uuid,text,text,uuid,text,text,text)'::regprocedure"),originalDefinition);
 sql(correction);
 assert.equal(sql("select count(*) from pg_proc where proname in ('sanctuary_meta_command','sanctuary_meta_changed') and position('delete from private.sanctuary_meta_snapshot;' in prosrc)>0"),'0');
 assert.throws(()=>sql(correction),/Unknown Meta source function/);
 sql('create database meta_template template postgres');
 const claims=fixture('meta_claims');await competing(claims,command('claim',null,query),command('claim',null,query),/Meta read limit/);
 assert.equal(sql('select count(*) from private.sanctuary_meta_operations',claims),'1');
 const deleted=fixture('meta_delete_first'),pending=ready(deleted);
 await competing(deleted,command('delete'),command('complete',pending,null,null,payload()),/Meta report association unavailable/);
 assert.equal(call(deleted,'read').status,'missing');
 const completed=fixture('meta_complete_first'),op=ready(completed);
 await competing(completed,command('complete',op,null,null,payload()),command('delete'));
 assert.equal(call(completed,'read').status,'missing');assert.throws(()=>call(completed,'deliver',op),/Meta delivery authority unavailable/);
 const revoke=fixture('meta_revoke'),revoked=ready(revoke);
 call(revoke,'complete',revoked,null,null,payload());
 assert.equal(call(revoke,'read').operation,revoked);
 sql('update private.sanctuary_meta_control set enabled=false where singleton=true',revoke);
 assert.equal(sql('select count(*) from private.sanctuary_meta_snapshot',revoke),'0');
 assert.throws(()=>call(revoke,'complete',revoked,null,null,payload()),/Meta authority unavailable/);
 assert.equal(call(revoke,'delete').status,'deleted');
 const pendingRevoke=fixture('meta_pending_revoke'),pendingRevoked=ready(pendingRevoke);
 sql('update private.sanctuary_meta_control set enabled=false where singleton=true',pendingRevoke);
 assert.throws(()=>call(pendingRevoke,'complete',pendingRevoked,null,null,payload()),/Meta authority unavailable/);
 assert.equal(sql('select count(*) from private.sanctuary_meta_snapshot',pendingRevoke),'0');
 const stale=fixture('meta_stale'),staleOp=ready(stale);
 call(stale,'complete',staleOp,null,null,payload());
 sql('update private.sanctuary_meta_snapshot set generation=generation+1 where singleton=true',stale);
 assert.equal(call(stale,'read').status,'missing');
 console.log(JSON.stringify({result:'pass',postgres:sql('show server_version'),safeupdateLoaded:safeupdate,migrationSha256:createHash('sha256').update(migration).digest('hex'),correctionSha256:createHash('sha256').update(correction).digest('hex'),proof:['DDL rollback removes all new objects and cron record','correction rollback preserves original function','unknown function bodies refused','default disabled, no provisioned control','synthetic existing-row preservation','browser roles and direct service table access denied','true concurrent claim serialization','delete wins before complete','complete then delete removes snapshot and denies delivery','disabled source rejects save but permits deletion'],limits:['synthetic prerequisite schema; not complete current Sanctuary schema','cron.schedule persistence double; real pg_cron scheduler not exercised','no provider or remote database calls']}));
} finally {docker(['rm','-f',container]);}
