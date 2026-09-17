import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ context:vi.fn(),rpc:vi.fn() }));
vi.mock('@/lib/api/staffApi', () => ({ requireStaffContext:mocks.context,jsonError:(error:string,status=400)=>Response.json({error},{status}),jsonOk:(body:unknown)=>Response.json(body) }));
import { GET,POST } from '@/app/api/staff/projects/[projectId]/enquiries/[enquiryId]/qualification/route';
const projectId='11111111-1111-4111-8111-111111111111',enquiryId='22222222-2222-4222-8222-222222222222';
const context={params:Promise.resolve({projectId,enquiryId})};
const criteria={location:true,project:true,contactAndConfiguration:true,intent:true};
const body={commandId:projectId,expectedVersion:0,state:'qualified',criteria,reason:''};
const view={projectId,enquiryId,eligible:true,history:[],current:{version:1,state:'qualified',criteria,reason:'',actorId:projectId,actorEmail:'staff@example.test',recordedAt:'2026-09-17T00:00:00Z',criteriaVersion:'configured-enquiry-v1'}};
const request=(value:unknown=body,origin='https://portal.test')=>new Request('https://portal.test/api/staff/projects/x/enquiries/y/qualification',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(value)});
beforeEach(()=>{vi.resetAllMocks();mocks.context.mockResolvedValue({ok:true,supabase:{rpc:mocks.rpc}});mocks.rpc.mockResolvedValue({data:view,error:null});});
it('denies unauthenticated and cross-origin writes before RPC',async()=>{
  mocks.context.mockResolvedValueOnce({ok:false,response:Response.json({error:'Unauthorized'},{status:401})});
  expect((await POST(request(),context)).status).toBe(401);
  expect((await POST(request(body,'https://other.test'),context)).status).toBe(403);
  expect((await POST(request(body,''),context)).status).toBe(403);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it.each([{...body,actorId:enquiryId},{...body,criteria:{...criteria,intent:null}},{...body,expectedVersion:-1},{...body,state:'not_qualified'},{...body,reason:'x'.repeat(5000)}])('rejects invalid/untrusted command before RPC',async value=>{
  expect([400,413]).toContain((await POST(request(value),context)).status);expect(mocks.rpc).not.toHaveBeenCalled();
});
it('sends only the scoped command, verifies response identity and prevents caching',async()=>{
  const result=await POST(request(),{params:Promise.resolve({projectId:`proj_${projectId}`,enquiryId})});expect(result.status).toBe(200);expect(result.headers.get('cache-control')).toBe('private, no-store');
  expect(mocks.rpc).toHaveBeenCalledWith('enquiry_qualification_record',{p_project_id:projectId,p_enquiry_id:enquiryId,p_command_id:projectId,p_expected_version:0,p_state:'qualified',p_criteria:criteria,p_reason:''});
  mocks.rpc.mockResolvedValueOnce({data:{...view,enquiryId:projectId},error:null});
  expect((await GET(request(),context)).status).toBe(503);
});
it.each([['42501',403],['PT404',404],['PT409',409],['23505',409],['XX000',503]])('redacts database errors %s',async(code,status)=>{
  mocks.rpc.mockResolvedValueOnce({data:null,error:{code,message:'private customer/database details'}});
  const response=await POST(request(),context);expect(response.status).toBe(status);expect(await response.text()).not.toContain('private customer');
});
