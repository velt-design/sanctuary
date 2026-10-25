import {afterEach,expect,it,vi} from 'vitest';
import {GET} from './route';
afterEach(()=>vi.unstubAllEnvs());
it('refuses fictional stream reads without the existing explicit fixture flag',async()=>{
 vi.stubEnv('ENABLE_PORTAL_QA_FIXTURES','');expect((await GET(new Request('http://localhost/qa/portal-progressive-fixture/dashboard-read'))).status).toBe(404);
});
it('refuses the fictional stream on a production deployment even if its flag is set',async()=>{
 vi.stubEnv('ENABLE_PORTAL_QA_FIXTURES','1');vi.stubEnv('NODE_ENV','production');vi.stubEnv('VERCEL_ENV','production');expect((await GET(new Request('http://localhost/qa/portal-progressive-fixture/dashboard-read'))).status).toBe(404);
});
