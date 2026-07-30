import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffContext: vi.fn(),
  runProjectConfirmationCommand: vi.fn(),
  getAuthoritativeProjectWorkProjection: vi.fn(),
}));

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>(
    '@/lib/api/staffApi',
  );
  return { ...actual, requireStaffContext: mocks.requireStaffContext };
});

vi.mock('@/lib/projects/workItems/commands', () => ({
  runProjectConfirmationCommand: mocks.runProjectConfirmationCommand,
}));

vi.mock('@/lib/projects/workItems/getAuthoritativeProjectWorkProjection', () => ({
  getAuthoritativeProjectWorkProjection: mocks.getAuthoritativeProjectWorkProjection,
}));

import { POST } from './route';

const PROJECT_UUID = '11111111-1111-4111-8111-111111111111';
const COMMAND_ID = '22222222-2222-4222-8222-222222222222';
const QUOTE_VERSION_UUID = '33333333-3333-4333-8333-333333333333';
const PROJECT_ID = `proj_${PROJECT_UUID}`;
const SUPABASE = { from: vi.fn(), rpc: vi.fn() };
const PROJECT_WORK = { projectId: PROJECT_UUID, modelVersion: 2 };
const CONTEXT = { params: Promise.resolve({ projectId: PROJECT_ID }) };

function request(body: Record<string, unknown>) {
  return new Request(
    `http://localhost/api/staff/v1/projects/${PROJECT_ID}/confirmations/commands`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

describe('POST /api/staff/v1/projects/[projectId]/confirmations/commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mocks.requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { id: 'user-1' }, role: 'staff' },
      supabase: SUPABASE,
    });
    mocks.runProjectConfirmationCommand.mockResolvedValue({
      replayed: false,
      rowVersion: 4,
    });
    mocks.getAuthoritativeProjectWorkProjection.mockResolvedValue(PROJECT_WORK);
  });

  it.each([
    [undefined, 'Quote version is required'],
    [`qv_${QUOTE_VERSION_UUID}`, 'Quote version is required'],
    ['not-a-uuid', 'Quote version is required'],
  ])(
    'requires a raw authoritative quote-version UUID: %s',
    async (subjectId, error) => {
      const response = await POST(
        request({
          command: 'RECORD_QUOTE_CUSTOMER_REPLY',
          commandId: COMMAND_ID,
          ...(subjectId ? { subjectId } : {}),
        }),
        CONTEXT,
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error,
        code: 'INVALID_COMMAND',
      });
      expect(mocks.runProjectConfirmationCommand).not.toHaveBeenCalled();
    },
  );

  it('rejects an invalid real-world occurrence time', async () => {
    const response = await POST(
      request({
        command: 'RECORD_FIRST_ENQUIRY_EMAIL_SENT',
        commandId: COMMAND_ID,
        occurredAt: 'not-a-date',
      }),
      CONTEXT,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Invalid occurrence time',
      code: 'INVALID_COMMAND',
    });
  });

  it('returns an idempotent quote confirmation replay with exact subject semantics', async () => {
    mocks.runProjectConfirmationCommand.mockResolvedValueOnce({
      replayed: true,
      rowVersion: 5,
    });

    const response = await POST(
      request({
        command: 'record_quote_follow_up_email_sent',
        commandId: COMMAND_ID,
        subjectId: QUOTE_VERSION_UUID,
        occurredAt: '2026-08-03T05:00:00+00:00',
      }),
      CONTEXT,
    );

    expect(response.status).toBe(200);
    expect(mocks.runProjectConfirmationCommand).toHaveBeenCalledWith(
      SUPABASE,
      {
        projectId: PROJECT_UUID,
        commandId: COMMAND_ID,
        command: 'RECORD_QUOTE_FOLLOW_UP_EMAIL_SENT',
        payload: {
          occurredAt: '2026-08-03T05:00:00.000Z',
          subjectKind: 'QUOTE_VERSION',
          subjectId: QUOTE_VERSION_UUID,
        },
      },
    );
    await expect(response.json()).resolves.toEqual({
      command: {
        id: COMMAND_ID,
        committed: true,
        replayed: true,
        rowVersion: 5,
      },
      projectWork: PROJECT_WORK,
    });
  });

  it('reports committed confirmation when projection refresh fails', async () => {
    mocks.getAuthoritativeProjectWorkProjection.mockRejectedValueOnce(
      new Error('refresh unavailable'),
    );
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await POST(
      request({
        command: 'RECORD_ENQUIRY_CUSTOMER_REPLY',
        commandId: COMMAND_ID,
        occurredAt: '2026-08-03T05:00:00.000Z',
      }),
      CONTEXT,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      command: { committed: true, replayed: false, rowVersion: 4 },
      refreshRequired: true,
    });
  });
});
