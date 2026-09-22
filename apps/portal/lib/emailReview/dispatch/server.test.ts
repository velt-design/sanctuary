// @vitest-environment node
import { afterEach,beforeEach,describe,it,expect,vi } from 'vitest';
const mocks=vi.hoisted(()=>({rpc:vi.fn(),admin:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/api/adminApi',()=>({requireAdminContext:mocks.admin}));
import { dispatchRequest } from './server';
import { parseDispatchResult } from './validation';
const id='00000000-0000-4000-8000-000000000001';
const req=(data:unknown,origin='https://portal.example.invalid')=>new Request('https://portal.example.invalid/api/dispatch',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(data)});
afterEach(()=>vi.unstubAllEnvs());
beforeEach(()=>{vi.stubEnv('EMAIL_REVIEW_ORIGIN','https://portal.example.invalid');vi.clearAllMocks();mocks.admin.mockResolvedValue({ok:true,supabase:{rpc:mocks.rpc}});mocks.rpc.mockResolvedValue({data:{replayed:false,replies:[]},error:null});});
describe('Outlook dispatch boundary',()=>{
 it('rejects cross-origin and non-admin before accessing dispatches',async()=>{expect((await dispatchRequest(req({},'https://evil.invalid'),id,'claim')).status).toBe(403);expect(mocks.admin).not.toHaveBeenCalled();mocks.admin.mockResolvedValue({ok:false,response:new Response(null,{status:403})});expect((await dispatchRequest(req({}),id,'read')).status).toBe(403);expect(mocks.rpc).not.toHaveBeenCalled();});
 it('claims only a bounded batch through the authenticated RPC with no implicit retry',async()=>{const response=await dispatchRequest(req({commandId:id,limit:10}),id,'claim');expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('private, no-store');expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('email_review_dispatch',{p_batch_id:id,p_action:'claim',p_input:{commandId:id,limit:10}});});
 it.each([0,11,1.5])('rejects claim limit %s',async limit=>{expect((await dispatchRequest(req({commandId:id,limit}),id,'claim')).status).toBe(400);expect(mocks.rpc).not.toHaveBeenCalled();});
 it('holds ambiguous transport results and never retries the RPC',async()=>{mocks.rpc.mockRejectedValue(Error('private body'));const response=await dispatchRequest(req({commandId:id,limit:1}),id,'claim');expect(response.status).toBe(503);expect(await response.text()).not.toContain('private body');expect(mocks.rpc).toHaveBeenCalledTimes(1);});
 it('requires a real Outlook evidence location for a sent result',()=>{const value={intentId:id,attemptId:id,outcome:'sent',outlookMessageId:'outbound',outlookWebLink:'https://outlook.office.com/mail/id/outbound'};expect(parseDispatchResult(value)).toEqual(value);for(const link of ['https://evil.invalid','https://outlook.office.com.evil.invalid/mail','https://user:pass@outlook.office.com/mail','javascript:alert(1)'])expect(()=>parseDispatchResult({...value,outlookWebLink:link})).toThrow();expect(()=>parseDispatchResult({...value,outlookMessageId:''})).toThrow();});
 it('cannot label uncertainty as sent or add hidden recipients',()=>{expect(()=>parseDispatchResult({intentId:id,attemptId:id,outcome:'uncertain',outlookMessageId:'invented'})).toThrow();expect(()=>parseDispatchResult({intentId:id,attemptId:id,outcome:'uncertain',cc:['other@example.invalid']})).toThrow();});
});
