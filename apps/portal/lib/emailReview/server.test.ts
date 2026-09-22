// @vitest-environment node
import { beforeEach,describe,it,expect,vi } from 'vitest';
const mocks=vi.hoisted(()=>({rpc:vi.fn(),staff:vi.fn(),admin:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/api/staffApi',()=>({requireStaffContext:mocks.staff}));
vi.mock('@/lib/api/adminApi',()=>({requireAdminContext:mocks.admin}));
import { readReview,mutateReview,reviewBody,readReviewers } from './server';
import { GET as getBatches } from '../../app/api/staff/v1/email-review/route';
const id='00000000-0000-4000-8000-000000000001';
const target={batchId:id,itemId:id};
const request=(body:unknown,origin='https://portal.example.invalid')=>new Request('https://portal.example.invalid/api/review',{method:'PATCH',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();const auth={ok:true,supabase:{rpc:mocks.rpc},session:{role:'staff'}};mocks.staff.mockResolvedValue(auth);mocks.admin.mockResolvedValue(auth);mocks.rpc.mockResolvedValue({data:{item:{id}},error:null});});
describe('email review API boundary',()=>{
 it('uses authenticated RPC only and preserves private cache policy',async()=>{const r=await getBatches(new Request('https://portal.example.invalid/api/review'));expect(r.status).toBe(200);expect(r.headers.get('cache-control')).toBe('private, no-store');expect(mocks.rpc).toHaveBeenCalledWith('email_review_read',expect.objectContaining({p_batch_id:null,p_item_id:null}));});
 it('denies anonymous access before RPC',async()=>{mocks.staff.mockResolvedValue({ok:false,response:new Response(null,{status:401})});expect((await readReview(new Request('https://portal.example.invalid'))).status).toBe(401);expect(mocks.rpc).not.toHaveBeenCalled();});
 it('rejects missing/cross-origin mutations before auth or database',async()=>{expect((await mutateReview(request({},'https://evil.invalid'),target)).status).toBe(403);expect(mocks.staff).not.toHaveBeenCalled();expect(mocks.rpc).not.toHaveBeenCalled();});
 it('validates and passes stable command ID without send effects',async()=>{const c={commandId:id,expectedRevision:1,action:'skip',note:'Review later'};expect((await mutateReview(request(c),target)).status).toBe(200);expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('email_review_command',{p_batch_id:id,p_item_id:id,p_input:c});});
 it('maps conflicts safely without returning private database error details',async()=>{mocks.rpc.mockResolvedValue({error:{code:'PT409',message:'private email body secret'},data:null});const r=await mutateReview(request({commandId:id,expectedRevision:1,action:'skip',note:'Review later'}),target);expect(r.status).toBe(409);expect(await r.text()).not.toContain('secret');expect(mocks.rpc).toHaveBeenCalledTimes(1);});
 it('fails closed on database unavailability without implicit retries',async()=>{mocks.rpc.mockRejectedValue(Error('private token'));const r=await readReview(new Request('https://portal.example.invalid'));expect(r.status).toBe(503);expect(await r.text()).not.toContain('token');expect(mocks.rpc).toHaveBeenCalledTimes(1);});
 it('uses admin context for import and reviewer directory',async()=>{mocks.admin.mockResolvedValue({ok:false,response:new Response(null,{status:403})});expect((await mutateReview(request({}))).status).toBe(403);expect((await readReviewers()).status).toBe(403);expect(mocks.rpc).not.toHaveBeenCalled();});
 it('bounds streamed body even without a Content-Length and rejects invalid JSON',async()=>{await expect(reviewBody(request({value:'x'.repeat(100)}),30)).rejects.toThrow();await expect(reviewBody(new Request('https://portal.example.invalid',{method:'POST',headers:{'content-type':'application/json'},body:'{'}),30)).rejects.toThrow();});
 it('rejects invalid pagination, UUID, forged approval and unknown fields before RPC',async()=>{expect((await readReview(new Request('https://portal.example.invalid?page=1.5'))).status).toBe(400);expect((await mutateReview(request({commandId:id,expectedRevision:1,action:'approve',prerequisitesConfirmed:true}),target)).status).toBe(400);expect((await readReview(new Request('https://portal.example.invalid'),{batchId:'bad'})).status).toBe(400);expect(mocks.rpc).not.toHaveBeenCalled();});
});
