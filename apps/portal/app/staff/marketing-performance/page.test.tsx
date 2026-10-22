import { beforeEach,expect,it,vi } from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
const h=vi.hoisted(()=>({access:vi.fn(),headers:vi.fn(),client:vi.fn(),read:vi.fn(),commercial:vi.fn(),designer:vi.fn(),financial:vi.fn()}));
vi.mock('@/lib/auth',()=>({requireStaffPageAccess:h.access}));
vi.mock('next/headers',()=>({headers:h.headers}));
vi.mock('@/lib/supabase/serverClient',()=>({getSupabaseServerAuth:h.client}));
vi.mock('@/lib/marketingPerformance/readHub.server',()=>({readHub:h.read,hubReadFailure:()=>({ok:false,status:503,error:'The hub could not be loaded. Please retry.'})}));
vi.mock('@/lib/marketingPerformance/readOverview.server',()=>({readCommercial:h.commercial,readDesigner:h.designer,overviewFailure:()=>({ok:false,status:503,error:'Unavailable'})}));
vi.mock('@/lib/xero/financials/readPortal.server',()=>({readPortalFinancials:h.financial,financialReadFailure:()=>({ok:false,status:503,error:'Unavailable'})}));
vi.mock('next/navigation',()=>({notFound:()=>{throw new Error('not-found');}}));
vi.mock('@/components/marketingPerformance/MarketingPerformance',()=>({default:()=> <div data-marketing-client/>}));
import Page from './page';
import { DOCUMENT_CALLBACK_HEADER } from '@/lib/regionalDocumentAccess';
import { hubFixture } from '@/app/qa/marketing-performance-fixture/hubFixtures';
import type { HubReadResult } from '@/lib/marketingPerformance/initialHub';
const documentHeaders=()=>new Headers({accept:'text/html','sec-fetch-dest':'document',[DOCUMENT_CALLBACK_HEADER]:'/staff/marketing-performance?view=sales&start=2026-09-01&end=2026-09-22'});
const owner={role:'staff',user:{email:'jordan@sanctuarypergolas.co.nz',email_confirmed_at:'2026-01-01'}};
beforeEach(()=>{vi.unstubAllEnvs();vi.resetAllMocks();h.headers.mockResolvedValue(new Headers());h.client.mockResolvedValue({rpc:vi.fn()});h.read.mockResolvedValue({ok:true,report:hubFixture});h.financial.mockResolvedValue({ok:false,status:503,error:'Unavailable'});});
it('retains the existing staff and confirmed-developer gates before rendering any Marketing view',async()=>{
 h.access.mockRejectedValueOnce(new Error('redirect:login'));
 await expect(Page()).rejects.toThrow('redirect:login');
 h.access.mockResolvedValueOnce({role:'staff',user:{email:'staff@example.test',email_confirmed_at:'2026-01-01'}});
 await expect(Page()).rejects.toThrow('not-found');
 h.access.mockResolvedValueOnce({role:'admin',user:{email:'jordan@sanctuarypergolas.co.nz'}});
 await expect(Page()).rejects.toThrow('not-found');
 h.access.mockResolvedValueOnce({role:'staff',user:{email:'jordan@sanctuarypergolas.co.nz',email_confirmed_at:'2026-01-01'}});
 expect(renderToStaticMarkup(await Page())).toContain('data-marketing-client');
 expect(h.access).toHaveBeenLastCalledWith('/staff/marketing-performance');
 expect(h.read).not.toHaveBeenCalled();expect(h.client).not.toHaveBeenCalled();
});
it('starts a safe streamed read after authority without awaiting it or changing client defaults',async()=>{
 h.access.mockResolvedValue(owner);h.headers.mockResolvedValue(documentHeaders());
 let resolve!:(result:HubReadResult)=>void;
 h.read.mockReturnValue(new Promise<HubReadResult>(yes=>{resolve=yes;}));
 const page=await Page(),seed=page.props.initialHubSeed;
 expect(h.read).toHaveBeenCalledWith(await h.client.mock.results[0].value,'2026-09-01','2026-09-22');
 expect(Object.keys(seed).sort()).toEqual(['end','result','start']);
 expect(page.props).not.toHaveProperty('initialFilters');
 let settled=false;void seed.result.then(()=>{settled=true;});await Promise.resolve();expect(settled).toBe(false);
 resolve({ok:true,report:hubFixture});expect(await seed.result).toEqual({ok:true,report:hubFixture});
});
it('never starts the read before a staff/developer or preview denial',async()=>{
 h.headers.mockResolvedValue(documentHeaders());
 for(const identity of [null,{role:'admin',user:{email:'other@example.test',email_confirmed_at:'today'}},{role:'admin',user:{email:'jordan@sanctuarypergolas.co.nz'}}]){
  if(identity)h.access.mockResolvedValueOnce(identity);else h.access.mockRejectedValueOnce(new Error('access-denied'));
  await expect(Page()).rejects.toThrow();
 }
 h.access.mockResolvedValue(owner);vi.stubEnv('MARKETING_PERFORMANCE_PREVIEW','production-snapshot');vi.stubEnv('VERCEL_ENV','production');
 await expect(Page()).rejects.toThrow('not-found');
 expect(h.headers).not.toHaveBeenCalled();expect(h.client).not.toHaveBeenCalled();expect(h.read).not.toHaveBeenCalled();
});
it('does not start an initial read for RSC, prefetch, Financials or invalid date selection',async()=>{
 h.access.mockResolvedValue(owner);
 const variants=[new Headers(),documentHeaders(),documentHeaders(),documentHeaders(),documentHeaders()];
 variants[1].set('rsc','1');variants[2].set('next-router-prefetch','1');
 variants[3].set(DOCUMENT_CALLBACK_HEADER,'/staff/marketing-performance?view=financials');
 variants[4].set(DOCUMENT_CALLBACK_HEADER,'/staff/marketing-performance?start=2026-02-30');
 for(const headers of variants){h.headers.mockResolvedValue(headers);expect((await Page()).props.initialHubSeed).toBeUndefined();}
 expect(h.client).not.toHaveBeenCalled();expect(h.read).not.toHaveBeenCalled();
});
it('converts client-setup failures to public results rather than serializing server exceptions',async()=>{
 h.access.mockResolvedValue(owner);h.headers.mockResolvedValue(documentHeaders());h.client.mockRejectedValue(new Error('private connection details'));
 const page=await Page();expect(await page.props.initialHubSeed.result).toEqual({ok:false,status:503,error:'The hub could not be loaded. Please retry.'});
 expect(h.read).not.toHaveBeenCalled();
});

it('starts Overview evidence together without waiting for Hub, and only selected Financial evidence',async()=>{
 h.access.mockResolvedValue(owner);const headers=documentHeaders();headers.set(DOCUMENT_CALLBACK_HEADER,'/staff/marketing-performance?view=overview&start=2026-09-01&end=2026-09-22');h.headers.mockResolvedValue(headers);
 const pending=new Promise(()=>{});h.read.mockReturnValue(pending);h.commercial.mockReturnValue(pending);h.designer.mockReturnValue(pending);
 const overview=await Page();expect(h.client).toHaveBeenCalledOnce();expect(h.read).toHaveBeenCalledOnce();expect(h.commercial).toHaveBeenCalledOnce();expect(h.designer).toHaveBeenCalledOnce();expect(overview.props.initialCommercialSeed).toBeDefined();expect(h.financial).not.toHaveBeenCalled();
 vi.clearAllMocks();h.access.mockResolvedValue(owner);h.headers.mockResolvedValue(new Headers({accept:'text/html','sec-fetch-dest':'document',[DOCUMENT_CALLBACK_HEADER]:'/staff/marketing-performance?view=financials&financeSection=profit&financeFrom=2026-09-01&financeTo=2026-09-30&financeBasis=cash'}));h.financial.mockReturnValue(pending);
 const financial=await Page();expect(financial.props.initialFinancialSeed.key).toBe('profit:2026-09-01:2026-09-30:cash');expect(h.financial).toHaveBeenCalledOnce();expect(h.client).not.toHaveBeenCalled();expect(h.commercial).not.toHaveBeenCalled();expect(h.designer).not.toHaveBeenCalled();
});

it('does not start live Financial or Overview seeds from the private snapshot preview',async()=>{
 h.access.mockResolvedValue(owner);h.headers.mockResolvedValue(new Headers({accept:'text/html','sec-fetch-dest':'document',[DOCUMENT_CALLBACK_HEADER]:'/staff/marketing-performance?view=overview'}));vi.stubEnv('MARKETING_PERFORMANCE_PREVIEW','production-snapshot');vi.stubEnv('VERCEL_ENV','preview');
 const page=await Page();expect(page.props.initialCommercialSeed).toBeUndefined();expect(page.props.initialDesignerSeed).toBeUndefined();expect(page.props.initialFinancialSeed).toBeUndefined();expect(h.commercial).not.toHaveBeenCalled();expect(h.designer).not.toHaveBeenCalled();expect(h.financial).not.toHaveBeenCalled();
});
