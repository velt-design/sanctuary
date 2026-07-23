import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  getServiceSupabase: vi.fn(),
  rpc: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('@/lib/supabaseService', () => ({
  getServiceSupabase: h.getServiceSupabase,
}));

async function get(secret = 'cleanup-secret') {
  const { GET } = await import('./route');
  return GET(new Request('http://localhost/api/enquiry/attachments/cleanup', {
    headers: { Authorization: `Bearer ${secret}` },
  }));
}

describe('GET /api/enquiry/attachments/cleanup', () => {
  beforeEach(() => {
    vi.resetModules();
    h.getServiceSupabase.mockReset();
    h.rpc.mockReset();
    h.remove.mockReset();
    process.env.CRON_SECRET = 'cleanup-secret';
    h.remove.mockResolvedValue({ data: [], error: null });
    h.rpc
      .mockResolvedValueOnce({
        data: [{
          submission_id: '54b33a9d-13f1-4145-a145-3485b2441464',
          expected_files: [
            { path: 'pending/54b33a9d-13f1-4145-a145-3485b2441464/0-plan.pdf' },
            { path: 'pending/another-submission/0-forged.pdf' },
          ],
        }],
        error: null,
      })
      .mockResolvedValueOnce({ data: 1, error: null });
    h.getServiceSupabase.mockReturnValue({
      rpc: h.rpc,
      storage: { from: () => ({ remove: h.remove }) },
    });
  });

  it('requires the deployment cron secret', async () => {
    expect((await get('wrong-secret')).status).toBe(401);
    expect(h.getServiceSupabase).not.toHaveBeenCalled();
  });

  it('removes only expired objects bound to the stale submission', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(h.remove).toHaveBeenCalledWith([
      'pending/54b33a9d-13f1-4145-a145-3485b2441464/0-plan.pdf',
    ]);
    expect(h.rpc).toHaveBeenLastCalledWith(
      'marketing_enquiry_delete_stale_upload_sessions',
      { p_submission_ids: ['54b33a9d-13f1-4145-a145-3485b2441464'] },
    );
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      deletedSessions: 1,
      removedObjects: 1,
    });
  });
});
