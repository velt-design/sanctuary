import {createHmac,randomUUID} from 'node:crypto';
import {afterEach,expect,it,vi} from 'vitest';
const seam=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('server-only',()=>({}));vi.mock('@/lib/supabaseService',()=>({getServiceSupabase:()=>seam}));
import {POST} from './route';
import {EXPERIMENT_TEMPLATE} from '../../../../lib/landingExperiment.server';
const key='synthetic-creative-route-'.repeat(3),origin='https://www.sanctuarypergolas.co.nz';
function request(options:{forged?:boolean;origin?:boolean;expired?:boolean}={}){vi.stubEnv('SANCTUARY_META_CREATIVE_EXECUTOR_ENABLED','true');vi.stubEnv('SANCTUARY_LANDING_EXPERIMENT_KEY',key);const body=JSON.stringify({version:1,command:randomUUID(),experiment:null,stage:'read',payload:{},at:Date.now()-(options.expired?31000:0)});return new Request(origin+'/api/landing-experiment/creative',{method:'POST',headers:{'Content-Type':'application/json','x-creative-signature':options.forged?'wrong':createHmac('sha256',key).update('creative-command\n'+body).digest('base64url'),...(options.origin?{origin}:{})},body});}
afterEach(()=>{vi.unstubAllEnvs();seam.rpc.mockReset();});
it.each([{forged:true},{origin:true},{expired:true}])('denies untrusted machine request before privileged access %j',async options=>{expect((await POST(request(options))).status).toBe(503);expect(seam.rpc).not.toHaveBeenCalled();});
const state=(template:string)=>({template,enabled:false,cleanupEnabled:true,stopped:false,generation:1,plan:null,objects:[],effects:[],state:'empty',measurementReady:false,activationReady:false});
it('returns authenticated exact state plus safe mismatch metadata for owned recovery',async()=>{seam.rpc.mockReturnValue({abortSignal:async()=>({data:state('f'.repeat(64)),error:null})});const response=await POST(request());expect(response.status).toBe(200);const result=await response.json();expect(result).toMatchObject({template:'f'.repeat(64),compatibility:{status:'template_mismatch',expected:'f'.repeat(64),current:EXPERIMENT_TEMPLATE}});expect(seam.rpc).toHaveBeenCalledOnce();});
it('rejects unexpected source fields instead of exposing private state on mismatch',async()=>{seam.rpc.mockReturnValue({abortSignal:async()=>({data:{...state('f'.repeat(64)),privateData:'never-return'},error:null})});const response=await POST(request());expect(response.status).toBe(503);expect(JSON.stringify(await response.json())).not.toContain('never-return');});
it('reads current bound state without any provider or write command',async()=>{seam.rpc.mockReturnValue({abortSignal:async()=>({data:state(EXPERIMENT_TEMPLATE),error:null})});const response=await POST(request());expect(response.status).toBe(200);expect(await response.json()).not.toHaveProperty('compatibility');expect(seam.rpc.mock.calls[0]?.[1]).toMatchObject({p_stage:'read',p_payload:{}});});
function historyRequest(overrides:Record<string,unknown>={}){
 request();const control={format:'image',id:'881',page:'15',imageHash:'a'.repeat(32),primary:'Approved public control.',headline:'Approved title',description:'',action:'LEARN_MORE',path:'/acrylic-roof-pergolas-auckland',urlTags:'utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&utm_term={{adset.id}}'};
 const raw={version:1,command:randomUUID(),experiment:null,stage:'history',payload:{generation:1,controlAd:'21',control,template:EXPERIMENT_TEMPLATE,...overrides},at:Date.now()},body=JSON.stringify(raw);
 return new Request(origin+'/api/landing-experiment/creative',{method:'POST',headers:{'Content-Type':'application/json','x-creative-signature':createHmac('sha256',key).update('creative-command\n'+body).digest('base64url')},body});
}
const history=()=>({version:3,generation:1,controlAd:'21',template:EXPERIMENT_TEMPLATE,previous:[],excluded:[],complete:true});
it('reads a signed exact donor history through the existing route without a provider/write stage',async()=>{
 seam.rpc.mockReturnValue({abortSignal:async()=>({data:history(),error:null})});const response=await POST(historyRequest());expect(response.status).toBe(200);expect(await response.json()).toEqual(history());
 expect(seam.rpc).toHaveBeenCalledOnce();expect(seam.rpc.mock.calls[0]?.[1]).toMatchObject({p_stage:'history',p_experiment:null,p_payload:{controlAd:'21',generation:1,template:EXPERIMENT_TEMPLATE}});
});
it.each([{template:'f'.repeat(64)},{scope:{account:'999'}},{controlAd:'not-an-id'}])('denies mismatched or expanded history requests before SQL %j',async override=>{
 expect((await POST(historyRequest(override))).status).toBe(503);expect(seam.rpc).not.toHaveBeenCalled();
});
it('never exposes unknown history fields or raw source errors',async()=>{
 for(const result of [{data:{...history(),privateData:'private-canary'},error:null},{data:null,error:{message:'private-canary'}}]){
  seam.rpc.mockReturnValue({abortSignal:async()=>result});const response=await POST(historyRequest());expect(response.status).toBe(503);expect(JSON.stringify(await response.json())).not.toContain('private-canary');
 }
});
it('preserves bounded outcome coverage and rejects contradictory or missing coverage in terminal summaries',async()=>{
 const entry={copyHash:'a'.repeat(64),hookPrefix:'Earlier approved hook.',result:'inconclusive',observedAt:new Date().toISOString(),reason:'evidence_incomplete',enquiries:[0,0],coverage:{allSaved:'unknown',unassigned:3},spend:[null,0],policy:'native-saved-enquiry-per-dollar-v1',sensitivityInterval:null,quality:'unknown_or_fails'};
 seam.rpc.mockReturnValue({abortSignal:async()=>({data:{...history(),previous:[entry]},error:null})});
 const response=await POST(historyRequest());expect(response.status).toBe(200);expect((await response.json()).previous).toEqual([entry]);
 for(const coverage of [undefined,{allSaved:'complete',unassigned:3},{allSaved:'unknown',unassigned:0},{allSaved:'unknown',unassigned:2001}]){
  seam.rpc.mockReturnValue({abortSignal:async()=>({data:{...history(),previous:[{...entry,coverage}]},error:null})});expect((await POST(historyRequest())).status).toBe(503);
 }
});
