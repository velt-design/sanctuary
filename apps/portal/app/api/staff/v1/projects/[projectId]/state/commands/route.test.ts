import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffContext: vi.fn(),
  runProjectOperationalStateCommand: vi.fn(),
  getAuthoritativeProjectWorkProjection: vi.fn(),
  recordMarketingConversionEvent: vi.fn(),
}));

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>(
    '@/lib/api/staffApi',
  );
  return { ...actual, requireStaffContext: mocks.requireStaffContext };
});

vi.mock('@/lib/projects/workItems/commands', () => ({
  runProjectOperationalStateCommand:
    mocks.runProjectOperationalStateCommand,
}));

vi.mock('@/lib/projects/workItems/getAuthoritativeProjectWorkProjection', () => ({
  getAuthoritativeProjectWorkProjection: mocks.getAuthoritativeProjectWorkProjection,
}));

vi.mock('@/lib/marketingAttribution/server', () => ({
  recordMarketingConversionEvent: mocks.recordMarketingConversionEvent,
  recentMarketingConversionOccurrence: (value: unknown) => {
    if (typeof value !== 'string') return null;
    const parsed = new Date(value);
    const age = Date.now() - parsed.valueOf();
    return Number.isFinite(parsed.valueOf())
      && age >= -5 * 60 * 1000
      && age <= 72 * 60 * 60 * 1000
      ? parsed.toISOString()
      : null;
  },
}));

import { POST } from './route';

const PROJECT_UUID = '11111111-1111-4111-8111-111111111111';
const COMMAND_ID = '22222222-2222-4222-8222-222222222222';
const PROJECT_ID = `proj_${PROJECT_UUID}`;
const SUPABASE = { from: vi.fn(), rpc: vi.fn() };
const PROJECT_WORK = {
  projectId: PROJECT_UUID,
  modelVersion: 2,
  operationalState: 'WAITING',
};
const CONTEXT = { params: Promise.resolve({ projectId: PROJECT_ID }) };

function stateEventQuery(occurredAt: string | null) {
  const result = {
    data: occurredAt ? { occurred_at: occurredAt } : null,
    error: null,
  };
  const builder: Record<string, any> = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  return builder;
}

function request(body: Record<string, unknown>) {
  return new Request(
    `http://localhost/api/staff/v1/projects/${PROJECT_ID}/state/commands`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

describe('POST /api/staff/v1/projects/[projectId]/state/commands', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-30T02:00:00.000Z'));
    vi.clearAllMocks();
    SUPABASE.from.mockReturnValue(
      stateEventQuery('2026-07-30T01:00:00.000Z'),
    );
    mocks.requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { id: 'user-1' }, role: 'staff' },
      supabase: SUPABASE,
    });
    mocks.runProjectOperationalStateCommand.mockResolvedValue({
      replayed: false,
      rowVersion: 2,
    });
    mocks.getAuthoritativeProjectWorkProjection.mockResolvedValue(PROJECT_WORK);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('preserves auth failure without invoking the state command', async () => {
    mocks.requireStaffContext.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: 'Forbidden' }, { status: 403 }),
    });

    const response = await POST(request({}), CONTEXT);

    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.runProjectOperationalStateCommand).not.toHaveBeenCalled();
  });

  it.each([
    [
      {
        command: 'WAIT',
        commandId: COMMAND_ID,
        expectedRowVersion: 1,
        waitingUntil: '2026-08-10T05:00:00.000Z',
        cancellationReason: 'Pausing open work',
      },
      'Waiting date and reason are required',
      'INVALID_COMMAND',
    ],
    [
      {
        command: 'WAIT',
        commandId: COMMAND_ID,
        expectedRowVersion: 1,
        waitingUntil: '2026-08-10T05:00:00.000Z',
        reason: 'Customer requested a pause',
      },
      'A reason is required to cancel remaining project work',
      'REASON_REQUIRED',
    ],
    [
      {
        command: 'CLOSE',
        commandId: COMMAND_ID,
        expectedRowVersion: 1,
        outcome: 'CANCELLED',
      },
      'A reason is required to cancel remaining project work',
      'REASON_REQUIRED',
    ],
    [
      {
        command: 'CLOSE',
        commandId: COMMAND_ID,
        expectedRowVersion: 1,
        outcome: 'SOMETHING_ELSE',
        cancellationReason: 'Closing remaining work',
      },
      'A valid close outcome is required',
      'INVALID_COMMAND',
    ],
  ])('enforces required non-Lost reasons: %s', async (body, error, code) => {
    const response = await POST(request(body), CONTEXT);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error, code });
    expect(mocks.runProjectOperationalStateCommand).not.toHaveBeenCalled();
  });

  it('returns an idempotent WAIT replay with normalized payload', async () => {
    mocks.runProjectOperationalStateCommand.mockResolvedValueOnce({
      replayed: true,
      rowVersion: 3,
    });

    const response = await POST(
      request({
        command: 'wait',
        commandId: COMMAND_ID,
        expectedRowVersion: 2,
        waitingUntil: '2026-08-10T05:00:00+00:00',
        reason: ' Customer requested a pause ',
        cancellationReason: ' Pause current obligations ',
      }),
      CONTEXT,
    );

    expect(response.status).toBe(200);
    expect(mocks.runProjectOperationalStateCommand).toHaveBeenCalledWith(
      SUPABASE,
      {
        projectId: PROJECT_UUID,
        commandId: COMMAND_ID,
        command: 'WAIT',
        payload: {
          expectedRowVersion: 2,
          waitingUntil: '2026-08-10T05:00:00.000Z',
          reason: 'Customer requested a pause',
          cancellationReason: 'Pause current obligations',
        },
      },
    );
    await expect(response.json()).resolves.toMatchObject({
      command: { committed: true, replayed: true, rowVersion: 3 },
      projectWork: PROJECT_WORK,
    });
  });

  it('records a structured lost conversion after a successful close command', async () => {
    const response = await POST(
      request({
        command: 'CLOSE',
        commandId: COMMAND_ID,
        expectedRowVersion: 1,
        outcome: 'LOST_BUDGET_PRICE',
      }),
      CONTEXT,
    );

    expect(response.status).toBe(200);
    expect(mocks.runProjectOperationalStateCommand).toHaveBeenCalledWith(
      SUPABASE,
      {
        projectId: PROJECT_UUID,
        commandId: COMMAND_ID,
        command: 'CLOSE',
        payload: {
          expectedRowVersion: 1,
          outcome: 'LOST_BUDGET_PRICE',
          note: null,
          cancellationReason: 'Project closed as Lost - Budget or price.',
        },
      },
    );
    expect(mocks.recordMarketingConversionEvent).toHaveBeenCalledWith({
      type: 'marketing.project_lost',
      projectId: PROJECT_UUID,
      occurredAt: '2026-07-30T01:00:00.000Z',
      payload: { outcome: 'LOST_BUDGET_PRICE' },
    });
  });

  it('repairs a recent lost-command replay at the original occurrence time', async () => {
    mocks.runProjectOperationalStateCommand.mockResolvedValueOnce({
      replayed: true,
      rowVersion: 2,
    });

    const response = await POST(
      request({
        command: 'CLOSE',
        commandId: COMMAND_ID,
        expectedRowVersion: 1,
        outcome: 'LOST_NO_RESPONSE',
        cancellationReason: 'No response after the agreed follow-up',
      }),
      CONTEXT,
    );

    expect(response.status).toBe(200);
    expect(mocks.recordMarketingConversionEvent).toHaveBeenCalledWith({
      type: 'marketing.project_lost',
      projectId: PROJECT_UUID,
      occurredAt: '2026-07-30T01:00:00.000Z',
      payload: { outcome: 'LOST_NO_RESPONSE' },
    });
  });

  it('does not turn an old lost-command replay into a fresh conversion', async () => {
    mocks.runProjectOperationalStateCommand.mockResolvedValueOnce({
      replayed: true,
      rowVersion: 2,
    });
    SUPABASE.from.mockReturnValueOnce(
      stateEventQuery('2026-07-20T01:00:00.000Z'),
    );

    const response = await POST(
      request({
        command: 'CLOSE',
        commandId: COMMAND_ID,
        expectedRowVersion: 1,
        outcome: 'LOST_NO_RESPONSE',
        cancellationReason: 'No response after the agreed follow-up',
      }),
      CONTEXT,
    );

    expect(response.status).toBe(200);
    expect(mocks.recordMarketingConversionEvent).not.toHaveBeenCalled();
  });

  it('does not record completed work as a lost conversion', async () => {
    const response = await POST(
      request({
        command: 'CLOSE',
        commandId: COMMAND_ID,
        expectedRowVersion: 1,
        outcome: 'COMPLETE',
        cancellationReason: 'All remaining obligations are complete',
      }),
      CONTEXT,
    );

    expect(response.status).toBe(200);
    expect(mocks.recordMarketingConversionEvent).not.toHaveBeenCalled();
  });

  it('maps stale state versions to 409', async () => {
    mocks.runProjectOperationalStateCommand.mockRejectedValueOnce(
      Object.assign(new Error('state changed'), { code: '40001' }),
    );

    const response = await POST(
      request({
        command: 'ACTIVATE',
        commandId: COMMAND_ID,
        expectedRowVersion: 1,
      }),
      CONTEXT,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: 'state changed',
      code: 'STALE_STATE',
    });
  });

  it('maps an unmarked legacy project to the stable not-found contract', async () => {
    mocks.runProjectOperationalStateCommand.mockRejectedValueOnce(
      Object.assign(new Error('PROJECT_WORK_MODEL_NOT_V2'), { code: 'P0002' }),
    );

    const response = await POST(
      request({
        command: 'ACTIVATE',
        commandId: COMMAND_ID,
        expectedRowVersion: 1,
      }),
      CONTEXT,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
