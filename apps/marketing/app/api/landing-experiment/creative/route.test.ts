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
it('returns only safe compatibility metadata after authenticated read',async()=>{seam.rpc.mockReturnValue({abortSignal:async()=>({data:{template:'f'.repeat(64),privateData:'never-return'},error:null})});const response=await POST(request());expect(response.status).toBe(503);const result=await response.json();expect(JSON.stringify(result)).toContain(EXPERIMENT_TEMPLATE);expect(JSON.stringify(result)).not.toContain('never-return');expect(seam.rpc).toHaveBeenCalledOnce();});
it('reads current bound state without any provider or write command',async()=>{seam.rpc.mockReturnValue({abortSignal:async()=>({data:{template:EXPERIMENT_TEMPLATE,enabled:false},error:null})});expect((await POST(request())).status).toBe(200);expect(seam.rpc.mock.calls[0]?.[1]).toMatchObject({p_stage:'read',p_payload:{}});});
