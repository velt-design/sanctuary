// @vitest-environment node
import {createHmac} from 'node:crypto';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const db=vi.hoisted(()=>({rpc:vi.fn(),signals:[] as AbortSignal[]}));
vi.mock('@/lib/supabaseService',()=>({getServiceSupabase:()=>db}));
import {POST,maxDuration} from './route';
import {POST as commandPost} from './command/route';
import {EXPERIMENT_TEMPLATE,signAssignment} from '../../../lib/landingExperiment.server';
const path='/auckland-outdoor-living',key='fixture-key-'.repeat(4),origin='https://fixture.example.test';
function request(body:unknown,headers:Record<string,string>={Origin:origin}){return new Request(origin+'/api/landing-experiment',{method:'POST',headers,body:JSON.stringify(body)});}
const input={stage:'assign',path,consent:true,utm:{utm_source:'facebook',utm_medium:'paid_social',utm_campaign:'11001',utm_content:'11003',utm_term:'11002'}};
beforeEach(()=>{vi.clearAllMocks();db.signals=[];vi.stubEnv('SANCTUARY_LANDING_EXPERIMENT_ENABLED','true');vi.stubEnv('SANCTUARY_LANDING_EXPERIMENT_KEY',key);db.rpc.mockImplementation(name=>({abortSignal:(signal:AbortSignal)=>{db.signals.push(signal);return Promise.resolve({data:name==='marketing_public_rate_limit_take'?[{allowed:true}]:{control:{}},error:null});}}));});
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
it('keeps machine HMAC commands separate from same-origin visitors and rejects invalid authority before database access',async()=>{
 expect((await commandPost(request({}))).status).toBe(503);
 expect((await commandPost(request({},{}))).status).toBe(503);
 expect((await POST(request(input,{Origin:'https://other.example.test'}))).status).toBe(403);
 expect(db.rpc).not.toHaveBeenCalled();
 const body={version:1,command:'a1000000-0000-4000-8000-000000000001',experiment:null,stage:'read',payload:{},at:Date.now()};
 const signature=createHmac('sha256',key).update('command\n'+JSON.stringify(body)).digest('base64url');
 db.rpc.mockReturnValue({abortSignal:()=>Promise.resolve({data:{template:EXPERIMENT_TEMPLATE,controls:{'/auckland-outdoor-living':{},'/acrylic-roof-pergolas-auckland':{}}},error:null})});
 expect((await commandPost(request(body,{'x-landing-signature':signature}))).status).toBe(200);
 expect((await commandPost(request({...body,stage:'publish'},{'x-landing-signature':signature}))).status).toBe(503);
});
it('shares one finite deadline and compiled template across public admission, while denying caller-selected arms or missing consent',async()=>{
 const timeout=vi.spyOn(AbortSignal,'timeout');
 const response=await POST(request(input));expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('private, no-store');
 expect(db.signals).toHaveLength(2);expect(db.signals[0]).toBe(db.signals[1]);expect(timeout).toHaveBeenCalledWith(1500);expect(maxDuration).toBe(5);
 expect(db.rpc.mock.calls[1]![1]).toMatchObject({p_template:EXPERIMENT_TEMPLATE,p_campaign:'11001',p_adset:'11002',p_ad:'11003'});
 db.rpc.mockClear();expect((await POST(request({...input,arm:'challenger'}))).status).toBe(503);expect(db.rpc).not.toHaveBeenCalled();
 expect((await POST(request({...input,consent:false}))).status).toBe(503);expect(db.rpc.mock.calls.every(call=>call[0]==='marketing_public_rate_limit_take')).toBe(true);
});
it('supports signed withdrawal when enrolment is disabled and withholds exposure without the exact route receipt',async()=>{
 const receipt=signAssignment({path,assignment:'a2000000-0000-4000-8000-000000000001',experiment:'a1000000-0000-4000-8000-000000000001'});
 expect((await POST(request({stage:'expose',path,consent:true,receipt:receipt+'x'}))).status).toBe(503);
 vi.stubEnv('SANCTUARY_LANDING_EXPERIMENT_ENABLED','false');db.rpc.mockClear();
 expect((await POST(request(input))).status).toBe(200);expect(db.rpc).not.toHaveBeenCalled();
 const response=await POST(request({stage:'revoke',path,consent:false,receipt}));expect(response.status).toBe(200);expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
 expect(db.rpc.mock.calls.at(-1)![1]).toMatchObject({p_stage:'revoke',p_id:'a2000000-0000-4000-8000-000000000001'});
});
