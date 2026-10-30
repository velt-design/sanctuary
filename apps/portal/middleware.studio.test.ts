// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { STUDIO_EDIT_CALLBACK_HEADER } from './lib/designStudio/studioEditRoute';
const h=vi.hoisted(()=>({session:vi.fn(),user:vi.fn(),role:vi.fn(),cookies:[] as any[]}));
vi.mock('@supabase/ssr',()=>({createServerClient:(_url:string,_key:string,options:any)=>({
 auth:{getSession:async()=>{options.cookies.setAll(h.cookies);return h.session();},getUser:h.user},
 from:()=>({select:()=>({eq:()=>({maybeSingle:h.role})})}),
})}));
import { middleware } from './middleware';
const path='/staff/design-studio/proj_10000000-0000-4000-8000-000000000001/est_20000000-0000-4000-8000-000000000001';
beforeEach(()=>{
 vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://example.supabase.co');vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','synthetic');vi.stubEnv('PORTAL_DOCUMENT_DIAGNOSTICS','');vi.stubEnv('ENABLE_PORTAL_DESIGN_STUDIO','1');
 h.session.mockResolvedValue({data:{session:{user:{role:'untrusted'}}},error:null});h.user.mockResolvedValue({data:{user:null},error:null});h.role.mockResolvedValue({data:null,error:null});h.cookies=[];
});
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
it.each(['','?quoteVersionId=qv_30000000-0000-4000-8000-000000000001','/edit','/edit?intent=duplicate&name=Courtyard'])('forwards only canonical Studio routing %s with refreshed transport and no role authority',async suffix=>{
 const callback=path+suffix;
 h.cookies=[{name:'session.0',value:'',options:{maxAge:0,path:'/'}},{name:'session',value:'rotated',options:{httpOnly:true,path:'/'}}];
 const response=await middleware(new NextRequest('https://portal.example'+callback+(suffix.includes('?')?'&':'?')+'_rsc=transport',{headers:{rsc:'1',cookie:'session.0=old; unrelated=keep',[STUDIO_EDIT_CALLBACK_HEADER]:'/admin'}}));
 expect(h.session).toHaveBeenCalledOnce();expect(h.user).not.toHaveBeenCalled();expect(h.role).not.toHaveBeenCalled();
 expect(response.headers.get('x-middleware-request-'+STUDIO_EDIT_CALLBACK_HEADER)).toBe(callback);
 expect(response.headers.get('x-middleware-request-cookie')).toContain('session=rotated');expect(response.headers.get('x-middleware-request-cookie')).toContain('unrelated=keep');expect(response.headers.get('x-middleware-request-cookie')).not.toContain('session.0');
 expect(response.cookies.get('session.0')?.maxAge).toBe(0);expect(response.headers.get('cache-control')).toBe('private, no-store');
});
it.each(['/staff/projects','/staff/design-studio/invalid','/api/quotes/example',path+'/edit?unknown=x',path+'/edit?intent=edit&intent=duplicate'])('strips caller hints outside exact Studio route %s',async route=>{
 const response=await middleware(new NextRequest('https://portal.example'+route,{headers:{[STUDIO_EDIT_CALLBACK_HEADER]:path+'/edit'}}));
 expect(response.headers.get('x-middleware-request-'+STUDIO_EDIT_CALLBACK_HEADER)).toBeNull();expect(h.session).not.toHaveBeenCalled();
});
it('retains ordinary fresh authority with the feature off and refuses failed/missing Studio session transport',async()=>{
 vi.stubEnv('ENABLE_PORTAL_DESIGN_STUDIO','');
 expect((await middleware(new NextRequest('https://portal.example'+path+'/edit'))).status).toBe(307);expect(h.user).toHaveBeenCalledOnce();expect(h.session).not.toHaveBeenCalled();
 vi.stubEnv('ENABLE_PORTAL_DESIGN_STUDIO','1');h.session.mockResolvedValue({data:{session:null},error:null});
 const missing=await middleware(new NextRequest('https://portal.example'+path+'/edit'));expect(missing.status).toBe(307);expect(missing.headers.get('location')).toContain('/login?');
 h.session.mockRejectedValue(new Error('refresh failed'));expect((await middleware(new NextRequest('https://portal.example'+path+'/edit'))).status).toBe(307);
});
