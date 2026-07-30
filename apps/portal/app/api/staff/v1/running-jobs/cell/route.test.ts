import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class RunningJobFactConflictError extends Error {}
  return {
    applyMutation: vi.fn(),
    loadRow: vi.fn(),
    requireSession: vi.fn(),
    RunningJobFactConflictError,
  };
});

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi');
  return {
    ...actual,
    requireStaffSession: (...args: unknown[]) => mocks.requireSession(...args),
  };
});

vi.mock('@/lib/runningJobs/server', () => ({
  isMissingSchemaError: () => false,
  loadRunningJobRow: (...args: unknown[]) => mocks.loadRow(...args),
}));

vi.mock('@/lib/runningJobs/writeOps', () => ({
  applyRunningJobCellMutation: (...args: unknown[]) => mocks.applyMutation(...args),
  RouteInvocationError: class RouteInvocationError extends Error {},
  RunningJobFactConflictError: mocks.RunningJobFactConflictError,
}));

vi.mock('@/lib/supabase/mappers', () => ({
  uuidFromAppId: () => '11111111-1111-4111-8111-111111111111',
}));

function request() {
  return new Request('http://localhost/api/staff/v1/running-jobs/cell', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      projectId: 'proj_test',
      rowVersion: 'row-v1',
      key: 'materials_ordered',
      value: true,
    }),
  });
}

describe('running-jobs cell route', () => {
  beforeEach(() => {
    mocks.applyMutation.mockReset();
    mocks.loadRow.mockReset();
    mocks.requireSession.mockReset();
    mocks.requireSession.mockResolvedValue({
      user: { id: '22222222-2222-4222-8222-222222222222' },
      role: 'staff',
    });
  });

  it('passes the authenticated staff actor into the mutation owner', async () => {
    const currentRow = { rowVersion: 'row-v1' };
    mocks.loadRow.mockResolvedValue(currentRow);
    mocks.applyMutation.mockResolvedValue({ ok: true, updatedRow: currentRow });
    const { POST } = await import('./route');

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.applyMutation).toHaveBeenCalledWith(expect.objectContaining({
      projectUuid: '11111111-1111-4111-8111-111111111111',
      actorUserId: '22222222-2222-4222-8222-222222222222',
      currentRow,
      key: 'materials_ordered',
      value: true,
    }));
  });

  it('returns the refreshed row when an atomic fact command detects a conflict', async () => {
    const before = { rowVersion: 'row-v1' };
    const currentRow = { rowVersion: 'row-v2' };
    mocks.loadRow.mockResolvedValueOnce(before).mockResolvedValueOnce(currentRow);
    mocks.applyMutation.mockRejectedValue(new mocks.RunningJobFactConflictError());
    const { POST } = await import('./route');

    const response = await POST(request());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Row conflict',
      currentRow,
    });
  });
});
