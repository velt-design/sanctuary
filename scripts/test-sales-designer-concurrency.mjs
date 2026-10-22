// Synthetic PostgreSQL 17 locking proof. Existing local binaries only; no remote URL.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync,readFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:net';
import postgres from 'postgres';
const root=path.resolve(import.meta.dirname,'..'),bin=process.env.PRAXIS_DISPOSABLE_POSTGRES_BIN;
if(!bin||!path.isAbsolute(bin))throw Error('Set PRAXIS_DISPOSABLE_POSTGRES_BIN to existing local PostgreSQL 17 binaries.');
const directory=mkdtempSync(path.join(tmpdir(),'sanctuary-sales-designer-')),data=path.join(directory,'data');
const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
function run(name,args){const r=spawnSync(path.join(bin,`${name}${process.platform==='win32'?'.exe':''}`),args,{cwd:root,encoding:'utf8',windowsHide:true,timeout:60000,stdio:name==='pg_ctl'?'ignore':'pipe'});assert.equal(r.status,0,r.stderr??name);}
const clients=[];let started=false;
const id=n=>`99999999-9999-4999-8999-${String(n).padStart(12,'0')}`,actor=id(1),project=id(2);
async function client(){const sql=postgres({host:'127.0.0.1',port,username:'postgres',database:'postgres',max:1,onnotice:()=>{}});const c={query:async(text,args=[])=>({rows:await sql.unsafe(text,args)}),end:()=>sql.end()};clients.push(c);await c.query(`set statement_timeout='8s';set lock_timeout='6s';set test.uid='${actor}'`);return c;}
async function waiting(admin){const until=Date.now()+3000;while(Date.now()<until){if((await admin.query("select count(*)::int n from pg_stat_activity where datname='postgres' and pid<>pg_backend_pid() and wait_event_type='Lock'")).rows[0].n===2)return;await new Promise(resolve=>setTimeout(resolve,20));}throw Error('Both synthetic writers did not reach the held lock');}
const outcomes=process.argv.includes('--outcomes');
const keys=outcomes?['test','refunded',null]:['steve','joe','steve'];
const commandTable=outcomes?'project_sales_outcome_commands':'project_sales_designer_commands',stateTable=outcomes?'project_sales_outcomes':'project_sales_designers';
const command=(c,idValue,revision,key)=>c.query(`select public.${outcomes?'project_sales_outcome_record':'project_sales_designer_assign'}($1,$2,$3,$4,$5) value`,[project,idValue,revision,key,'Synthetic concurrency proof']);
try{
 run('initdb',['-D',data,'-U','postgres','-A','trust','--no-locale','--encoding=UTF8']);
 run('pg_ctl',['-D',data,'-l',path.join(directory,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']);started=true;
 const admin=await client(),a=await client(),b=await client();assert.equal(Math.floor(Number((await admin.query('show server_version_num')).rows[0].server_version_num)/10000),17);
 await admin.query(`create role anon;create role authenticated;create role service_role;create schema private;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
 create table public.portal_users(user_id uuid primary key,role text);create table public.projects(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select current_setting('test.uid')::uuid$$;
 insert into auth.users values('${actor}','jordan@sanctuarypergolas.co.nz',now(),null,null);insert into portal_users values('${actor}','staff');insert into projects values('${project}');`);
 await admin.query(readFileSync(path.join(root,'supabase/migrations/20261021040001_project_sales_designer.sql'),'utf8'));
 await admin.query(readFileSync(path.join(root,'supabase/migrations/20261021100001_designer_accepted_sales.sql'),'utf8'));
 await admin.query(readFileSync(path.join(root,'supabase/migrations/20261022010001_designer_history_support.sql'),'utf8'));
 // Both real connections wait on the same project lock before competing at revision zero.
 await admin.query('begin');await admin.query('select 1 from projects where id=$1 for update',[project]);
 const first=command(a,id(3),0,keys[0]),second=command(b,id(4),0,keys[1]);
 const results=Promise.allSettled([first,second]);await waiting(admin);await admin.query('commit');const settled=await results;
 assert.equal(settled.filter(r=>r.status==='fulfilled').length,1);assert.equal(settled.find(r=>r.status==='rejected').reason.code,'40001');
 assert.equal((await admin.query(`select count(*)::int n from private.${commandTable}`)).rows[0].n,1);
 const winner=settled.find(r=>r.status==='fulfilled').value.rows[0].value;assert.equal(winner.revision,1);
 // Simultaneous retries of the same new command serialize and return one immutable receipt.
 await admin.query('begin');await admin.query('select 1 from projects where id=$1 for update',[project]);
 const retries=Promise.all([command(a,id(5),1,keys[2]),command(b,id(5),1,keys[2])]);await waiting(admin);await admin.query('commit');const replay=await retries;assert.deepEqual(replay[0].rows,replay[1].rows);
 assert.equal((await admin.query(`select count(*)::int n from private.${commandTable}`)).rows[0].n,2);
 // Revocation committed before dispatch is visible to the real guarded command.
 await admin.query('delete from portal_users where user_id=$1',[actor]);await assert.rejects(command(a,id(6),2,keys[1]),e=>e.code==='42501');
 assert.equal((await admin.query(`select revision from private.${stateTable}`)).rows[0].revision,2);
 console.log(outcomes?'Report-only outcome commands:':'Designer assignment commands:');
 console.log('PASS: native PostgreSQL 17 competing revisions, simultaneous idempotent replay and revoked authority. Synthetic prerequisites; not PostgREST or production schema proof.');
}finally{
 await Promise.allSettled(clients.map(c=>c.end()));if(started)run('pg_ctl',['-D',data,'-m','immediate','-w','stop']);
 const resolved=path.resolve(directory);if(!resolved.startsWith(path.resolve(tmpdir())+path.sep))throw Error('Unsafe cleanup target');rmSync(resolved,{recursive:true,force:true});
}
