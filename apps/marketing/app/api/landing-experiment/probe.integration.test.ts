// @vitest-environment node
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {createHmac} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {afterAll,beforeAll,expect,it,vi} from 'vitest';
import {landingExperimentTestBootstrap} from '../../../../../scripts/lib/landing-experiment-test-bootstrap.mjs';
const seam=vi.hoisted(()=>({rpc:vi.fn(),errors:[] as string[]}));
vi.mock('@/lib/supabaseService',()=>({getServiceSupabase:()=>seam}));
import {POST} from './route';
import {POST as commandPost} from './command/route';
import {EXPERIMENT_TEMPLATE,experimentHash,readAssignment,signAssignment,signProbeReceipt} from '../../../lib/landingExperiment.server';
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
 database=new PGlite();await database.exec(landingExperimentTestBootstrap(process.cwd()));await database.exec(readFileSync('supabase/migrations/20261021020002_landing_experiments.sql','utf8'));
 for(const file of ['20261021050001_creative_effect_ledger.sql','20261021050002_creative_executor.sql','20261021050003_creative_measurement.sql','20261021050009_landing_authored_copy.sql'])await database.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
 await database.query(`insert into landing_experiment_control(binding,template,campaign,adset,ads,admitted_until,enabled) values($1,$2,'11001','11002',array['11003'],'infinity',true)`,['b'.repeat(64),EXPERIMENT_TEMPLATE]);
 await database.query(`insert into landing_experiments(id,path,template,copy,control_copy,state,candidate_hash,evidence_hash,generator,minimum_exposures,duration_days) values($1,$2,$3,'explore','{}','candidate',$4,$5,'resp_fixture',100,14)`,[id,path,EXPERIMENT_TEMPLATE,'c'.repeat(64),'e'.repeat(64)]);
 seam.rpc.mockImplementation((name:string,args:Record<string,unknown>)=>({abortSignal:async()=>{
  if(name==='marketing_public_rate_limit_take')return{data:[{allowed:true}],error:null};
  if(!['landing_experiment_command','landing_experiment_probe_visit','landing_experiment_visit'].includes(name))throw new Error('Unexpected RPC');
  try{const result=await database.query(`select public.${name}(${Object.keys(args).map((key,index)=>`${key}=>$${index+1}`).join(',')}) result`,Object.values(args));return{data:(result.rows[0] as {result:unknown}).result,error:null};}catch(error){seam.errors.push(error instanceof Error?error.message:'Unknown synthetic database error');return{data:null,error:{code:'denied'}};}
 }}));
 await registerProbe();
});
it('passes authored copy through the actual signed command and source SQL without widening claims',async()=>{
 await database.exec('begin');
 try{
  await database.query("update landing_experiments set state='rejected',created_at=clock_timestamp()-interval '8 days'");
  const experiment='c1000000-0000-4000-8000-000000000009',copy='copy:design:Plan your outdoor space';
  const body={version:1,command:'c2000000-0000-4000-8000-000000000009',experiment,stage:'prepare',payload:{generation:1,candidateHash:experimentHash({path,copy,template:EXPERIMENT_TEMPLATE,evidenceHash:'e'.repeat(64)}),evidenceHash:'e'.repeat(64),template:EXPERIMENT_TEMPLATE,path,copy,generator:'resp_authored',minimumExposures:100,durationDays:14},at:Date.now()};
  const send=()=>commandPost(new Request(origin+'/api/landing-experiment/command',{method:'POST',headers:{'x-landing-signature':createHmac('sha256',key).update('command\n'+JSON.stringify(body)).digest('base64url')},body:JSON.stringify(body)}));
  const response=await send();expect(response.status,seam.errors.join('; ')).toBe(200);expect((await database.query('select copy from landing_experiments where id=$1',[experiment])).rows).toEqual([{copy}]);
  body.payload.copy='copy:design:Free guaranteed pergola';body.command='c2000000-0000-4000-8000-000000000010';expect((await send()).status).toBe(503);
 }finally{await database.exec('rollback');}
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
 for(const target of ['/auckland-outdoor-living','/acrylic-roof-pergolas-auckland'])for(const copy of ['explore','project','estimate','copy:design:Explore your outdoor space and plan your pergola','copy:help:Plan your outdoor living space','copy:support:Choose your pergola size and roof. Plan your outdoor space with help for your home.',...(target==='/acrylic-roof-pergolas-auckland'?['action-first']:[])]){
 await database.exec('truncate landing_experiment_receipts,landing_experiment_probes');
 await database.query('update landing_experiments set path=$1,copy=$2,state=$3',[target,copy,'candidate']);await registerProbe();trace('probe registered');
 const experiment=(await database.query('select * from landing_experiments where id=$1',[id])).rows[0];
 const filename=`${target.slice(1)}-${copy.replace(/[^a-z0-9-]/gi,'-')}`;
 const receipt=await renderLandingCandidate({experiment,renderer,probe:grant,signal:AbortSignal.timeout(65000),checkpoint:async()=>{trace('renderer checkpoint');},executablePath:browser,readResourceForTest,
   store:async(width:number,_hash:string,bytes:Uint8Array)=>writeFileSync(resolve(directory,`${filename}-${width}.jpg`),bytes)});
 writeFileSync(resolve(directory,`${filename}.json`),JSON.stringify(receipt,null,2));expect(receipt.status).toBe('pass');
 expect((await database.query('select assignments,exposures,reloads from landing_experiment_probes')).rows).toEqual([{assignments:6,exposures:6,reloads:5}]);
 expect((await database.query('select count(*)::int n from landing_experiment_assignments')).rows).toEqual([{n:0}]);
 }
 // Additional local acceptance uses the same real handlers/SQL. It is not an
 // extra hosted render admission or a genuine campaign visitor.
 const puppeteer=createRequire(rendererModule!)('puppeteer-core');
 const ui=await puppeteer.launch({executablePath:browser,headless:true,args:[]});
 try{for(const viewport of [{width:320,height:568},{width:390,height:740},{width:390,height:844},{width:1440,height:960}])for(const banner of [false,true]){
  trace(`mobile ${viewport.width}x${viewport.height} banner=${banner}: setup`);
  await database.exec('truncate landing_experiment_receipts,landing_experiment_probes');
  await database.query("update landing_experiments set path='/acrylic-roof-pergolas-auckland',copy='action-first',state='candidate'");await registerProbe();
  const isolated=await ui.createBrowserContext(),page=await isolated.newPage();await page.setViewport(viewport);await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.setRequestInterception(true);let release!:()=>void,requested!:()=>void;
  const assigned=new Promise<void>(resolve=>{requested=resolve;}),hold=new Promise<void>(resolve=>{release=resolve;});
  page.on('request',async(request:{url:()=>string;method:()=>string;headers:()=>Record<string,string>;postData:()=>string|undefined;abort:(reason:string)=>Promise<void>;respond:(response:unknown)=>Promise<void>})=>{
   const url=new URL(request.url()),diagnostic=url.origin===origin&&url.pathname==='/api/landing-experiment'&&request.method()==='POST';
   if(!diagnostic&&!createRequire(import.meta.url)(rendererModule!).renderRequestAllowed(request.url(),'/acrylic-roof-pergolas-auckland',request.method())){await request.abort('blockedbyclient');return;}
   try{if(diagnostic&&JSON.parse(request.postData()??'{}').stage==='assign'){requested();await hold;}
    await request.respond(await readResourceForTest(request.url(),{method:request.method(),headers:{...request.headers(),...(diagnostic?{'x-landing-probe':capability}:{})},body:request.postData()}));
   }catch{await request.abort('failed');}
  });
  if(!banner)await page.evaluateOnNewDocument(()=>localStorage.setItem('sp_consent_v1',JSON.stringify({version:1,analytics:true,marketing:true,updatedAt:new Date().toISOString()})));
  await page.goto(`${origin}/acrylic-roof-pergolas-auckland?${new URLSearchParams(utm)}`,{waitUntil:'domcontentloaded'});
  trace(`mobile ${viewport.width}x${viewport.height} banner=${banner}: loaded`);
  if(banner){await page.waitForSelector('.consent-banner');expect(await page.$eval('[data-landing-copy="layout"]',(node:Element)=>node.getAttribute('data-landing-copy-key'))).toBe('control');
   await page.screenshot({path:resolve(directory,`layout-${viewport.width}x${viewport.height}-banner.jpg`)});
   await page.locator('.consent-banner .consent-btn--solid').click();}
  await Promise.race([assigned,new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('Local assignment was not requested')),10000))]);
  trace(`mobile ${viewport.width}x${viewport.height} banner=${banner}: assignment held`);
  await page.evaluate(()=>document.fonts.ready);
  const geometry=()=>page.evaluate(()=>{const host=document.querySelector('[data-landing-copy="layout"]')!,a=host.querySelector('a')!,support=host.querySelector('p')!,b=a.getBoundingClientRect();return{top:b.top,bottom:b.bottom,x:b.left+b.width/2,support:support.getBoundingClientRect().top,links:Array.from(host.querySelectorAll('a')).map(link=>[link.textContent,link.getAttribute('href')])};});
  const before=await geometry();
  const delivered=page.waitForResponse((response:{url:()=>string;request:()=>{postData:()=>string|undefined}})=>response.url()===origin+'/api/landing-experiment'&&JSON.parse(response.request().postData()??'{}').stage==='assign');
  await page.mouse.move(before.x,Math.min(before.bottom-2,viewport.height-10));await page.mouse.down();release();await delivered;
  await page.waitForFunction(()=>document.readyState==='complete');
  expect((await geometry()).top).toBeCloseTo(before.top,1);
  await page.mouse.move(1,70);await page.mouse.up();
  // A pointer-focused link is deliberately stable until focus also leaves it.
  await page.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();});
  await page.waitForSelector('[data-landing-copy="layout"][data-landing-copy-key="action-first"]');
  const after=await geometry();expect(after.links).toEqual(before.links);
  if(viewport.width<=760){expect(after.top).toBeLessThan(before.top);expect(after.bottom).toBeLessThanOrEqual(viewport.height);expect(after.top).toBeLessThan(after.support);}
  else expect(after.top).toBeCloseTo(before.top,1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:resolve(directory,`layout-${viewport.width}x${viewport.height}-${banner?'accepted':'existing'}.jpg`)});
  await page.focus('[data-landing-copy="layout"] a');await page.keyboard.press('Tab');
  expect(await page.evaluate(()=>document.activeElement?.getAttribute('href'))).toBe('#project-details');
  await page.click('[data-landing-copy="layout"] a[href="#your-design"]');
  expect(new URL(page.url()).hash).toBe('#your-design');
  await page.evaluate(()=>history.back());await page.waitForFunction(()=>location.hash==='');
  expect(await page.$eval('[data-landing-copy="layout"]',(node:Element)=>node.getAttribute('data-landing-copy-key'))).toBe('action-first');
  await isolated.close();
 }}finally{await ui.close();}
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
