import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), preview: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/api/staffApi', () => ({ requireStaffContext: mocks.auth }));
vi.mock('@/lib/installerPayouts/preview', () => ({ previewPayout: mocks.preview }));
import { GET } from './route';
import { POST } from '@/app/api/admin/projects/[projectId]/installer-payout/route';
const projectId = '11111111-1111-4111-8111-111111111111';
const ctx = { params: Promise.resolve({ projectId }) };
const post = (body: unknown) => POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify(body) }),ctx);
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ ok: true, session: { role: 'admin' }, supabase: { rpc: mocks.rpc } }); mocks.rpc.mockResolvedValue({data:[],error:null}); });
it('rejects unauthenticated access and staff financial writes before accessing storage', async () => {
  mocks.auth.mockResolvedValueOnce({ok:false,response:new Response('',{status:401})});
  expect((await GET(new Request('http://localhost'),ctx)).status).toBe(401);
  mocks.auth.mockResolvedValueOnce({ok:true,session:{role:'staff'}});
  expect((await post({action:'agreement'})).status).toBe(403); expect(mocks.rpc).not.toHaveBeenCalled();
});
it('serves no-store reads and an explicit migration-unavailable state', async () => {
  const response = await GET(new Request('http://localhost'),ctx);
  expect(response.headers.get('cache-control')).toContain('no-store');
  mocks.rpc.mockResolvedValueOnce({error:{code:'PGRST202'}});
  expect((await GET(new Request('http://localhost'),ctx)).status).toBe(503);
});
it('blocks a changed pricebook/scope before writing an agreement', async () => {
  mocks.preview.mockResolvedValue({fingerprint:'new',agreement:{}});
  const response = await post({action:'agreement',expectedSequence:0,commandId:projectId,fingerprint:'old'});
  expect(response.status).toBe(409); expect(mocks.rpc).toHaveBeenCalledTimes(1);
});
it('writes only the freshly calculated agreement, not browser-supplied money', async () => {
  const agreement = {totalPayable:2170};
  mocks.preview.mockResolvedValue({fingerprint:'same',agreement});
  expect((await post({action:'agreement',expectedSequence:0,commandId:projectId,fingerprint:'same',totalPayable:1})).status).toBe(200);
  expect(mocks.rpc).toHaveBeenLastCalledWith('installer_payout_append',expect.objectContaining({p_payload:agreement,p_expected_sequence:0}));
});
