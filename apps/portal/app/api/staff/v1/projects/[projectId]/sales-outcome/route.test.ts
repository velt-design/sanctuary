// @vitest-environment node
import { beforeEach,it,expect,vi } from 'vitest';
const mocks=vi.hoisted(()=>({auth:vi.fn(),rpc:vi.fn(),sameOrigin:vi.fn()}));
vi.mock('@/lib/api/staffApi',()=>({requireStaffContext:mocks.auth,jsonOk:(v:unknown)=>Response.json(v),jsonError:(error:string,status:number)=>Response.json({error},{status})}));
vi.mock('@/lib/siteVisits/http',()=>({calendarSameOrigin:mocks.sameOrigin}));
import {GET,PUT} from './route';
const projectId='77777777-7777-4777-8777-777777777777',commandId='88888888-8888-4888-8888-888888888888';
const context={params:Promise.resolve({projectId})},command={commandId,expectedRevision:0,outcome:'refunded',basis:'Confirmed owner instruction'};
const value={projectId,outcome:'refunded',revision:1,updatedAt:'2026-10-21T00:00:00Z',basis:command.basis};
const request=(body:unknown=command)=>new Request(`https://portal.example.test/api/staff/v1/projects/${projectId}/sales-outcome`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
beforeEach(()=>{vi.resetAllMocks();mocks.auth.mockResolvedValue({ok:true,session:{user:{email:'jordan@sanctuarypergolas.co.nz',email_confirmed_at:'2026-01-01'}},supabase:{rpc:mocks.rpc}});mocks.sameOrigin.mockReturnValue(true);mocks.rpc.mockResolvedValue({data:value,error:null});});
it('passes only validated assignment fields to the guarded command and returns private verified state',async()=>{
 const response=await PUT(request(),context);expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('private, no-store');expect(await response.json()).toEqual({outcome:value});
 expect(mocks.rpc).toHaveBeenCalledWith('project_sales_outcome_record',{p_project:projectId,p_command:commandId,p_expected_revision:0,p_outcome:'refunded',p_basis:command.basis});
});
it('requires owner, same origin and a strict bounded body before any write',async()=>{
 for(const body of [{...command,actor:'admin'},{...command,outcome:'unknown'},{...command,expectedRevision:-1},{...command,basis:'a'.repeat(4000)}])expect((await PUT(request(body),context)).status).toBeGreaterThanOrEqual(400);
 mocks.sameOrigin.mockReturnValue(false);expect((await PUT(request(),context)).status).toBe(403);
 mocks.auth.mockResolvedValue({ok:true,session:{user:{email:'other@example.test',email_confirmed_at:'2026-01-01'}},supabase:{rpc:mocks.rpc}});expect((await PUT(request(),context)).status).toBe(403);expect(mocks.rpc).not.toHaveBeenCalled();
});
it('returns only scoped current state and fails closed on absent or cross-project evidence',async()=>{
 expect((await GET(new Request('https://portal.example.test'),context)).status).toBe(200);expect(mocks.rpc).toHaveBeenCalledWith('project_sales_outcome_read',{p_project:projectId});
 for(const data of [null,{...value,projectId:commandId}]){mocks.rpc.mockResolvedValue({data,error:null});expect((await GET(new Request('https://portal.example.test'),context)).status).toBe(503);}
});
it('makes stale commands, denial and uncertain persistence distinguishable without raw database text',async()=>{
 for(const [code,status] of [['40001',409],['42501',403],['P0002',404],['57014',503]]){
  mocks.rpc.mockResolvedValue({error:{code,message:'private SQL payload'}});const r=await PUT(request(),context);expect(r.status).toBe(status);expect(await r.text()).not.toContain('private SQL');
 }
 mocks.auth.mockResolvedValue({ok:false,response:Response.json({error:'Unauthorized'},{status:401})});expect((await PUT(request(),context)).status).toBe(401);
});
