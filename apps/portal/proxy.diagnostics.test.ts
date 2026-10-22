// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { DOCUMENT_CARRIER_HEADER, DOCUMENT_ID_HEADER, readDocumentDiagnostics } from './lib/performance/documentDiagnostics';
const h=vi.hoisted(()=>({getUser:vi.fn(),role:vi.fn(),setCookies:false}));
vi.mock('@supabase/ssr',()=>({createServerClient:(_url:unknown,_key:unknown,options:{cookies:{setAll:(cookies:unknown[])=>void}})=>({auth:{getUser:h.getUser,getSession:async()=>{if(h.setCookies)options.cookies.setAll([{name:'refreshed',value:'private-cookie',options:{httpOnly:true}}]);return h.getUser();}},from:()=>({select:()=>({eq:()=>({maybeSingle:h.role})})})})}));
import { middleware as proxy } from './middleware';
beforeEach(()=>{vi.stubEnv('PORTAL_DOCUMENT_DIAGNOSTICS',JSON.stringify({until:new Date(Date.now()+60_000).toISOString(),nonce:'A'.repeat(43)}));vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://example.supabase.co');vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','synthetic');h.getUser.mockResolvedValue({data:{user:{id:'private-user',email:'private@example.test'}},error:null});h.role.mockResolvedValue({data:{role:'staff'},error:null});h.setCookies=false;});
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();h.getUser.mockReset();h.role.mockReset();});
it.each(['authenticated','unauthenticated','throw'] as const)('preserves %s session transport behavior while correlating bounded document phases',async outcome=>{
  if(outcome==='unauthenticated')h.getUser.mockResolvedValue({data:{user:null},error:null});
  const failure=new Error('private error');if(outcome==='throw')h.getUser.mockRejectedValue(failure);
  const log=vi.spyOn(console,'info').mockImplementation(()=>undefined);
  const req=()=>new NextRequest('https://portal.example/staff/projects?name=private-customer',{headers:{'sec-fetch-dest':'document',accept:'text/html',cookie:'original=private', [DOCUMENT_CARRIER_HEADER]:'spoofed'}});
  if(outcome==='throw')await expect(proxy(req())).rejects.toBe(failure);
  else {const measured=await proxy(req());expect(measured.headers.get(DOCUMENT_ID_HEADER)).toMatch(/^[a-f0-9-]{36}$/);vi.stubEnv('PORTAL_DOCUMENT_DIAGNOSTICS','');const ordinary=await proxy(req());expect(measured.status).toBe(ordinary.status);expect(measured.headers.get('location')).toBe(ordinary.headers.get('location'));}
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/private|spoofed/);
});
it('retains refreshed response cookies and original request cookies while forwarding only the signed carrier',async()=>{
  h.setCookies=true;vi.spyOn(console,'info').mockImplementation(()=>undefined);
  const response=await proxy(new NextRequest('https://portal.example/staff/site-visits',{headers:{'sec-fetch-dest':'document',accept:'text/html',cookie:'original=private','x-other':'keep'}}));
  expect(response.headers.get('set-cookie')).toContain('refreshed=private-cookie');
  expect(response.headers.get('x-middleware-request-cookie')).toBe('original=private; refreshed=private-cookie');
  expect(response.headers.get('x-middleware-request-x-other')).toBe('keep');
  const forwarded=new Headers({'sec-fetch-dest':'document',accept:'text/html',[DOCUMENT_CARRIER_HEADER]:response.headers.get(`x-middleware-request-${DOCUMENT_CARRIER_HEADER}`)!});
  expect(readDocumentDiagnostics(forwarded)?.id).toBe(response.headers.get(DOCUMENT_ID_HEADER));
});
it('correlates Marketing transport without moving identity or role checks into the proxy',async()=>{
  h.setCookies=true;const log=vi.spyOn(console,'info').mockImplementation(()=>undefined);
  const response=await proxy(new NextRequest('https://portal.example/staff/marketing-performance?start=private',{headers:{'sec-fetch-dest':'document',accept:'text/html',cookie:'original=private',[DOCUMENT_CARRIER_HEADER]:'forged'}}));
  expect(h.getUser).toHaveBeenCalledOnce();expect(h.role).not.toHaveBeenCalled();
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('set-cookie')).toContain('refreshed=private-cookie');
  const forwarded=new Headers({'sec-fetch-dest':'document',accept:'text/html',[DOCUMENT_CARRIER_HEADER]:response.headers.get(`x-middleware-request-${DOCUMENT_CARRIER_HEADER}`)!});
  expect(readDocumentDiagnostics(forwarded)?.id).toBe(response.headers.get(DOCUMENT_ID_HEADER));
  expect(log.mock.calls.map(call=>call[1].phase)).toEqual(['proxy.complete']);
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/private|forged/);
});
it('strips a replayed Marketing carrier on direct RSC entry without emitting diagnostic headers',async()=>{
  const log=vi.spyOn(console,'info').mockImplementation(()=>undefined);
  const response=await proxy(new NextRequest('https://portal.example/staff/marketing-performance',{headers:{'sec-fetch-dest':'document',accept:'text/html',rsc:'1',[DOCUMENT_CARRIER_HEADER]:'forged',[DOCUMENT_ID_HEADER]:'forged'}}));
  expect(response.headers.has(DOCUMENT_ID_HEADER)).toBe(false);
  expect(response.headers.has(`x-middleware-request-${DOCUMENT_CARRIER_HEADER}`)).toBe(false);
  expect(log).not.toHaveBeenCalled();
});
