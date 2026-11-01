import { beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({auth:vi.fn(),load:vi.fn()}));
vi.mock('@/lib/api/staffApi',()=>({requireStaffContext:mocks.auth,jsonOk:(v:unknown)=>Response.json(v),jsonError:(error:string,status:number)=>Response.json({error},{status})}));
vi.mock('@/lib/queries/studioProject.server',()=>({loadStudioProject:mocks.load}));
import {GET} from './route';
const uuid='10000000-0000-4000-8000-000000000001',projectId=`proj_${uuid}`,client={from:vi.fn()};
const read=()=>GET(new Request('http://localhost/api/project/studio'),{params:Promise.resolve({projectId})});
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('ENABLE_PORTAL_DESIGN_STUDIO','1');mocks.auth.mockResolvedValue({ok:true,session:{role:'staff',user:{id:'actor'}},supabase:client});mocks.load.mockResolvedValue({project:{id:uuid,name:'Synthetic'},designs:[],loadError:false});});
it('reads only through the authenticated project loader and returns no creation effect',async()=>{
 const response=await read();expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('private, no-store');expect(await response.json()).toMatchObject({projectId,designs:[],loadError:false});expect(mocks.load).toHaveBeenCalledExactlyOnceWith(client,uuid);expect(client.from).not.toHaveBeenCalled();
});
it('fails closed when disabled before session or project reads',async()=>{vi.stubEnv('ENABLE_PORTAL_DESIGN_STUDIO','0');expect((await read()).status).toBe(404);expect(mocks.auth).not.toHaveBeenCalled();expect(mocks.load).not.toHaveBeenCalled();});
it.each(['installer','viewer'])('refuses %s before private project reads',async role=>{mocks.auth.mockResolvedValue({ok:true,session:{role},supabase:client});expect((await read()).status).toBe(403);expect(mocks.load).not.toHaveBeenCalled();});
it('preserves missing-session denial before private project reads',async()=>{mocks.auth.mockResolvedValue({ok:false,response:Response.json({error:'Unauthorized'},{status:401})});expect((await read()).status).toBe(401);expect(mocks.load).not.toHaveBeenCalled();});
it('never presents missing/inaccessible projects or failed history as an empty successful inventory',async()=>{mocks.load.mockResolvedValueOnce(null);const missing=await read();expect(missing.status).toBe(404);expect(missing.headers.get('Cache-Control')).toBe('private, no-store');mocks.load.mockResolvedValueOnce({project:{id:uuid,name:'Synthetic'},designs:[],loadError:true});const failed=await read();expect(failed.status).toBe(503);expect(failed.headers.get('Cache-Control')).toBe('private, no-store');mocks.load.mockRejectedValueOnce(Error('read failed'));expect((await read()).status).toBe(503);});
