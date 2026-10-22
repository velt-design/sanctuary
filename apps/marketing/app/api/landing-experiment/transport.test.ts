// @vitest-environment node
import {createServer,type Server} from 'node:http';
import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {PGlite} from '@electric-sql/pglite';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {beforeAll,afterAll,beforeEach,afterEach,expect,it,vi} from 'vitest';
import {landingExperimentTestBootstrap} from '../../../../../scripts/lib/landing-experiment-test-bootstrap.mjs';
const seam=vi.hoisted(()=>({client:null as unknown as SupabaseClient}));
vi.mock('@/lib/supabaseService',()=>({getServiceSupabase:()=>seam.client}));
import {POST} from './route';
import {EXPERIMENT_TEMPLATE,signProbe} from '../../../lib/landingExperiment.server';

// Synthetic PostgreSQL state behind a real loopback HTTP/Supabase transport.
// No request may leave this server. Reply delay starts after the SQL commits.
const origin='https://www.sanctuarypergolas.co.nz',path='/acrylic-roof-pergolas-auckland';
const experiment='cccccccc-0000-4000-8000-000000000001',probe='dddddddd-0000-4000-8000-000000000001';
const utm={utm_source:'facebook',utm_medium:'paid_social',utm_campaign:'11001',utm_content:'11003',utm_term:'11002'};
const canary='SYNTHETIC_PRIVATE_TRANSPORT_BODY';
let db:PGlite,server:Server,capability:string,mode='healthy',delayLimiter=0,delayReply=0;
let calls:string[]=[],committed=0,activeController:AbortController|undefined;
let warning:ReturnType<typeof vi.spyOn>;
const timers=new Set<ReturnType<typeof setTimeout>>();
const sleep=(ms:number)=>new Promise<void>(resolve=>{const timer=setTimeout(()=>{timers.delete(timer);resolve();},ms);timers.add(timer);});
beforeAll(async()=>{
 vi.stubEnv('SANCTUARY_LANDING_EXPERIMENT_ENABLED','true');vi.stubEnv('SANCTUARY_LANDING_EXPERIMENT_KEY','synthetic-transport-key-'.repeat(3));vi.stubEnv('MARKETING_ABUSE_HASH_SECRET','synthetic-transport-abuse-key');
 db=new PGlite();await db.exec(landingExperimentTestBootstrap(process.cwd()));await db.exec(readFileSync('supabase/migrations/20261021020002_landing_experiments.sql','utf8'));
 await db.query(`insert into landing_experiment_control(binding,template,campaign,adset,ads,admitted_until,enabled,publishing) values($1,$2,'11001','11002',array['11003'],'infinity',true,true)`,['b'.repeat(64),EXPERIMENT_TEMPLATE]);
 await db.query(`insert into landing_experiments(id,path,template,copy,control_copy,state,candidate_hash,evidence_hash,generator,minimum_exposures,duration_days) values($1,$2,$3,'action-first','{}','candidate',$4,$5,'resp_synthetic',100,14)`,[experiment,path,EXPERIMENT_TEMPLATE,'c'.repeat(64),'e'.repeat(64)]);
 server=createServer(async(req,res)=>{try{
   let raw='';for await(const chunk of req)raw+=chunk.toString();const args=JSON.parse(raw),name=new URL(req.url!,'http://localhost').pathname.split('/').at(-1)!;calls.push(name);
   if(name==='marketing_public_rate_limit_take'){await sleep(delayLimiter);res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify([{allowed:mode!=='rate_denied'}]));return;}
   if(!['landing_experiment_probe_visit','landing_experiment_visit'].includes(name))throw Error('Unexpected local RPC');
   const row=await db.query(`select public.${name}(${Object.keys(args).map((key,index)=>`${key}=>$${index+1}`).join(',')}) result`,Object.values(args));committed++;
   if(mode==='client_abort')activeController?.abort();
   await sleep(delayReply);res.writeHead(200,{'content-type':'application/json'});res.end(mode==='malformed'?canary:JSON.stringify((row.rows[0] as {result:unknown}).result));
 }catch{if(!res.headersSent)res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({code:'P0001',message:canary}));}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('Local address missing');
 seam.client=createClient(`http://127.0.0.1:${address.port}`,'synthetic-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(input,init)=>{
   const url=new URL(String(input));if(url.hostname!=='127.0.0.1'||url.port!==String(address.port))throw Error('Nonlocal request denied');return fetch(input,init);
 }}});
},30000);
afterAll(async()=>{for(const timer of timers)clearTimeout(timer);server?.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await db?.close();vi.unstubAllEnvs();});
beforeEach(async()=>{
 mode='healthy';delayLimiter=0;delayReply=0;calls=[];committed=0;activeController=undefined;warning=vi.spyOn(console,'warn').mockImplementation(()=>undefined);
 await db.exec('truncate landing_experiment_enquiries,landing_experiment_assignments,landing_experiment_probes');await db.query("update landing_experiments set state='candidate',lease_until=null,ends_at=null");
 await db.query(`insert into landing_experiment_probes(id,experiment,mode,generation,template,candidate_hash,expires_at) values($1,$2,'prepare',1,$3,$4,clock_timestamp()+interval '100 seconds')`,[probe,experiment,EXPERIMENT_TEMPLATE,'c'.repeat(64)]);
 capability=signProbe({probe,experiment,candidateHash:'c'.repeat(64),template:EXPERIMENT_TEMPLATE,generation:1,mode:'prepare',path,expires:Date.now()+100000});
});
afterEach(()=>{const logged=JSON.stringify(warning.mock.calls);expect(logged).not.toContain(canary);expect(logged).not.toContain(probe);expect(logged).not.toContain(experiment);expect(logged).not.toContain(capability);vi.restoreAllMocks();});
function post(diagnostic=true,body:Record<string,unknown>={},cookie?:string){return POST(new Request(origin+'/api/landing-experiment',{method:'POST',signal:activeController?.signal,headers:{origin,...(diagnostic?{'x-landing-probe':capability}:{}),...(cookie?{cookie}:{})},body:JSON.stringify({stage:'assign',path,consent:true,utm,...body})}));}
async function live(){await db.query("update landing_experiments set state='live',started_at=clock_timestamp(),lease_until=clock_timestamp()+interval '1 hour',ends_at=clock_timestamp()+interval '14 days'");}
async function prefill(){let cookie='';for(let n=0;n<3;n++){const assigned=await post(true,{},cookie);expect(assigned.status).toBe(200);const body=await assigned.json();cookie=assigned.headers.get('set-cookie')!.split(';')[0];expect((await post(true,{stage:'expose',receipt:body.assignment.receipt,utm:undefined},cookie)).status).toBe(200);}calls=[];committed=0;return cookie;}
async function counts(){return (await db.query('select assignments,exposures,reloads from landing_experiment_probes')).rows[0];}
it.each([true,false])('returns the actual committed reply at1800ms without retry, diagnostic=%s',async diagnostic=>{
 if(!diagnostic)await live();delayLimiter=600;delayReply=1200;const start=performance.now(),response=await post(diagnostic),elapsed=performance.now()-start;
 expect(response.status).toBe(200);expect((await response.json()).assignment).toMatchObject({experiment,path});expect(elapsed).toBeGreaterThanOrEqual(1750);expect(elapsed).toBeLessThan(3000);expect(calls).toHaveLength(2);expect(committed).toBe(1);expect(warning).not.toHaveBeenCalled();
},10000);
it.each([true,false])('does not infer success from SQL committed before a reply exceeds3000ms, diagnostic=%s',async diagnostic=>{
 const cookie=diagnostic?await prefill():undefined;if(!diagnostic)await live();delayLimiter=600;delayReply=2800;const start=performance.now(),response=await post(diagnostic,{},cookie),elapsed=performance.now()-start;
 expect(response.status).toBe(503);expect(await response.json()).toEqual({assignment:null,controlCopies:null});expect(elapsed).toBeGreaterThanOrEqual(2900);expect(elapsed).toBeLessThan(4200);expect(calls).toHaveLength(2);expect(committed).toBe(1);
 if(diagnostic)expect(await counts()).toEqual({assignments:4,exposures:3,reloads:3});else expect((await db.query('select count(*)::int n from landing_experiment_assignments')).rows).toEqual([{n:1}]);
 expect(warning).toHaveBeenCalledExactlyOnceWith('landing-visit-failure',{stage:'visit',code:'timeout'});
},10000);
it('reports transport failure without exposing malformed postcommit response or treating counters as success',async()=>{
 const cookie=await prefill();mode='malformed';const response=await post(true,{},cookie);expect(response.status).toBe(503);expect(await counts()).toEqual({assignments:4,exposures:3,reloads:3});expect(committed).toBe(1);expect(calls).toHaveLength(2);
 expect(warning).toHaveBeenCalledExactlyOnceWith('landing-visit-failure',{stage:'visit',code:'transport'});
});
it('classifies client abort after commit separately, without another RPC',async()=>{
 activeController=new AbortController();mode='client_abort';delayReply=100;const response=await post();expect(response.status).toBe(503);expect(committed).toBe(1);expect(calls).toHaveLength(2);
 expect(warning).toHaveBeenCalledExactlyOnceWith('landing-visit-failure',{stage:'visit',code:'aborted'});
});
it('retains signed cookie and rate boundaries without a diagnostic exemption',async()=>{
 const cookie=await prefill();expect(cookie).toMatch(/^sp_landing_diagnostic=/);expect((await post(true,{},'sp_landing_diagnostic=invalid')).status).toBe(503);expect(await counts()).toEqual({assignments:3,exposures:3,reloads:2});expect(committed).toBe(0);
 mode='rate_denied';calls=[];expect((await post(true,{},cookie)).status).toBe(429);expect(calls).toEqual(['marketing_public_rate_limit_take']);expect(await counts()).toEqual({assignments:3,exposures:3,reloads:2});
});
