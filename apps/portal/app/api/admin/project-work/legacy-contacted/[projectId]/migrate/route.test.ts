import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdminContext: vi.fn(),
  runLegacyContactedMigration: vi.fn(),
}));

vi.mock('@/lib/api/adminApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/adminApi')>(
    '@/lib/api/adminApi',
  );
  return { ...actual, requireAdminContext: mocks.requireAdminContext };
});

vi.mock('@/lib/projects/workItems/legacyTriage/commands', () => ({
  runLegacyContactedMigration: mocks.runLegacyContactedMigration,
}));

import { POST } from './route';

const PROJECT_UUID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = `proj_${PROJECT_UUID}`;
const COMMAND_ID = '22222222-2222-4222-8222-222222222222';
const EVIDENCE_FINGERPRINT = 'a'.repeat(64);
const SUPABASE = { rpc: vi.fn() };
const CONTEXT = { params: Promise.resolve({ projectId: PROJECT_ID }) };

function request(body: Record<string, unknown>) {
  return new Request(
    `http://localhost/api/admin/project-work/legacy-contacted/${PROJECT_ID}/migrate`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

describe('POST legacy Contacted reviewed migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminContext.mockResolvedValue({
      ok: true,
      supabase: SUPABASE,
      session: { role: 'admin', user: { id: 'admin-1' } },
    });
    mocks.runLegacyContactedMigration.mockResolvedValue({
      projectId: PROJECT_ID,
      disposition: 'ACTIVE_TRIAGE',
      operationalState: 'ACTIVE',
      stateRowVersion: 1,
      workItemId: null,
      projectUpdatedAt: '2026-07-29T00:00:00.000Z',
      replayed: false,
      refreshRequired: false,
    });
  });

  it('requires a reason before running the one-project command', async () => {
    const response = await POST(request({
      commandId: COMMAND_ID,
      expectedUpdatedAt: '2026-07-28T00:00:00.000Z',
      expectedEvidenceFingerprint: EVIDENCE_FINGERPRINT,
      disposition: 'ACTIVE_TRIAGE',
    }), CONTEXT);

    expect(response.status).toBe(400);
    expect(mocks.runLegacyContactedMigration).not.toHaveBeenCalled();
  });

  it('passes one reviewed project through the auth-bound command adapter', async () => {
    const response = await POST(request({
      commandId: COMMAND_ID,
      expectedUpdatedAt: '2026-07-28T00:00:00.000Z',
      expectedEvidenceFingerprint: EVIDENCE_FINGERPRINT,
      disposition: 'ACTIVE_TRIAGE',
      reason: 'Current design evidence requires staff triage.',
    }), CONTEXT);

    expect(response.status).toBe(200);
    expect(mocks.runLegacyContactedMigration).toHaveBeenCalledWith(SUPABASE, {
      projectUuid: PROJECT_UUID,
      commandId: COMMAND_ID,
      expectedUpdatedAt: '2026-07-28T00:00:00.000Z',
      expectedEvidenceFingerprint: EVIDENCE_FINGERPRINT,
      disposition: 'ACTIVE_TRIAGE',
      reason: 'Current design evidence requires staff triage.',
      title: null,
      responsibilityArea: null,
      dueAt: null,
      waitingUntil: null,
      closedOutcome: null,
    });
    await expect(response.json()).resolves.toMatchObject({
      command: { id: COMMAND_ID, committed: true, replayed: false },
      result: { projectId: PROJECT_ID, disposition: 'ACTIVE_TRIAGE' },
    });
  });

  it('maps changed related evidence to a stale-review conflict', async () => {
    mocks.runLegacyContactedMigration.mockRejectedValueOnce({
      code: 'P0001',
      message: 'LEGACY_CONTACTED_EVIDENCE_STALE: related evidence changed after review',
    });

    const response = await POST(request({
      commandId: COMMAND_ID,
      expectedUpdatedAt: '2026-07-28T00:00:00.000Z',
      expectedEvidenceFingerprint: EVIDENCE_FINGERPRINT,
      disposition: 'ACTIVE_TRIAGE',
      reason: 'Current design evidence requires staff triage.',
    }), CONTEXT);

    expect(response.status).toBe(409);
  });
});
