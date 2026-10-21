// @vitest-environment node
import { afterEach,beforeEach,describe,it,expect,vi } from 'vitest';
const h=vi.hoisted(()=>({auth:vi.fn(),rpc:vi.fn(),sync:vi.fn()}));
vi.mock('@/lib/api/staffApi',()=>({requireStaffContext:h.auth}));
vi.mock('@/lib/siteVisits/syncCalendar',()=>({syncOutlookCalendar:h.sync}));
import {GET as read} from './route';
import {GET as search} from './projects/route';
import {POST as review} from './review/route';
import {POST as refresh} from './refresh/route';
import {GET as cron} from '../../../integrations/outlook-calendar/route';
const origin='https://portal.example.invalid';const id='00000000-0000-4000-8000-000000000001';
const request=(path:string,body?:unknown,headers:Record<string,string>={})=>new Request(`${origin}${path}`,{method:body!==undefined?'POST':'GET',headers:{origin,'content-type':'application/json',...headers},body:body!==undefined?JSON.stringify(body):undefined});
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('SANCTUARY_OUTLOOK_PORTAL_ORIGIN',origin);vi.stubEnv('SANCTUARY_OUTLOOK_ENABLED','false');vi.stubEnv('CRON_SECRET','synthetic-secret'.repeat(3));h.auth.mockResolvedValue({ok:true,supabase:{rpc:h.rpc}});h.rpc.mockResolvedValue({data:{enabled:true,events:[]},error:null});h.sync.mockResolvedValue({updated:true});});
afterEach(()=>vi.unstubAllEnvs());
describe('Outlook staff API boundaries',()=>{
 it('requires staff and current database authority; sends private noncacheable responses',async()=>{
   h.auth.mockResolvedValueOnce({ok:false});expect((await read(request('/api/staff/v1/outlook-site-visits'))).status).toBe(401);expect(h.rpc).not.toHaveBeenCalled();
   h.rpc.mockResolvedValueOnce({error:{code:'42501',message:'private detail'}});expect((await read(request('/api/staff/v1/outlook-site-visits'))).status).toBe(403);
   const result=await read(request(`/api/staff/v1/outlook-site-visits?project=proj_${id}`));expect(result.status).toBe(200);expect(result.headers.get('cache-control')).toBe('private, no-store');expect(h.rpc).toHaveBeenLastCalledWith('outlook_site_visits_read',{p_project:id});
   expect(await result.json()).toEqual({enabled:false,events:[]});
 });
 it('rejects unknown/repeated queries and bounds project searches',async()=>{
   for(const suffix of ['?email=secret','?project=','?project=x','?project='+id+'&project='+id])expect((await read(request('/visits'+suffix))).status).toBe(400);
   expect((await search(request('/projects?q=a'))).status).toBe(400);expect((await search(request('/projects?q=example&extra=true'))).status).toBe(400);
   expect((await search(request('/projects?q=example'))).status).toBe(200);expect(h.rpc).toHaveBeenLastCalledWith('outlook_site_visit_projects',{p_query:'example'});
 });
 it('uses the exact staff visit read without invoking provider or correction writes',async()=>{
   const result=await read(request(`/visits?visit=${id}&project=proj_${id}`));
   expect(result.status).toBe(200);expect(h.rpc).toHaveBeenLastCalledWith('outlook_site_visit_detail_read',{p_visit:id,p_project:id});
   expect(result.headers.get('cache-control')).toBe('private, no-store');expect(h.sync).not.toHaveBeenCalled();
   for(const query of ['visit=x',`visit=${id}&visit=${id}`,`visit=${id}&extra=1`])expect((await read(request(`/visits?${query}`))).status).toBe(400);
 });
 it('requires exact origin and strict review contract; maps stale revisions without overwriting',async()=>{
   const body={id,revision:1,projectId:null,linkMode:'manual',kind:'visit'};
   expect((await review(request('/review',body,{origin:'https://evil.invalid'}))).status).toBe(403);expect(h.rpc).not.toHaveBeenCalled();
   expect((await review(request('/review',{...body,startsAt:'invented'}))).status).toBe(400);
   h.rpc.mockResolvedValueOnce({error:{code:'40001'}});expect((await review(request('/review',body))).status).toBe(409);
   expect((await review(request('/review',body))).status).toBe(200);
 });
 it('rechecks current actor before manual refresh and only accepts empty same-origin requests',async()=>{
   const req=()=>new Request(`${origin}/refresh`,{method:'POST',headers:{origin,'x-vercel-oidc-token':'assertion'}});
   h.rpc.mockResolvedValueOnce({error:{code:'42501'}});expect((await refresh(req())).status).toBe(403);expect(h.sync).not.toHaveBeenCalled();
   expect((await refresh(request('/refresh',{}))).status).toBe(403);expect(h.sync).not.toHaveBeenCalled();
   expect((await refresh(req())).status).toBe(200);expect(h.sync).toHaveBeenCalledWith('assertion');
 });
 it('keeps cron dark without enabled config, authenticates constant-time secret and forwards only runtime assertion',async()=>{
   expect((await cron(request('/cron'))).status).toBe(401);
   const req=()=>request('/cron',undefined,{authorization:`Bearer ${process.env.CRON_SECRET}`,'x-vercel-oidc-token':'assertion'});
   expect(await (await cron(req())).json()).toEqual({enabled:false});expect(h.sync).not.toHaveBeenCalled();
   vi.stubEnv('SANCTUARY_OUTLOOK_ENABLED','true');expect((await cron(req())).status).toBe(200);expect(h.sync).toHaveBeenCalledWith('assertion');
 });
});
