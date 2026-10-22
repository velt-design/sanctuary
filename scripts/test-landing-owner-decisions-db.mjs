import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync,readFileSync,rmSync,writeFileSync,mkdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join,resolve,dirname,basename } from 'node:path';
import {landingExperimentTestBootstrap} from './lib/landing-experiment-test-bootstrap.mjs';
const bin=process.env.SANCTUARY_DISPOSABLE_POSTGRES_BIN;
if(!bin)throw new Error('Set SANCTUARY_DISPOSABLE_POSTGRES_BIN to a local PostgreSQL installation. No remote database is used.');
const suffix=process.platform==='win32'?'.exe':'',directory=mkdtempSync(join(tmpdir(),'sanctuary-owner-decision-'));
let started=false;
const run=(name,args,input,background=false)=>{const result=spawnSync(join(bin,name+suffix),args,{input,encoding:'utf8',windowsHide:true,stdio:background?'ignore':undefined,env:{NODE_ENV:'test'},maxBuffer:2e6});if(result.status!==0)throw new Error(result.stderr??String(result.error));return result.stdout;};
const port=await new Promise((done,reject)=>{const server=createServer();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const address=server.address();if(!address||typeof address==='string')return reject();server.close(()=>done(address.port));});});
const sql=(value,db='postgres')=>run('psql',['-X','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',String(port),'-U','cluster_admin','-d',db,'-q','-At'],value);
try{
 run('initdb',['-D',directory,'-U','cluster_admin','-A','trust','--no-locale','-E','UTF8']);run('pg_ctl',['-D',directory,'-l',join(directory,'postgres.log'),'-o',`-p ${port} -h 127.0.0.1`,'-w','start'],undefined,true);started=true;
 sql(landingExperimentTestBootstrap(process.cwd()));
 sql(readFileSync('supabase/migrations/20261021020002_landing_experiments.sql','utf8'));
 sql(readFileSync('supabase/migrations/20261021050001_creative_effect_ledger.sql','utf8'));
 sql(readFileSync('supabase/migrations/20261022100001_landing_render_recovery.sql','utf8'));
 sql(readFileSync('supabase/migrations/20261022110001_landing_packaging_recovery.sql','utf8'));
 sql(readFileSync('supabase/migrations/20261022120001_landing_render_successor.sql','utf8'));
 sql(readFileSync('supabase/migrations/20261022130001_landing_completion_permit.sql','utf8'));
 sql(readFileSync('supabase/migrations/20261022140001_landing_technical_resume.sql','utf8'));
 sql(readFileSync('supabase/migrations/20261021050009_landing_authored_copy.sql','utf8'));
 const inventory=()=>JSON.parse(sql("select jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_object('hash',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),'acl',p.proacl))from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'"));
 const before=inventory();sql(readFileSync('supabase/migrations/20261023010001_landing_owner_decisions.sql','utf8'));const after=inventory();
 mkdirSync('.local-evidence',{recursive:true});writeFileSync('.local-evidence/owner-decision-function-inventory.json',JSON.stringify({changed:Object.keys(after).filter(k=>JSON.stringify(after[k])!==JSON.stringify(before[k])).map(name=>({name,before:before[name]??null,after:after[name]})),removed:Object.keys(before).filter(k=>!(k in after))},null,2));
 sql(readFileSync('supabase/tests/landing_owner_decisions.sql','utf8'));
 const call=statement=>new Promise((done,reject)=>{const child=spawn(join(bin,'psql'+suffix),['-X','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',String(port),'-U','cluster_admin','-d','postgres','-q','-At'],{windowsHide:true,env:{NODE_ENV:'test'}});child.stdout.resume();child.stderr.resume();child.on('error',reject);child.on('close',code=>done(code===0));child.stdin.end(statement);});
 sql("insert into public.landing_experiment_control(binding,template,campaign,adset,ads,admitted_until,enabled,publishing)values(repeat('b',64),repeat('a',64),'11001','11002',array['11003'],'infinity',true,false)");
 const payload=sql("select jsonb_build_object('owner','10000000-0000-4000-8000-000000000001','request',gen_random_uuid(),'generation',generation,'template',template,'controls',jsonb_build_object('/auckland-outdoor-living',control_outdoor,'/acrylic-roof-pergolas-auckland',control_acrylic),'prior',null,'correction',repeat('f',40),'day',to_char(clock_timestamp()at time zone 'Pacific/Auckland','YYYY-MM-DD'),'expiresAt',least(clock_timestamp()+interval '1 hour',date_trunc('day',clock_timestamp()at time zone 'Pacific/Auckland')at time zone 'Pacific/Auckland'+interval '1 day'-interval '1 second',date_trunc('day',clock_timestamp()at time zone 'Australia/Sydney')at time zone 'Australia/Sydney'+interval '1 day'-interval '1 second'),'funding',jsonb_build_object('day',to_char(clock_timestamp()at time zone 'Australia/Sydney','YYYY-MM-DD'),'receiptHash',repeat('a',64),'maximumModelUsd',.14308))from public.landing_experiment_control").trim();
 const claims=await Promise.all([1,2].map(()=>call(`select public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'owner_decision',null,'${payload.replaceAll("'","''")}'::jsonb)`)));
 if(claims.filter(Boolean).length!==1)throw Error('Owner decision parallel admission differs');
 if(sql('select count(*)from public.acquisition_experiment_reservation').trim()!=='1')throw Error('Global owner reservation differs');
 process.stdout.write(JSON.stringify({ownerDecision:true,ordinaryCountsPreserved:true,disposableOnly:true,liveCalls:0,postgres:sql('show server_version').trim()}));
}finally{
 if(started)run('pg_ctl',['-D',directory,'-m','immediate','-w','stop'],undefined,true);
 if(dirname(resolve(directory))===resolve(tmpdir())&&basename(directory).startsWith('sanctuary-owner-decision-'))rmSync(directory,{recursive:true,force:true});
}
