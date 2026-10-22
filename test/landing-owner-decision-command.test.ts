// @vitest-environment node
// Synthetic signed command boundaries. No credential or network calls.
import {readFileSync}from 'node:fs';
import {PGlite}from '@electric-sql/pglite';
import {landingExperimentTestBootstrap}from '../scripts/lib/landing-experiment-test-bootstrap.mjs';
import {createHmac} from 'node:crypto';
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const rpc=vi.hoisted(()=>vi.fn());
vi.mock('../apps/marketing/lib/supabaseService',()=>({getServiceSupabase:()=>({rpc})}));
import {EXPERIMENT_TEMPLATE,readProbe,verifyExperimentCommand}from '../apps/marketing/lib/landingExperiment.server';
import {POST}from '../apps/marketing/app/api/landing-experiment/command/route';
const key='synthetic-capability-'.repeat(3),uuid=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const decision=()=>({owner:uuid(1),request:uuid(2),generation:7,template:EXPERIMENT_TEMPLATE,controls:{'/auckland-outdoor-living':{},'/acrylic-roof-pergolas-auckland':{}},prior:null,expiresAt:new Date(Date.now()+60000).toISOString(),day:'2026-10-23',correction:'f'.repeat(40),funding:{day:'2026-10-23',receiptHash:'a'.repeat(64),maximumModelUsd:.14308}});
function signed(stage:string,payload:unknown,experiment:string|null=null){vi.stubEnv('SANCTUARY_LANDING_EXPERIMENT_KEY',key);vi.stubEnv('SANCTUARY_LANDING_EXPERIMENT_ENABLED','true');const body=JSON.stringify({version:1,command:uuid(3),experiment,stage,payload,at:Date.now()});return{body,signature:createHmac('sha256',key).update(`command\n${body}`).digest('base64url')};}
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
it('requires exact authenticated decision identity and rejects browser Origin, fields, altered signature and obsolete template',async()=>{
 const value=signed('owner_decision',decision());expect(verifyExperimentCommand(value.body,value.signature).stage).toBe('owner_decision');
 for(const payload of[{...decision(),template:'0'.repeat(64)},{...decision(),funding:{...decision().funding,maximumModelUsd:1}},{...decision(),secret:'PRIVATE_CANARY'}]){const row=signed('owner_decision',payload);expect(()=>verifyExperimentCommand(row.body,row.signature)).toThrow();}
 expect(()=>verifyExperimentCommand(value.body,value.signature+'x')).toThrow();
 const denied=await POST(new Request('http://localhost/api/landing-experiment/command',{method:'POST',body:value.body,headers:{origin:'http://localhost','content-type':'application/json','x-landing-signature':value.signature}}));expect(denied.status).toBe(503);expect(rpc).not.toHaveBeenCalled();
 rpc.mockReturnValue({abortSignal:async()=>({data:{ownerDecision:uuid(3)},error:null})});
 const response=await POST(new Request('http://localhost/api/landing-experiment/command',{method:'POST',body:value.body,headers:{'content-type':'application/json','x-landing-signature':value.signature}}));expect(response.status).toBe(200);expect(rpc).toHaveBeenCalledOnce();
});
it('signs only unchanged probe capability fields while retaining private owner request provenance',async()=>{
 const payload={generation:7,template:EXPERIMENT_TEMPLATE,candidateHash:'a'.repeat(64),probe:uuid(4),mode:'prepare',ownerDecision:uuid(5),ownerRequest:uuid(6)},value=signed('probe',payload,uuid(7));
 rpc.mockReturnValue({abortSignal:async()=>({data:{probe:uuid(4),experiment:uuid(7),state:'candidate',path:'/acrylic-roof-pergolas-auckland',expires:new Date(Date.now()+90000).toISOString(),ownerDecision:uuid(5),ownerRequest:uuid(6)},error:null})});
 const response=await POST(new Request('http://localhost/api/landing-experiment/command',{method:'POST',body:value.body,headers:{'content-type':'application/json','x-landing-signature':value.signature}}));expect(response.status).toBe(200);const result=await response.json();expect(result.ownerDecision).toBe(uuid(5));const capability=readProbe(result.capability);expect(capability).toMatchObject({probe:uuid(4),experiment:uuid(7),candidateHash:payload.candidateHash});expect(capability).not.toHaveProperty('ownerDecision');expect(capability).not.toHaveProperty('ownerRequest');
});
it('reads the exact saved probe receipt without minting or extending a capability',async()=>{
 const payload={generation:7,template:EXPERIMENT_TEMPLATE,candidateHash:'a'.repeat(64),probe:uuid(4),mode:'prepare',ownerDecision:uuid(5),ownerRequest:uuid(6)};
 const saved={probe:uuid(4),experiment:uuid(7),path:'/acrylic-roof-pergolas-auckland',expires:new Date(Date.now()-1000).toISOString(),ownerDecision:uuid(5),ownerRequest:uuid(6)};
 const value=signed('receipt',{command:uuid(8),stage:'probe',payload},uuid(7));
 rpc.mockReturnValue({abortSignal:async()=>({data:saved,error:null})});
 const response=await POST(new Request('http://localhost/api/landing-experiment/command',{method:'POST',body:value.body,headers:{'content-type':'application/json','x-landing-signature':value.signature}}));
 expect(response.status).toBe(200);expect(await response.json()).toEqual(saved);expect(rpc).toHaveBeenCalledOnce();
 expect(rpc.mock.calls[0]?.[1]).toMatchObject({p_stage:'receipt',p_experiment:uuid(7),p_payload:{command:uuid(8),stage:'probe',payload}});
});

it('runs owner admission, immutable rejection, additive probe and genuine-delivery denials against SQL in CI',async()=>{
 const db=new PGlite();try{await db.exec(landingExperimentTestBootstrap(process.cwd()));
 for(const name of['20261021020002_landing_experiments','20261021050001_creative_effect_ledger','20261022100001_landing_render_recovery','20261022110001_landing_packaging_recovery','20261022120001_landing_render_successor','20261022130001_landing_completion_permit','20261022140001_landing_technical_resume','20261021050009_landing_authored_copy','20261023010001_landing_owner_decisions','20261023020001_landing_corrected_reassessment'])await db.exec(readFileSync(`supabase/migrations/${name}.sql`,'utf8'));
 await db.exec(readFileSync('supabase/tests/landing_owner_decisions.sql','utf8'));
 await db.exec(readFileSync('supabase/tests/landing_corrected_reassessment.sql','utf8'));
 }finally{await db.close();}
},30000);
