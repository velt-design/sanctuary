import { afterEach,expect,it,vi } from 'vitest';
const run=vi.hoisted(()=>vi.fn(async()=>({completed:true})));
vi.mock('@/lib/marketingIntegrations/googleAds/runtime',()=>({googleConnectionRuntime:run}));
import { GET } from './route';
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
const secret='x'.repeat(40);
it('denies unauthenticated and ambiguous requests without effects',async()=>{
  vi.stubEnv('CRON_SECRET',secret);
  expect((await GET(new Request('https://example.test/api/integrations/google-ads?lane=sales'))).status).toBe(403);
  expect((await GET(new Request('https://example.test/api/integrations/google-ads?lane=sales&lane=report',{headers:{authorization:`Bearer ${secret}`}}))).status).toBe(400);
  expect(run).not.toHaveBeenCalled();
});
it('stays dark until the exact lane flag is true',async()=>{
  vi.stubEnv('CRON_SECRET',secret);vi.stubEnv('SANCTUARY_GOOGLE_ADS_UPLOADS_ENABLED','false');
  const request=()=>new Request('https://example.test/api/integrations/google-ads?lane=sales',{headers:{authorization:`Bearer ${secret}`}});
  expect(await(await GET(request())).json()).toEqual({enabled:false});expect(run).not.toHaveBeenCalled();
  vi.stubEnv('SANCTUARY_GOOGLE_ADS_UPLOADS_ENABLED','true');expect(await(await GET(request())).json()).toEqual({completed:true});expect(run).toHaveBeenCalledOnce();
});
