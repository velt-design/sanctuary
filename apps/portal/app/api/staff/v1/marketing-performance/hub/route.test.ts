// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), snapshot: vi.fn() }));
vi.mock('@/lib/api/staffApi', () => ({ requireStaffContext: mocks.auth,
  jsonError: (error: string, status: number) => Response.json({ error },{ status }),
  jsonOk: (value: unknown) => Response.json(value) }));
vi.mock('@/lib/marketingPerformance/readSnapshot',()=>({readPreviewSnapshot:mocks.snapshot}));
import { GET } from './route';
import { hubFixture as fixtureReport } from '@/app/qa/marketing-performance-fixture/hubFixtures';
const request = (query = 'start=2026-09-01&end=2026-09-22') => new Request(`https://portal.example.test/api/staff/v1/marketing-performance?${query}`);
beforeEach(() => { vi.clearAllMocks(); mocks.snapshot.mockResolvedValue(null); mocks.auth.mockResolvedValue({ok:true,session:{user:{email:'jordan@sanctuarypergolas.co.nz',email_confirmed_at:'2026-01-01'}},supabase:{rpc:mocks.rpc}}); mocks.rpc.mockResolvedValue({ data:fixtureReport,error:null }); });
it('denies other staff/admins and unverified or lookalike emails before any RPC', async () => {
  for (const user of [{email:'other@example.test',email_confirmed_at:'today'},
    {email:'jordan@sanctuarypergolas.co.nz'},
    {email:'jordan@sanctuarypergolas.co.nz.evil',email_confirmed_at:'today'}]) {
    mocks.auth.mockResolvedValue({ok:true,session:{role:'admin',user},supabase:{rpc:mocks.rpc}});
    const response=await GET(request());
    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  }
  expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.snapshot).not.toHaveBeenCalled();
});
it('requires staff before accessing data and marks denial private', async () => {
  mocks.auth.mockResolvedValue({ok:false,response:Response.json({error:'Unauthorized'},{status:401})});
  const result = await GET(request()); expect(result.status).toBe(401); expect(mocks.rpc).not.toHaveBeenCalled(); expect(result.headers.get('cache-control')).toBe('private, no-store');
});
it('rejects invalid dates, unknown parameters and duplicate parameters before RPC', async () => {
  for (const query of ['start=2026-02-30&end=2026-03-01','start=2026-09-01&end=2026-09-22&start=2026-09-02','start=2026-09-01&end=2026-09-22&admin=1']) expect((await GET(request(query))).status).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('returns a complete validated report and rejects mismatched or duplicate evidence', async () => {
  const result = await GET(request()); expect(result.status).toBe(200); expect(result.headers.get('cache-control')).toBe('private, no-store');
  expect((await result.json()).report.enquiries.rows).toHaveLength(12);
  mocks.rpc.mockResolvedValue({data:{...fixtureReport,end:'2026-09-21'},error:null}); expect((await GET(request())).status).toBe(503);
  mocks.rpc.mockResolvedValue({data:{...fixtureReport,events:[fixtureReport.events[0],fixtureReport.events[0]]},error:null}); expect((await GET(request())).status).toBe(503);
});
it('does not return raw database failures or partial totals', async () => {
  for (const [code,status] of [['42501',403],['54000',422],['PGRST202',503]]) {
    mocks.rpc.mockResolvedValue({data:fixtureReport,error:{code,message:'private provider payload'}});
    const result=await GET(request()); expect(result.status).toBe(status); expect(await result.text()).not.toContain('private provider');
  }
});


it('serves protected snapshots without RPC and fails closed on snapshot errors',async()=>{
  mocks.snapshot.mockResolvedValue({...fixtureReport});
  const good=await GET(request());expect(good.status).toBe(200);expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.snapshot.mockRejectedValue(new Error('private snapshot content'));
  const bad=await GET(request());expect(bad.status).toBe(503);expect(await bad.text()).not.toContain('private snapshot content');
});
