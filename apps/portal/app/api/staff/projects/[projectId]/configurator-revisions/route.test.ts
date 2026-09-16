import {afterEach, beforeEach, expect, it, vi} from 'vitest';
const mocks = vi.hoisted(() => ({auth:vi.fn(), session:vi.fn(), fetch:vi.fn(), from:vi.fn()}));
vi.mock('@/lib/api/staffApi',() => ({requireStaffContext:mocks.auth}));
import {GET,POST} from './route';
const projectId='11111111-1111-4111-8111-111111111111';
const context=()=>({params:Promise.resolve({projectId})});
const post=(body:unknown,contentType='application/json')=>POST(new Request('http://localhost/api',{method:'POST',headers:{'Content-Type':contentType},body:JSON.stringify(body)}),context());
beforeEach(()=>{
  vi.resetAllMocks(); vi.stubGlobal('fetch',mocks.fetch);
  vi.stubEnv('NEXT_PUBLIC_MARKETING_SITE_URL','https://marketing.example.invalid');
  mocks.auth.mockResolvedValue({ok:true,supabase:{auth:{getSession:mocks.session},from:mocks.from}});
  mocks.session.mockResolvedValue({data:{session:{access_token:'server-only-test-token'}}});
});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('requires staff authentication before reading or forwarding',async()=>{
  mocks.auth.mockResolvedValue({ok:false,response:new Response('',{status:401})});
  expect((await GET(new Request('http://localhost'),context())).status).toBe(401);
  expect((await post({action:'prepare'})).status).toBe(401);
  expect(mocks.fetch).not.toHaveBeenCalled();expect(mocks.from).not.toHaveBeenCalled();
});
it('authenticates only the fixed protected preview and keeps its credential out of responses',async()=>{
  vi.stubEnv('VERCEL_ENV','preview');
  vi.stubEnv('CONFIGURATOR_MARKETING_PREVIEW_SECRET','private-machine-credential');
  vi.stubEnv('NEXT_PUBLIC_MARKETING_SITE_URL','https://marketing-preview.vercel.app');
  mocks.fetch.mockResolvedValue(Response.json({status:'saved',estimateId:'est-new',revisionId:'rev',alreadyExisted:true}));
  const response=await post({action:'save',url:'https://attacker.invalid'});
  expect(mocks.fetch.mock.calls[0][1].headers).toMatchObject({Authorization:'Bearer server-only-test-token','x-vercel-protection-bypass':'private-machine-credential'});
  expect(await response.text()).not.toContain('private-machine-credential');
  vi.stubEnv('VERCEL_ENV','production');
  await post({action:'prepare'});
  expect(mocks.fetch.mock.calls[1][1].headers).not.toHaveProperty('x-vercel-protection-bypass');
});
it('refuses to send a preview credential to a non-Vercel origin',async()=>{
  vi.stubEnv('VERCEL_ENV','preview');
  vi.stubEnv('CONFIGURATOR_MARKETING_PREVIEW_SECRET','private-machine-credential');
  expect((await post({action:'prepare'})).status).toBe(503);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it('distinguishes deployment protection from staff sign-in failures',async()=>{
  mocks.fetch.mockResolvedValueOnce(Response.json({error:{code:'401',message:'Protected deployment'}},{status:401}));
  const blocked=await post({action:'prepare'});
  expect(blocked.status).toBe(503);
  expect(await blocked.json()).toMatchObject({code:'CONFIGURATOR_PREVIEW_AUTH_REQUIRED'});
  mocks.fetch.mockResolvedValueOnce(Response.json({error:'Staff sign-in required.'},{status:401}));
  expect((await post({action:'prepare'})).status).toBe(401);
});
it('forwards only design inputs to a fixed origin and returns only selling data',async()=>{
  mocks.fetch.mockResolvedValue(Response.json({status:'prepared',preparationHash:'abc',estimate:{privateCost:123},actorId:'secret',frozen:{customerPrice:{currency:'NZD',includesGst:true,amountIncGst:100,breakdown:[{label:'Pergola',amountIncGst:100,privateMargin:30}]}}}));
  const response=await post({action:'prepare',projectId:'wrong',sourceEstimateId:'source',design:{roof:'test'},price:1,url:'https://attacker.invalid'});
  expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toContain('no-store');
  const [url,options]=mocks.fetch.mock.calls[0];
  expect(url).toBe('https://marketing.example.invalid/api/staff/configurator-revisions/prepare');
  expect(options.redirect).toBe('error');expect(options.headers.Authorization).toBe('Bearer server-only-test-token');
  expect(JSON.parse(options.body)).toEqual({projectId,sourceEstimateId:'source',design:{roof:'test'}});
  const body=await response.text();
  expect(body).not.toMatch(/privateCost|privateMargin|server-only-test-token|secret/);
  expect(JSON.parse(body).price.breakdown).toEqual([{label:'Pergola',amountIncGst:100}]);
});
it('rejects oversized or non-JSON requests before forwarding credentials',async()=>{
  expect((await post({action:'save'},'text/plain')).status).toBe(415);
  expect((await post({action:'save',design:'x'.repeat(20001)})).status).toBe(413);
  expect(mocks.session).not.toHaveBeenCalled();expect(mocks.fetch).not.toHaveBeenCalled();
});
it('preserves save retry identity and reports approval failures without claiming success',async()=>{
  mocks.fetch.mockResolvedValueOnce(Response.json({status:'unavailable',reason:'An approved configurator pricebook is required.'},{status:409}));
  const denied=await post({action:'prepare'});expect(denied.status).toBe(409);
  expect(await denied.json()).toMatchObject({error:'An approved configurator pricebook is required.'});
  mocks.fetch.mockResolvedValue(Response.json({status:'saved',estimateId:'est-new',revisionId:'rev',alreadyExisted:true,estimate:{secret:1}}));
  const result=await post({action:'save',requestId:'same-id',preparationHash:'same-hash'});
  expect(JSON.parse(mocks.fetch.mock.calls[1][1].body)).toMatchObject({requestId:'same-id',preparationHash:'same-hash'});
  expect(await result.json()).toEqual({status:'saved',estimateId:'est-new',revisionId:'rev',alreadyExisted:true});
});
