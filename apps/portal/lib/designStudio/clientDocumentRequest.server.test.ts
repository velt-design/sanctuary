import {beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({auth:vi.fn(),rpc:vi.fn(),visible:true}));
vi.mock('@/lib/api/staffApi',()=>({requireStaffContext:mocks.auth,jsonOk:(v:unknown)=>Response.json(v),jsonError:(error:string,status:number)=>Response.json({error},{status})}));
vi.mock('@/lib/supabaseClient',()=>({getSupabaseServiceRole:()=>({rpc:mocks.rpc})}));
import {studioClientDocumentRequest} from './clientDocumentRequest.server';
const id='qv_10000000-0000-4000-8000-000000000002';
beforeEach(()=>{vi.resetAllMocks();process.env.ENABLE_PORTAL_DESIGN_STUDIO='1';mocks.visible=true;const chain:any={select:()=>chain,eq:()=>chain,abortSignal:()=>chain,maybeSingle:async()=>({error:null,data:mocks.visible?{id:id.slice(3)}:null})};mocks.auth.mockResolvedValue({ok:true,session:{role:'staff',user:{id:'10000000-0000-4000-8000-000000000003'}},supabase:{from:()=>chain}});mocks.rpc.mockResolvedValue({data:{snapshotId:'snapshot',state:'running',completedPages:2,totalPages:5,percent:33},error:null});});
it('proves caller visibility before privileged reads and keeps ordinary status reads mutation-free',async()=>{
 mocks.visible=false;expect((await studioClientDocumentRequest(new Request('http://localhost/document'),id)).status).toBe(404);expect(mocks.rpc).not.toHaveBeenCalled();
 mocks.visible=true;expect((await studioClientDocumentRequest(new Request('http://localhost/document'),id)).status).toBe(200);expect(mocks.rpc).toHaveBeenCalledOnce();expect(mocks.rpc.mock.calls[0][0]).toBe('studio_client_document_status');expect(mocks.rpc.mock.calls[0][1]).toMatchObject({p_quote_version_id:id.slice(3),p_download:false});
});
it('rejects cross-origin or invalid snapshot retries before privileged mutation',async()=>{
 expect((await studioClientDocumentRequest(new Request('http://localhost/document',{method:'POST',headers:{origin:'https://other.example'},body:'{}'}),id)).status).toBe(403);
 expect((await studioClientDocumentRequest(new Request('http://localhost/document',{method:'POST',body:JSON.stringify({snapshotId:'wrong'})}),id)).status).toBe(400);expect(mocks.rpc).not.toHaveBeenCalled();
});
it('returns the verified financial-only state without pretending an empty booklet is still preparing',async()=>{
 mocks.rpc.mockResolvedValue({error:null,data:{snapshotId:'snapshot',state:'unavailable',completedPages:0,totalPages:0,percent:0,canRetry:false}});
 const response=await studioClientDocumentRequest(new Request('http://localhost/document'),id);
 expect(response.status).toBe(200);expect((await response.json()).document.state).toBe('unavailable');
 const download=await studioClientDocumentRequest(new Request('http://localhost/document?download=1'),id);
 expect(download.status).toBe(409);expect(await download.json()).toEqual({error:'This quote has no pergola drawings.'});
});
