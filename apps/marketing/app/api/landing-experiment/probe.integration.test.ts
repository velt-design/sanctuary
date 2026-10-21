// @vitest-environment node
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {createHmac} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {afterAll,beforeAll,expect,it,vi} from 'vitest';
import {landingExperimentTestBootstrap} from '../../../../../scripts/lib/landing-experiment-test-bootstrap.mjs';
const seam=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('@/lib/supabaseService',()=>({getServiceSupabase:()=>seam}));
import {POST} from './route';
import {POST as commandPost} from './command/route';
import {EXPERIMENT_TEMPLATE,readAssignment,signAssignment,signProbeReceipt} from '../../../lib/landingExperiment.server';
const origin='https://www.sanctuarypergolas.co.nz',path='/auckland-outdoor-living',key='synthetic-probe-'.repeat(4),id='c1000000-0000-4000-8000-000000000001',probe='c2000000-0000-4000-8000-000000000001';
const utm={utm_source:'facebook',utm_medium:'paid_social',utm_campaign:'11001',utm_content:'11003',utm_term:'11002'};
let database:PGlite,capability:string;
let grant:Record<string,unknown>;
async function registerProbe(mode:'prepare'|'live'='prepare',probeId=probe){
 const generation=(await database.query('select generation::int n from landing_experiment_control')).rows[0] as {n:number};
 const body={version:1,command:probeId,experiment:id,stage:'probe',payload:{generation:generation.n,candidateHash:'c'.repeat(64),template:EXPERIMENT_TEMPLATE,mode,probe:probeId},at:Date.now()};
 const response=await commandPost(new Request(origin+'/api/landing-experiment/command',{method:'POST',headers:{'x-landing-signature':createHmac('sha256',key).update('command\n'+JSON.stringify(body)).digest('base64url')},body:JSON.stringify(body)}));
 expect(response.status).toBe(200);grant=await response.json();capability=grant.capability as string;
}
beforeAll(async()=>{
 vi.stubEnv('SANCTUARY_LANDING_EXPERIMENT_ENABLED','true');vi.stubEnv('SANCTUARY_LANDING_EXPERIMENT_KEY',key);vi.stubEnv('SANCTUARY_LANDING_EXPERIMENT_BINDING','b'.repeat(64));
 database=new PGlite();await database.exec(landingExperimentTestBootstrap(process.cwd()));await database.exec(readFileSync('supabase/migrations/20261021010002_landing_experiments.sql','utf8'));
 await database.query(`insert into landing_experiment_control(binding,template,campaign,adset,ads,admitted_until,enabled) values($1,$2,'11001','11002',array['11003'],'infinity',true)`,['b'.repeat(64),EXPERIMENT_TEMPLATE]);
 await database.query(`insert into landing_experiments(id,path,template,copy,control_copy,state,candidate_hash,evidence_hash,generator,minimum_exposures,duration_days) values($1,$2,$3,'explore','{}','candidate',$4,$5,'resp_fixture',100,14)`,[id,path,EXPERIMENT_TEMPLATE,'c'.repeat(64),'e'.repeat(64)]);
 seam.rpc.mockImplementation((name:string,args:Record<string,unknown>)=>({abortSignal:async()=>{
  if(name==='marketing_public_rate_limit_take')return{data:[{allowed:true}],error:null};
  if(!['landing_experiment_command','landing_experiment_probe_visit','landing_experiment_visit'].includes(name))throw new Error('Unexpected RPC');
  try{const result=await database.query(`select public.${name}(${Object.keys(args).map((key,index)=>`${key}=>$${index+1}`).join(',')}) result`,Object.values(args));return{data:(result.rows[0] as {result:unknown}).result,error:null};}catch{return{data:null,error:{code:'denied'}};}
 }}));
 await registerProbe();
});
afterAll(async()=>{await database?.close();vi.unstubAllEnvs();});
function post(body:unknown,headers:Record<string,string>={}){return POST(new Request(origin+'/api/landing-experiment',{method:'POST',headers:{origin,'x-landing-probe':capability,...headers},body:JSON.stringify(body)}));}
it('uses actual handlers and SQL for separate cookie assignment, reload and exposure without genuine records or real cookie mutation',async()=>{
 const real=signAssignment({assignment:'c3000000-0000-4000-8000-000000000001',experiment:id,path});
 const response=await post({stage:'assign',path,consent:true,utm},{cookie:`sp_landing_experiment_outdoor=${real}`});expect(response.status).toBe(200);
 const cookie=response.headers.get('set-cookie')!.split(';')[0],body=await response.json();expect(cookie).toMatch(/^sp_landing_diagnostic=/);expect(cookie).not.toContain(real);expect(readAssignment(body.assignment.receipt)).toBeNull();
 expect((await post({stage:'expose',path,consent:true,receipt:body.assignment.receipt})).status).toBe(503);
 expect((await post({stage:'expose',path,consent:true,receipt:body.assignment.receipt},{cookie})).status).toBe(200);
 const reload=await post({stage:'assign',path,consent:true,utm},{cookie});expect(reload.status).toBe(200);const second=await reload.json();expect(second.assignment.assignment).toBe(body.assignment.assignment);
 expect((await post({stage:'expose',path,consent:true,receipt:second.assignment.receipt},{cookie})).status).toBe(200);
 expect((await database.query('select assignments,exposures,reloads from landing_experiment_probes')).rows).toEqual([{assignments:2,exposures:2,reloads:1}]);
 expect((await database.query('select count(*)::int n from landing_experiment_assignments')).rows).toEqual([{n:0}]);
 expect((await database.query('select count(*)::int n from landing_experiment_enquiries')).rows).toEqual([{n:0}]);
});
it.each(['forged','wrong-purpose','wrong-path','no-consent','server-disabled'])('fails closed at the public boundary: %s',async kind=>{
 const body={stage:'assign',path:kind==='wrong-path'?'/acrylic-roof-pergolas-auckland':path,consent:kind!=='no-consent',utm};
 if(kind==='server-disabled')vi.stubEnv('SANCTUARY_LANDING_EXPERIMENT_ENABLED','false');
 const response=await post(body,{'x-landing-probe':kind==='forged'?capability+'x':kind==='wrong-purpose'?signProbeReceipt(probe):capability});
 expect(response.status===503||(await response.json()).assignment===null).toBe(true);
 vi.stubEnv('SANCTUARY_LANDING_EXPERIMENT_ENABLED','true');
});
it('rejects diagnostic receipts at the genuine visitor boundary even if leaked',async()=>{
 const response=await post({stage:'assign',path,consent:true,utm,receipt:signProbeReceipt(probe)},{'x-landing-probe':''});expect(response.status).toBe(503);
});
const localOrigin=process.env.IMPROVEMENT_RENDER_FIXTURE_ORIGIN,rendererModule=process.env.IMPROVEMENT_RENDER_MODULE,browser=process.env.IMPROVEMENT_RENDER_EXECUTABLE;
it.skipIf(!localOrigin||!rendererModule||!browser)('runs the actual renderer, local compiled page, actual handlers and SQL with browser Set-Cookie/reload and zero genuine exposure',async()=>{
 const local=new URL(localOrigin!);expect(local.protocol).toBe('http:');expect(['127.0.0.1','localhost']).toContain(local.hostname);
 const trace=(stage:string)=>writeFileSync(resolve('.local-evidence/correction-browser-stage.txt'),stage);
 trace('loading compiled renderer');
 const {renderLandingCandidate,verifyLandingServing}=createRequire(import.meta.url)(rendererModule!);
 trace('renderer loaded');
 const renderer=JSON.parse(readFileSync('apps/marketing/data/landing-template.generated.json','utf8')).hash;
 const directory=resolve('.local-evidence/correction-serving-render');mkdirSync(directory,{recursive:true});
 const readResourceForTest=async(url:string,request:{method:string;headers:Record<string,string>;body?:string})=>{
    const target=new URL(url);let response:Response;
    if(request.method==='POST')response=await POST(new Request(url,{method:'POST',headers:request.headers,body:request.body}));
    else response=await fetch(new URL(target.pathname+target.search,local),{redirect:'error',signal:AbortSignal.timeout(15000)});
    const cookie=response.headers.get('set-cookie');
    // fetch has decoded the body. Do not forward its original wire encoding or
    // length into Chromium's fulfilled local-fixture response.
    return{status:response.status,contentType:response.headers.get('content-type')??'application/octet-stream',headers:cookie?{'set-cookie':cookie}:{},body:new Uint8Array(await response.arrayBuffer())};
   };
 for(const target of ['/auckland-outdoor-living','/acrylic-roof-pergolas-auckland'])for(const copy of ['explore','project','estimate']){
 await database.exec('truncate landing_experiment_receipts,landing_experiment_probes');
 await database.query('update landing_experiments set path=$1,copy=$2,state=$3',[target,copy,'candidate']);await registerProbe();trace('probe registered');
 const experiment=(await database.query('select * from landing_experiments where id=$1',[id])).rows[0];
 const receipt=await renderLandingCandidate({experiment,renderer,probe:grant,signal:AbortSignal.timeout(65000),checkpoint:async()=>{trace('renderer checkpoint');},executablePath:browser,readResourceForTest,
   store:async(width:number,_hash:string,bytes:Uint8Array)=>writeFileSync(resolve(directory,`${target.slice(1)}-${copy}-${width}.jpg`),bytes)});
 writeFileSync(resolve(directory,`${target.slice(1)}-${copy}.json`),JSON.stringify(receipt,null,2));expect(receipt.status).toBe('pass');
 expect((await database.query('select assignments,exposures,reloads from landing_experiment_probes')).rows).toEqual([{assignments:6,exposures:6,reloads:5}]);
 expect((await database.query('select count(*)::int n from landing_experiment_assignments')).rows).toEqual([{n:0}]);
 }
 await database.exec("update landing_experiment_control set publishing=true;update landing_experiments set state='live',started_at=clock_timestamp(),ends_at=clock_timestamp()+interval '14 days',lease_until=clock_timestamp()+interval '5 hours'");
 await registerProbe('live','c2000000-0000-4000-8000-000000000002');
 const experiment=(await database.query('select * from landing_experiments where id=$1',[id])).rows[0];
 const generation=(await database.query('select generation::int n from landing_experiment_control')).rows[0] as {n:number};
 const input={experiment,renderer,probe:grant,generation:generation.n,signal:AbortSignal.timeout(21000),checkpoint:async()=>{},executablePath:browser,readResourceForTest};
 const live=await verifyLandingServing(input);writeFileSync(resolve(directory,'live.json'),JSON.stringify(live,null,2));expect(live.status).toBe('pass');
 await registerProbe('live','c2000000-0000-4000-8000-000000000003');vi.stubEnv('SANCTUARY_LANDING_EXPERIMENT_ENABLED','false');
 const unavailable=await verifyLandingServing({...input,probe:grant,signal:AbortSignal.timeout(21000)});expect(unavailable.status).toBe('fail');
 writeFileSync(resolve(directory,'disabled-route.json'),JSON.stringify(unavailable,null,2));vi.stubEnv('SANCTUARY_LANDING_EXPERIMENT_ENABLED','true');
 expect((await database.query('select count(*)::int n from landing_experiment_assignments')).rows).toEqual([{n:0}]);
},430000);
