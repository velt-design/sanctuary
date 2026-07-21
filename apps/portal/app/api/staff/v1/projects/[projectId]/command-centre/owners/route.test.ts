import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();
const getProjectCommandCentre = vi.fn();
const rpc = vi.fn();

vi.mock('@/lib/api/staffApi', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi')),
  requireStaffContext,
}));
vi.mock('@/lib/projects/commandCentre/getProjectCommandCentre', () => ({ getProjectCommandCentre }));

const projectId = 'proj_11111111-1111-4111-8111-111111111111';
const commandId = '22222222-2222-4222-8222-222222222222';
const actorId = '33333333-3333-4333-8333-333333333333';
const ctx = { params: Promise.resolve({ projectId }) };

function request(body: unknown) {
  return new Request(`http://localhost/api/staff/v1/projects/${projectId}/command-centre/owners`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

describe('PATCH command-centre owners', () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: [{ replayed: false }], error: null });
    requireStaffContext.mockReset().mockResolvedValue({
      ok: true, session: { user: { id: actorId }, role: 'admin' }, supabase: { rpc },
    });
    getProjectCommandCentre.mockReset().mockResolvedValue({ projectId, operations: {} });
  });

  it('passes an optimistic idempotent owner command and returns no-store', async () => {
    const { PATCH } = await import('./route');
    const res = await PATCH(request({ ownerKey: 'jordan', commandId, expectedVersion: null }), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(rpc).toHaveBeenCalledWith('project_command_set_owner', expect.objectContaining({
      p_owner_key: 'jordan', p_command_id: commandId, p_expected_updated_at: null,
    }));
    await expect(res.json()).resolves.toMatchObject({ command: { id: commandId, committed: true, replayed: false } });
  });

  it('maps stale assignment versions to a stable 409', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '40001', message: 'owner assignment changed' } });
    const { PATCH } = await import('./route');
    const res = await PATCH(request({ ownerKey: 'jp', commandId, expectedVersion: '2026-07-20T00:00:00.000Z' }), ctx);
    expect(res.status).toBe(409);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('rejects owner values outside Jordan, JP, Joe, and Bruce', async () => {
    const { PATCH } = await import('./route');
    const res = await PATCH(request({ ownerKey: 'steve', commandId, expectedVersion: null }), ctx);
    expect(res.status).toBe(400);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('does not invite a retry after the command commits but refresh fails', async () => {
    getProjectCommandCentre.mockRejectedValueOnce(new Error('refresh failed'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { PATCH } = await import('./route');
    const res = await PATCH(request({ ownerKey: 'bruce', commandId, expectedVersion: null }), ctx);
    await expect(res.json()).resolves.toMatchObject({ command: { committed: true }, refreshRequired: true });
    errorSpy.mockRestore();
  });
});
