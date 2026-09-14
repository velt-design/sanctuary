import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { NextRequest } from 'next/server';
import { seal,unseal,XERO_SCOPES } from './security';
const mocks=vi.hoisted(()=>({session:vi.fn(),attempt:vi.fn(),consume:vi.fn(),connect:vi.fn(),access:vi.fn(),verify:vi.fn(),read:vi.fn()}));
vi.mock('@/lib/auth',()=>({getPortalSession:mocks.session}));
vi.mock('./store',()=>({saveAttempt:mocks.attempt,consumeAttempt:mocks.consume,connect:mocks.connect,access:mocks.access,verifyConnection:mocks.verify,readAccounting:mocks.read}));
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
  it.each(['{','null','[]','"search"','{"kind":123,"value":"Peter"}'])('rejects invalid search bodies before connection access: %s',async body=>{
    const response=await review(new Request(origin,{method:'POST',headers:{origin,'content-type':'application/json'},body}));
    expect(response.status).toBe(400);expect(mocks.read).not.toHaveBeenCalled();expect(mocks.access).not.toHaveBeenCalled();
  });
  it('passes valid exact searches through the durable accounting read owner',async()=>{
    mocks.read.mockResolvedValue([]);
    const response=await review(new Request(origin,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({kind:'invoice',value:'INV-0033'})}));
    expect(response.status).toBe(200);expect(mocks.read).toHaveBeenCalledOnce();
  });
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
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toMatch(/HttpOnly/i);
    expect(response.headers.get('set-cookie')).toMatch(/Secure/i);
    const destination=new URL((await response.json()).authorizationUrl);
    expect(destination.origin).toBe('https://login.xero.com');
    expect(destination.searchParams.get('scope')).toBe(XERO_SCOPES);
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
  it('discovers organisation IDs without storing tokens or making accounting reads',async()=>{
    vi.stubEnv('XERO_TENANT_ID','');vi.stubEnv('XERO_DISCOVERY','true');
    const organisations=[{tenantId:'22222222-2222-4222-8222-222222222222',tenantName:'Demo Company'}];
    const fetcher=vi.fn().mockResolvedValueOnce(Response.json({access_token:'access-secret',refresh_token:'refresh-secret',expires_in:1800,scope:XERO_SCOPES}))
      .mockResolvedValueOnce(Response.json(organisations));vi.stubGlobal('fetch',fetcher);
    const cookie=seal({state:'bound-state',userId:'user-1',expires:Date.now()+600000},key);
    const response=await callback(new NextRequest(`${origin}/api/integrations/xero/callback?state=bound-state&code=private-code`,{headers:{cookie:`__Host-xero-state=${cookie}`}}));
    expect(response.headers.get('location')).toContain('connection=discovered');
    expect(mocks.connect).not.toHaveBeenCalled();expect(mocks.access).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(2);expect(fetcher.mock.calls[1][0]).toBe('https://api.xero.com/connections');
    const metadataCookie=response.headers.get('set-cookie')!.match(/__Host-xero-organisations=([^;, ]+)/)![1];
    const metadata=unseal<Record<string,unknown>>(metadataCookie,key);
    expect(metadata).toMatchObject({userId:'user-1',organisations});
    expect(JSON.stringify(metadata)).not.toContain('secret');
    expect(response.headers.get('set-cookie')).toMatch(/HttpOnly/i);
  });
  it('requires the scheduler secret and stays dark when disabled',async()=>{
    vi.stubEnv('CRON_SECRET','x'.repeat(32));
    expect((await maintain(new Request(origin))).status).toBe(401);
    vi.stubEnv('XERO_ENABLED','false');
    expect((await maintain(new Request(origin,{headers:{authorization:`Bearer ${'x'.repeat(32)}`}}))).status).toBe(200);
    expect(mocks.verify).not.toHaveBeenCalled();
  });
});
