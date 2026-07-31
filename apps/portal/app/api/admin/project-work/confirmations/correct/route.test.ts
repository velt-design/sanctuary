import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdminContext: vi.fn(),
  runConfirmationCorrection: vi.fn(),
}));

vi.mock('@/lib/api/adminApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/adminApi')>(
    '@/lib/api/adminApi',
  );
  return { ...actual, requireAdminContext: mocks.requireAdminContext };
});

vi.mock('@/lib/projects/workItems/confirmationCorrections/commands', () => ({
  runConfirmationCorrection: mocks.runConfirmationCorrection,
}));

import { POST } from './route';

const PROJECT_UUID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = `proj_${PROJECT_UUID}`;
const COMMAND_ID = '22222222-2222-4222-8222-222222222222';
const EVENT_ID = '33333333-3333-4333-8333-333333333333';
const SUPABASE = { rpc: vi.fn() };

function request(body: Record<string, unknown>) {
  return new Request(
    'http://localhost/api/admin/project-work/confirmations/correct',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

describe('POST confirmation correction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminContext.mockResolvedValue({
      ok: true,
      supabase: SUPABASE,
      session: { role: 'admin', user: { id: 'admin-1' } },
    });
    mocks.runConfirmationCorrection.mockResolvedValue({
      projectId: PROJECT_ID,
      confirmationEventId: EVENT_ID,
      retractionEventId: '44444444-4444-4444-8444-444444444444',
      repairSignalId: '55555555-5555-4555-8555-555555555555',
      reviewRequired: true,
      replayed: false,
      refreshRequired: false,
    });
  });

  it('requires an explicit correction reason', async () => {
    const response = await POST(request({
      projectId: PROJECT_ID,
      commandId: COMMAND_ID,
      confirmationEventId: EVENT_ID,
    }));

    expect(response.status).toBe(400);
    expect(mocks.runConfirmationCorrection).not.toHaveBeenCalled();
  });

  it('uses the admin auth-bound adapter and reports durable commit', async () => {
    const response = await POST(request({
      projectId: PROJECT_ID,
      commandId: COMMAND_ID,
      confirmationEventId: EVENT_ID,
      reason: 'The email was not actually sent.',
    }));

    expect(response.status).toBe(200);
    expect(mocks.runConfirmationCorrection).toHaveBeenCalledWith(SUPABASE, {
      projectUuid: PROJECT_UUID,
      projectId: PROJECT_ID,
      commandId: COMMAND_ID,
      confirmationEventId: EVENT_ID,
      reason: 'The email was not actually sent.',
    });
    await expect(response.json()).resolves.toMatchObject({
      command: { id: COMMAND_ID, committed: true, replayed: false },
      result: { reviewRequired: true },
    });
  });
});
