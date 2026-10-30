import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {loadStudioAuthoringRequest} from './authoringRequest.server';
import {STUDIO_OPENING_TYPE} from './studioOpening';
const mocks=vi.hoisted(()=>({client:vi.fn(),user:vi.fn(),session:vi.fn(),role:vi.fn(),business:vi.fn()}));
vi.mock('@/lib/supabase/serverClient',()=>({getSupabaseServerAuth:mocks.client}));
vi.mock('@/lib/supabaseClient',()=>({supabaseServiceRole:new Proxy({},{get(){throw Error('No privileged fallback');}})}));
const ids={projectId:'proj_10000000-0000-4000-8000-000000000001',estimateId:'est_20000000-0000-4000-8000-000000000001'};
const client={auth:{getUser:mocks.user,getSession:mocks.session},from:(table:string)=>{
 if(table!=='portal_users'){mocks.business(table);throw Error('Business read before admission');}
 return{select:()=>({eq:()=>({maybeSingle:mocks.role})})};
}};
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('ENABLE_PORTAL_DESIGN_STUDIO','1');mocks.client.mockResolvedValue(client);mocks.session.mockResolvedValue({data:{session:{access_token:'header.'+btoa(JSON.stringify({sub:'fresh-actor'}))+'.signature'}}});mocks.user.mockResolvedValue({data:{user:{id:'fresh-actor',email:'never-serialize@example.invalid'}}});mocks.role.mockResolvedValue({data:null,error:null});});
afterEach(()=>vi.unstubAllEnvs());
const opening=()=>loadStudioAuthoringRequest(new Request('http://localhost/studio',{headers:{accept:STUDIO_OPENING_TYPE}}),ids);
it.each(['unauthenticated','no_access','lookup_failed'] as const)('retains fresh %s denial before target/quote/publication/theme or DTO',async kind=>{
 if(kind==='unauthenticated')mocks.user.mockResolvedValue({data:{user:null},error:{message:'revoked'}});
 if(kind==='lookup_failed')mocks.role.mockResolvedValue({data:null,error:{message:'role lookup unavailable'}});
 const response=await opening();expect(response.status).toBe(401);expect(response.headers.get('x-studio-access-state')).toBe(kind);expect(mocks.user).toHaveBeenCalledOnce();expect(mocks.business).not.toHaveBeenCalled();
 expect(await response.text()).not.toContain('never-serialize');
});
it('waits for current database role, and does not reuse a prior denial for the next request',async()=>{
 let resolve!:(value:unknown)=>void;mocks.role.mockReturnValueOnce(new Promise(done=>{resolve=done;}));const pending=opening();
 for(let i=0;i<16;i++)await Promise.resolve();expect(mocks.business).not.toHaveBeenCalled();resolve({data:null,error:null});await pending;
 await opening();expect(mocks.user).toHaveBeenCalledTimes(2);expect(mocks.role).toHaveBeenCalledTimes(2);expect(mocks.business).not.toHaveBeenCalled();
});
it('joins fresh user and own-RLS role before any business read even when the speculative role succeeds first',async()=>{
 let release!:(value:unknown)=>void;mocks.user.mockReturnValueOnce(new Promise(done=>{release=done;}));mocks.role.mockResolvedValue({data:{role:'staff'},error:null});let settled=false;const pending=opening().then(response=>{settled=true;return response;});for(let i=0;i<20;i++)await Promise.resolve();expect(mocks.role).toHaveBeenCalledOnce();expect(mocks.business).not.toHaveBeenCalled();expect(settled).toBe(false);release({data:{user:null},error:{message:'revoked'}});expect((await pending).status).toBe(401);expect(mocks.business).not.toHaveBeenCalled();
});
it('keeps ordinary JSON denial on the default user-first path without a hint or speculative role read',async()=>{
 mocks.user.mockResolvedValue({data:{user:null},error:{message:'revoked'}});const response=await loadStudioAuthoringRequest(new Request('http://localhost/studio'),ids);expect(response.status).toBe(401);expect(mocks.session).not.toHaveBeenCalled();expect(mocks.role).not.toHaveBeenCalled();expect(mocks.business).not.toHaveBeenCalled();
});
