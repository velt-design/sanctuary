import {afterEach,expect,it,vi} from 'vitest';
import {GET} from './route';
afterEach(()=>vi.unstubAllEnvs());
it.each([['production','production','1'],['production',undefined,'1'],['production','preview','0'],['test',undefined,'0']])('denies the synthetic transport in %s/%s with flag %s',async(node,vercel,flag)=>{
 vi.stubEnv('NODE_ENV',node!);vi.stubEnv('VERCEL_ENV',vercel);vi.stubEnv('ENABLE_PORTAL_QA_FIXTURES',flag);
 expect((await GET(new Request('http://localhost/qa/marketing-performance-fixture/financial-read'))).status).toBe(404);
});
it('validates selection before any fictional read starts',async()=>{
 vi.stubEnv('ENABLE_PORTAL_QA_FIXTURES','1');vi.stubEnv('NODE_ENV','test');
 for(const query of ['','from=2026-09-01&to=2026-09-30&basis=accrual&section=bank','from=2026-09-01&to=2026-09-30&basis=accrual&section=profit&from=2026-08-01'])expect((await GET(new Request('http://localhost/qa/marketing-performance-fixture/financial-read?'+query))).status).toBe(400);
});
