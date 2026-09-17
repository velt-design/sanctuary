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

  it.each(['RECORD_FIRST_ENQUIRY_EMAIL_SENT','RECORD_ENQUIRY_FOLLOW_UP_EMAIL_SENT','RECORD_ENQUIRY_CUSTOMER_REPLY','RECORD_QUOTE_FOLLOW_UP_EMAIL_SENT','RECORD_QUOTE_CUSTOMER_REPLY'])('rejects deferred recording %s without a database call', async command => {
    const response = await POST(request({ command, commandId: COMMAND_ID }), CONTEXT);
    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({ code: 'FOLLOW_UP_WORKFLOW_DEFERRED' });
    expect(mocks.runProjectConfirmationCommand).not.toHaveBeenCalled();
  });

  it('rejects an invalid real-world occurrence time', async () => {
    const response = await POST(
      request({
        command: 'RECORD_SITE_VISIT_COMPLETED',
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

  it('returns an idempotent site-visit confirmation replay', async () => {
    mocks.runProjectConfirmationCommand.mockResolvedValueOnce({
      replayed: true,
      rowVersion: 5,
    });

    const response = await POST(
      request({
        command: 'record_site_visit_completed',
        commandId: COMMAND_ID,
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
        command: 'RECORD_SITE_VISIT_COMPLETED',
        payload: {
          occurredAt: '2026-08-03T05:00:00.000Z',
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
        command: 'RECORD_SITE_VISIT_COMPLETED',
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
