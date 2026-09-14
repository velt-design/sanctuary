import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { NextRequest } from 'next/server';
import { seal,XERO_SCOPES } from './security';
const mocks=vi.hoisted(()=>({session:vi.fn(),attempt:vi.fn(),consume:vi.fn(),connect:vi.fn(),access:vi.fn(),verify:vi.fn()}));
vi.mock('@/lib/auth',()=>({getPortalSession:mocks.session}));
vi.mock('./store',()=>({saveAttempt:mocks.attempt,consumeAttempt:mocks.consume,connect:mocks.connect,access:mocks.access,verifyConnection:mocks.verify}));
import { POST as start } from '../../app/api/integrations/xero/start/route';
import { GET as callback } from '../../app/api/integrations/xero/callback/route';
import { POST as review } from '../../app/api/integrations/xero/review/route';
import { GET as maintain } from '../../app/api/integrations/xero/maintain/route';

const origin='https://portal.example.test';const key=Buffer.alloc(32,7);
beforeEach(()=>{
  vi.resetAllMocks();
  for(const [name,value] of Object.entries({XERO_ENABLED:'true',XERO_PORTAL_ORIGIN:origin,XERO_TOKEN_ENCRYPTION_KEY:key.toString('base64'),XERO_TENANT_ID:'11111111-1111-4111-8111-111111111111',XERO_DATABASE_URL:'postgres://test@localhost/test',XERO_CLIENT_ID:'test-client',XERO_CLIENT_SECRET:'private-secret'}))vi.stubEnv(name,value);
  mocks.session.mockResolvedValue({user:{id:'user-1',email:'jordan@sanctuarypergolas.co.nz',email_confirmed_at:'today'},role:'staff'});
  mocks.consume.mockResolvedValue(true);
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('Xero HTTP integration',()=>{
  it('denies normal admins before accessing the store or provider',async()=>{
    mocks.session.mockResolvedValue({user:{email:'info@sanctuarypergolas.co.nz',email_confirmed_at:'today'},role:'admin'});
    expect((await start(new Request(origin,{method:'POST'}))).status).toBe(403);
    expect((await review(new Request(origin,{method:'POST'}))).status).toBe(403);
    expect((await callback(new NextRequest(origin)))).toHaveProperty('status',403);
    expect(mocks.attempt).not.toHaveBeenCalled();expect(mocks.access).not.toHaveBeenCalled();
  });
  it('rejects cross-site initiation and sets a secure bound cookie for valid starts',async()=>{
    expect((await start(new Request(origin,{method:'POST',headers:{origin:'https://other.test'}}))).status).toBe(403);
    const response=await start(new Request(origin,{method:'POST',headers:{origin}}));
    expect(response.status).toBe(303);
    expect(response.headers.get('set-cookie')).toMatch(/HttpOnly/i);
    expect(response.headers.get('set-cookie')).toMatch(/Secure/i);
    expect(new URL(response.headers.get('location')!).searchParams.get('scope')).toBe(XERO_SCOPES);
    expect(mocks.attempt).toHaveBeenCalledOnce();
  });
  it('consumes one-use state before exchanging and rejects replay',async()=>{
    const fetcher=vi.fn().mockResolvedValue(Response.json({access_token:'access',refresh_token:'refresh',expires_in:1800,scope:XERO_SCOPES}));vi.stubGlobal('fetch',fetcher);
    const cookie=seal({state:'bound-state',userId:'user-1',expires:Date.now()+600000},key);
    const req=()=>new NextRequest(`${origin}/api/integrations/xero/callback?state=bound-state&code=private-code`,{headers:{cookie:`__Host-xero-state=${cookie}`}});
    const first=await callback(req());expect(first.headers.get('location')).toContain('connection=connected');expect(mocks.connect).toHaveBeenCalledOnce();
    mocks.consume.mockResolvedValue(false);
    expect((await callback(req())).headers.get('location')).toContain('connection=failed');
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('rejects expired or differently bound callbacks without provider access',async()=>{
    const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
    for(const payload of [{state:'s',userId:'someone-else',expires:Date.now()+10000},{state:'s',userId:'user-1',expires:0}]){
      const req=new NextRequest(`${origin}?state=s&code=c`,{headers:{cookie:`__Host-xero-state=${seal(payload,key)}`}});
      expect((await callback(req)).headers.get('location')).toContain('connection=failed');
    }
    expect(fetcher).not.toHaveBeenCalled();expect(mocks.consume).not.toHaveBeenCalled();
  });
  it('requires the scheduler secret and stays dark when disabled',async()=>{
    vi.stubEnv('CRON_SECRET','x'.repeat(32));
    expect((await maintain(new Request(origin))).status).toBe(401);
    vi.stubEnv('XERO_ENABLED','false');
    expect((await maintain(new Request(origin,{headers:{authorization:`Bearer ${'x'.repeat(32)}`}}))).status).toBe(200);
    expect(mocks.verify).not.toHaveBeenCalled();
  });
});
