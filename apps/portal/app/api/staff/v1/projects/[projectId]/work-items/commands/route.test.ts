import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffContext: vi.fn(),
  runProjectWorkItemCommand: vi.fn(),
  getAuthoritativeProjectWorkProjection: vi.fn(),
}));

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>(
    '@/lib/api/staffApi',
  );
  return { ...actual, requireStaffContext: mocks.requireStaffContext };
});

vi.mock('@/lib/projects/workItems/commands', () => ({
  runProjectWorkItemCommand: mocks.runProjectWorkItemCommand,
}));

vi.mock('@/lib/projects/workItems/getAuthoritativeProjectWorkProjection', () => ({
  getAuthoritativeProjectWorkProjection: mocks.getAuthoritativeProjectWorkProjection,
}));

import { POST } from './route';

const PROJECT_UUID = '11111111-1111-4111-8111-111111111111';
const COMMAND_ID = '22222222-2222-4222-8222-222222222222';
const WORK_ITEM_ID = '33333333-3333-4333-8333-333333333333';
const PROJECT_ID = `proj_${PROJECT_UUID}`;
const SUPABASE = { from: vi.fn(), rpc: vi.fn() };
const PROJECT_WORK = { projectId: PROJECT_UUID, modelVersion: 2 };
const CONTEXT = { params: Promise.resolve({ projectId: PROJECT_ID }) };

function request(body: Record<string, unknown>) {
  return new Request(
    `http://localhost/api/staff/v1/projects/${PROJECT_ID}/work-items/commands`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'req-work-command',
      },
      body: JSON.stringify(body),
    },
  );
}

describe('POST /api/staff/v1/projects/[projectId]/work-items/commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mocks.requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { id: 'user-1' }, role: 'staff' },
      supabase: SUPABASE,
    });
    mocks.runProjectWorkItemCommand.mockResolvedValue({
      replayed: false,
      rowVersion: 4,
    });
    mocks.getAuthoritativeProjectWorkProjection.mockResolvedValue(PROJECT_WORK);
  });

  it('returns before parsing or invoking commands when auth fails', async () => {
    mocks.requireStaffContext.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const response = await POST(request({}), CONTEXT);

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.runProjectWorkItemCommand).not.toHaveBeenCalled();
  });

  it.each([
    [
      {
        command: 'COMPLETE',
        commandId: 'not-a-uuid',
        workItemId: WORK_ITEM_ID,
        expectedRowVersion: 1,
      },
      'Invalid work-item command',
    ],
    [
      {
        command: 'COMPLETE',
        commandId: COMMAND_ID,
        workItemId: 'not-a-uuid',
        expectedRowVersion: 1,
      },
      'Work item and current row version are required',
    ],
    [
      {
        command: 'CREATE',
        commandId: COMMAND_ID,
        title: 'Urgent customer reply',
        responsibilityArea: 'CUSTOMER',
        dueAt: '2026-08-01T03:00:00.000Z',
        priority: 'CRITICAL',
      },
      'A reason is required for Critical work',
    ],
  ])('rejects invalid UUID or payload contracts: %s', async (body, message) => {
    const response = await POST(request(body), CONTEXT);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: message,
      code: 'INVALID_COMMAND',
    });
    expect(mocks.runProjectWorkItemCommand).not.toHaveBeenCalled();
  });

  it.each([
    'Call customer',
    'Book site visit',
  ])('rejects retired manual work identity: %s', async (title) => {
    const response = await POST(
      request({
        command: 'CREATE',
        commandId: COMMAND_ID,
        title,
        responsibilityArea: 'CUSTOMER',
        dueAt: '2026-08-01T03:00:00.000Z',
      }),
      CONTEXT,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Call and Site Visit work cannot be created in Project Work',
      code: 'INVALID_COMMAND',
    });
    expect(mocks.runProjectWorkItemCommand).not.toHaveBeenCalled();
  });

  it('returns an idempotent replay with the refreshed projection', async () => {
    mocks.runProjectWorkItemCommand.mockResolvedValueOnce({
      replayed: true,
      rowVersion: 7,
    });
    const response = await POST(
      request({
        command: ' complete ',
        commandId: COMMAND_ID,
        workItemId: WORK_ITEM_ID,
        expectedRowVersion: 6,
        outcome: ' Customer replied ',
      }),
      CONTEXT,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.runProjectWorkItemCommand).toHaveBeenCalledWith(SUPABASE, {
      projectId: PROJECT_UUID,
      commandId: COMMAND_ID,
      command: 'COMPLETE',
      payload: {
        workItemId: WORK_ITEM_ID,
        expectedRowVersion: 6,
        outcome: 'Customer replied',
      },
    });
    await expect(response.json()).resolves.toEqual({
      command: {
        id: COMMAND_ID,
        committed: true,
        replayed: true,
        rowVersion: 7,
      },
      projectWork: PROJECT_WORK,
    });
  });

  it('maps an atomic decision-review replacement to one semantic command', async () => {
    const response = await POST(
      request({
        command: 'REPLACE_REVIEW',
        commandId: COMMAND_ID,
        workItemId: WORK_ITEM_ID,
        expectedRowVersion: 3,
        reason: 'Customer asked us to prepare a revised concept',
        title: 'Prepare revised concept',
        responsibilityArea: 'DESIGN',
        dueAt: '2026-08-04T05:00:00.000Z',
      }),
      CONTEXT,
    );

    expect(response.status).toBe(200);
    expect(mocks.runProjectWorkItemCommand).toHaveBeenCalledWith(SUPABASE, {
      projectId: PROJECT_UUID,
      commandId: COMMAND_ID,
      command: 'REPLACE_REVIEW',
      payload: {
        workItemId: WORK_ITEM_ID,
        expectedRowVersion: 3,
        reason: 'Customer asked us to prepare a revised concept',
        title: 'Prepare revised concept',
        responsibilityArea: 'DESIGN',
        dueAt: '2026-08-04T05:00:00.000Z',
        assigneeUserId: null,
        priority: 'NORMAL',
        priorityReason: null,
      },
    });
  });

  it('requires an explicit reason when replacing a decision review', async () => {
    const response = await POST(
      request({
        command: 'REPLACE_REVIEW',
        commandId: COMMAND_ID,
        workItemId: WORK_ITEM_ID,
        expectedRowVersion: 3,
        title: 'Prepare revised concept',
        responsibilityArea: 'DESIGN',
        dueAt: '2026-08-04T05:00:00.000Z',
      }),
      CONTEXT,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'A reason is required to replace a decision review',
      code: 'INVALID_COMMAND',
    });
    expect(mocks.runProjectWorkItemCommand).not.toHaveBeenCalled();
  });

  it('maps stale command receipts or row versions to 409', async () => {
    mocks.runProjectWorkItemCommand.mockRejectedValueOnce(
      Object.assign(new Error('stale row version'), { code: '40001' }),
    );

    const response = await POST(
      request({
        command: 'CANCEL',
        commandId: COMMAND_ID,
        workItemId: WORK_ITEM_ID,
        expectedRowVersion: 2,
        reason: 'No longer required',
      }),
      CONTEXT,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: 'stale row version',
      code: 'STALE_STATE',
    });
  });

  it('does not misreport a committed command when projection refresh fails', async () => {
    mocks.getAuthoritativeProjectWorkProjection.mockRejectedValueOnce(
      new Error('refresh unavailable'),
    );
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await POST(
      request({
        command: 'BLOCK',
        commandId: COMMAND_ID,
        workItemId: WORK_ITEM_ID,
        expectedRowVersion: 2,
        reason: 'Waiting for customer',
      }),
      CONTEXT,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      command: {
        id: COMMAND_ID,
        committed: true,
        replayed: false,
        rowVersion: 4,
      },
      refreshRequired: true,
    });
  });
});
