import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth:vi.fn(),rpc:vi.fn() }));
vi.mock('@/lib/api/staffApi', () => ({ requireStaffContext:mocks.auth }));
import { GET } from './route';
const projectId = '11111111-1111-4111-8111-111111111111';
const get = () => GET(new Request('http://localhost'),{params:Promise.resolve({projectId})});
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ok:true,supabase:{rpc:mocks.rpc}}); mocks.rpc.mockResolvedValue({data:[],error:null}); });
it('requires a staff session before reading records', async () => {
  mocks.auth.mockResolvedValue({ok:false,response:new Response('',{status:401})});
  const response = await get();
  expect(response.status).toBe(401); expect(response.headers.get('cache-control')).toContain('no-store');
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('uses the auth-bound scoped read and prevents shared caching', async () => {
  const response = await get();
  expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toContain('no-store');
  expect(mocks.rpc).toHaveBeenCalledWith('marketing_enquiry_staff_receipts',{p_project_id:projectId});
});
it('does not present unavailable storage as an empty enquiry history', async () => {
  mocks.rpc.mockResolvedValue({data:null,error:{code:'PGRST202',message:'private diagnostic'}});
  const response = await get();
  expect(response.status).toBe(503); expect(await response.text()).not.toContain('private diagnostic');
});
