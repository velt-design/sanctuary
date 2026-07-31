import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdminContext: vi.fn(),
  runConfirmationCorrectionReview: vi.fn(),
}));

vi.mock('@/lib/api/adminApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/adminApi')>(
    '@/lib/api/adminApi',
  );
  return { ...actual, requireAdminContext: mocks.requireAdminContext };
});

vi.mock('@/lib/projects/workItems/confirmationCorrections/commands', () => ({
  runConfirmationCorrectionReview: mocks.runConfirmationCorrectionReview,
}));

import { POST } from './route';

const PROJECT_UUID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = `proj_${PROJECT_UUID}`;
const COMMAND_ID = '22222222-2222-4222-8222-222222222222';
const REPAIR_SIGNAL_ID = '33333333-3333-4333-8333-333333333333';
const SUPABASE = { rpc: vi.fn() };

describe('POST confirmation correction review reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminContext.mockResolvedValue({
      ok: true,
      supabase: SUPABASE,
      session: { role: 'admin', user: { id: 'admin-1' } },
    });
    mocks.runConfirmationCorrectionReview.mockResolvedValue({
      projectId: PROJECT_ID,
      repairSignalId: REPAIR_SIGNAL_ID,
      signalRowVersion: 2,
      resolvedCount: 1,
      reviewRequired: false,
      replayed: false,
      refreshRequired: false,
    });
  });

  it('resolves review only after a reasoned admin command', async () => {
    const response = await POST(new Request(
      'http://localhost/api/admin/project-work/confirmations/reconcile',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId: PROJECT_ID,
          repairSignalId: REPAIR_SIGNAL_ID,
          expectedSignalRowVersion: 1,
          commandId: COMMAND_ID,
          reason: 'Current work and lifecycle state were reviewed.',
        }),
      },
    ));

    expect(response.status).toBe(200);
    expect(mocks.runConfirmationCorrectionReview).toHaveBeenCalledWith(
      SUPABASE,
      {
        projectUuid: PROJECT_UUID,
        projectId: PROJECT_ID,
        repairSignalId: REPAIR_SIGNAL_ID,
        expectedSignalRowVersion: 1,
        commandId: COMMAND_ID,
        reason: 'Current work and lifecycle state were reviewed.',
      },
    );
    await expect(response.json()).resolves.toMatchObject({
      result: { reviewRequired: false },
    });
  });

  it('maps a changed exact signal to a refresh-required conflict', async () => {
    mocks.runConfirmationCorrectionReview.mockRejectedValueOnce({
      code: 'P0001',
      message: 'CONFIRMATION_RETRACTION_REVIEW_STALE: signal changed after review',
    });

    const response = await POST(new Request(
      'http://localhost/api/admin/project-work/confirmations/reconcile',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId: PROJECT_ID,
          repairSignalId: REPAIR_SIGNAL_ID,
          expectedSignalRowVersion: 1,
          commandId: COMMAND_ID,
          reason: 'Current work and lifecycle state were reviewed.',
        }),
      },
    ));

    expect(response.status).toBe(409);
  });
});
