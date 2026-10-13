import { afterEach,expect,it,vi } from 'vitest';
import { googleFixture } from '@/app/qa/marketing-performance-fixture/googleFixtures';
const mocks=vi.hoisted(()=>({staff:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/api/staffApi',()=>({requireStaffContext:mocks.staff,jsonError:(error:string,status:number)=>Response.json({error},{status}),jsonOk:(value:unknown)=>Response.json(value)}));
import { GET } from './route';
afterEach(()=>vi.clearAllMocks());
const request=()=>new Request('https://example.test/api/staff/v1/marketing-performance/google-ads');
const staff=(email='jordan@sanctuarypergolas.co.nz')=>({ok:true,session:{user:{email,email_confirmed_at:'2026-01-01'}},supabase:{rpc:mocks.rpc}});
it('requires staff and the confirmed developer before reading saved evidence',async()=>{
  mocks.staff.mockResolvedValueOnce({ok:false,response:new Response('',{status:401})});expect((await GET(request())).status).toBe(401);
  mocks.staff.mockResolvedValueOnce(staff('other@example.test'));expect((await GET(request())).status).toBe(403);expect(mocks.rpc).not.toHaveBeenCalled();
});
it('returns validated private/no-store aggregate evidence and forbids caller-selected source filters',async()=>{
  mocks.staff.mockResolvedValue(staff());mocks.rpc.mockReturnValue({abortSignal:async()=>({data:googleFixture(),error:null})});
  const response=await GET(request());expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect((await response.json()).evidence.report.customerId).toBe('1234567890');
  expect((await GET(new Request(request().url+'?customer=other'))).status).toBe(400);expect(mocks.rpc).toHaveBeenCalledOnce();
});
it('withholds malformed snapshots and database failures',async()=>{
  mocks.staff.mockResolvedValue(staff());mocks.rpc.mockReturnValue({abortSignal:async()=>({data:{report:{cost:0}},error:null})});
  expect((await GET(request())).status).toBe(503);
});
