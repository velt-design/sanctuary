import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffSession = vi.fn();
const parseJsonBody = vi.fn();
const isMissingSchemaError = vi.fn();
const loadScheduledJobRow = vi.fn();
const normalizeClientUpdateStatus = vi.fn();
const rpc = vi.fn();

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi');
  return { ...actual, parseJsonBody, requireStaffSession };
});

vi.mock('@/lib/scheduling/scheduleV2Server', () => ({
  isMissingSchemaError,
  loadScheduledJobRow,
  normalizeClientUpdateStatus,
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServer: { rpc },
  supabaseServiceRole: { rpc },
}));

describe('POST /api/staff/v1/schedule/job/client-update/ack', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffSession.mockReset();
    parseJsonBody.mockReset();
    isMissingSchemaError.mockReset();
    loadScheduledJobRow.mockReset();
    normalizeClientUpdateStatus.mockReset();
    rpc.mockReset();

    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'staff' });
    parseJsonBody.mockResolvedValue({ ok: true, body: { job_id: 'job-1' } });
    isMissingSchemaError.mockReturnValue(false);
    loadScheduledJobRow.mockResolvedValue({ id: 'scheduled-job-1', client_update_status: 'needed' });
    normalizeClientUpdateStatus.mockReturnValue('needed');
    rpc.mockResolvedValue({ data: { updated_job: 'scheduled-job-1', acknowledged: true }, error: null });
  });

  it('commits client update ack through one RPC call on success', async () => {
    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/job/client-update/ack', { method: 'POST', headers: { 'x-request-id': 'req_ack_ok' } }));
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0]?.[0]).toBe('schedule_v2_ack_client_update');
    expect(res.status).toBe(200);
    expect(res.headers.get('x-portal-request-id')).toBe('req_ack_ok');
  });

  it('returns idempotent acknowledged success without any RPC call', async () => {
    normalizeClientUpdateStatus.mockReturnValueOnce('acknowledged');
    loadScheduledJobRow.mockResolvedValueOnce({ id: 'scheduled-job-1', client_update_status: 'acknowledged', client_update_ack_at: '2026-04-01T00:00:00.000Z', client_update_ack_by: 'ops@example.com' });
    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/job/client-update/ack', { method: 'POST' }));
    expect(res.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toEqual({
      ok: true,
      status: 'acknowledged',
      client_update_ack_at: '2026-04-01T00:00:00.000Z',
      client_update_ack_by: 'ops@example.com',
    });
  });

  it('returns 501 when the command function is missing', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'missing fn' } });
    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/job/client-update/ack', { method: 'POST', headers: { 'x-request-id': 'req_ack_schema' } }));
    expect(res.status).toBe(501);
    expect(res.headers.get('x-portal-request-id')).toBe('req_ack_schema');
  });

  it('returns 500 on a generic RPC failure', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/schedule/job/client-update/ack', { method: 'POST', headers: { 'x-request-id': 'req_ack_fail' } }));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Failed to acknowledge client update' });
    expect(res.headers.get('x-portal-request-id')).toBe('req_ack_fail');
  });
});
