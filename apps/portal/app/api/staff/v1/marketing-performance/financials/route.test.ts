import { beforeEach,expect,it,vi } from 'vitest';
const mocks=vi.hoisted(()=>({staff:vi.fn(),developer:vi.fn(),finance:vi.fn(),runtime:vi.fn(),read:vi.fn()}));
vi.mock('@/lib/api/staffApi',()=>({requireStaffContext:mocks.staff,jsonOk:(body:unknown)=>Response.json(body),jsonError:(error:string,status:number)=>Response.json({error},{status})}));
vi.mock('@/lib/developerAccess',()=>({isDeveloper:mocks.developer}));
vi.mock('@/lib/xero/pilotAccess',()=>({getPaymentPilotSession:mocks.finance}));
vi.mock('@/lib/xero/financePositionRuntime',()=>({positionRuntime:mocks.runtime}));
vi.mock('@/lib/xero/financials/read',()=>({readFinancials:mocks.read}));
import { GET } from './route';
const user={id:'owner',email:'synthetic@example.test'},query='from=2026-09-01&to=2026-09-30&basis=accrual';
const request=(params=query)=>new Request(`https://portal.example.test/api/staff/v1/marketing-performance/financials?${params}`);
beforeEach(()=>{vi.resetAllMocks();mocks.staff.mockResolvedValue({ok:true,session:{user}});mocks.finance.mockResolvedValue({user});mocks.developer.mockReturnValue(true);mocks.runtime.mockReturnValue({deps:{},deadline:new AbortController().signal});mocks.read.mockResolvedValue({synthetic:true});});
it('requires staff, developer identity and the current matching finance grant before provider access',async()=>{
  mocks.staff.mockResolvedValueOnce({ok:false,response:Response.json({error:'Sign in'},{status:401})});expect((await GET(request())).status).toBe(401);
  mocks.developer.mockReturnValueOnce(false);expect((await GET(request())).status).toBe(403);
  mocks.finance.mockResolvedValueOnce(null);expect((await GET(request())).status).toBe(403);
  mocks.finance.mockResolvedValueOnce({user:{id:'different'}});expect((await GET(request())).status).toBe(403);
  expect(mocks.runtime).not.toHaveBeenCalled();expect(mocks.read).not.toHaveBeenCalled();
});
it.each([`${query}&tenant=other`,`${query}&from=2026-08-01`,query.replace('2026-09-30','2099-09-30'),query.replace('2026-09-30','2026-02-30'),query.replace('accrual','unknown')])('denies unknown, repeated or invalid query: %s',async params=>{
  expect((await GET(request(params))).status).toBe(400);expect(mocks.read).not.toHaveBeenCalled();
});
it('returns private, bounded-source evidence and rechecks session identity during the source read',async()=>{
  const result=await GET(request());expect(result.status).toBe(200);expect(result.headers.get('cache-control')).toBe('private, no-store');
  const recheck=mocks.runtime.mock.calls[0][2];await expect(recheck()).resolves.toBeUndefined();
  mocks.finance.mockResolvedValueOnce(null);await expect(recheck()).rejects.toThrow('FINANCIALS_ACCESS_CHANGED');
  expect(mocks.read).toHaveBeenCalledWith({from:'2026-09-01',to:'2026-09-30',basis:'accrual'},{},expect.any(AbortSignal));
});
it('does not return provider error bodies or partial payloads after a failed authority check',async()=>{
  mocks.read.mockRejectedValueOnce(new Error('Secret accounting evidence'));const failed=await GET(request());expect(failed.status).toBe(503);expect(await failed.text()).not.toContain('Secret');
  mocks.read.mockRejectedValueOnce(new Error('FINANCIALS_ACCESS_CHANGED'));expect((await GET(request())).status).toBe(403);
});
