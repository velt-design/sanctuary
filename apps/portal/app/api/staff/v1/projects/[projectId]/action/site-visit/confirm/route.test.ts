import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffContext: vi.fn(),
  runEvent: vi.fn(),
  recordMarketingConversionEvent: vi.fn(),
  from: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/api/staffApi', () => ({
  requireStaffContext: (...args: unknown[]) => mocks.requireStaffContext(...args),
  parseJsonBody: async (request: Request) => {
    try {
      return { ok: true as const, body: await request.json() };
    } catch {
      return { ok: false as const, error: 'Invalid JSON body' };
    }
  },
  jsonError: (message: string, status = 400) =>
    Response.json({ error: message }, { status }),
  jsonOk: (payload: Record<string, unknown>, status = 200) =>
    Response.json(payload, { status }),
}));

vi.mock('@/lib/supabase/mappers', () => ({
  uuidFromAppId: (value: string, prefix: string) => {
    if (prefix === 'proj' && value.startsWith('proj_')) return value.slice(5);
    if (prefix === 'sv' && value.startsWith('sv_')) return value.slice(3);
    throw new Error('Invalid app id');
  },
}));

vi.mock('@/lib/automation/AutomationRunner', () => ({
  automationRunner: {
    runEvent: (...args: unknown[]) => mocks.runEvent(...args),
  },
}));

vi.mock('@/lib/marketingAttribution/server', () => ({
  recordMarketingConversionEvent: (...args: unknown[]) =>
    mocks.recordMarketingConversionEvent(...args),
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

type QueryResult = {
  data: unknown;
  error: { message?: string; code?: string } | null;
};

const PROJECT_UUID = '11111111-1111-4111-8111-111111111111';
const SITE_VISIT_UUID = '22222222-2222-4222-8222-222222222222';
const PROJECT_ID = `proj_${PROJECT_UUID}`;
const SITE_VISIT_ID = `sv_${SITE_VISIT_UUID}`;
const SCHEDULED_START = '2026-08-01T00:00:00.000Z';
const SCHEDULED_END = '2026-08-01T01:00:00.000Z';

function selectQuery(result: QueryResult) {
  const builder: Record<string, any> = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn().mockResolvedValue(result),
  };
  for (const method of ['select', 'eq', 'order']) {
    builder[method].mockReturnValue(builder);
  }
  return builder;
}

function updateQuery(result: QueryResult) {
  const builder: Record<string, any> = {
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  for (const method of ['update', 'eq', 'select']) {
    builder[method].mockReturnValue(builder);
  }
  return builder;
}

function eventRow(
  status: 'TENTATIVE' | 'CONFIRMED' | 'CANCELLED',
  confirmedAt: string | null,
) {
  return {
    id: SITE_VISIT_UUID,
    status,
    scheduled_start: SCHEDULED_START,
    scheduled_end: SCHEDULED_END,
    assigned_sales_owner_id: 'jordan',
    notes: 'Bring sample colours',
    confirmed_at: confirmedAt,
    updated_at: '2026-07-30T01:45:00.000Z',
  };
}

function configureQueries(input?: {
  status?: 'TENTATIVE' | 'CONFIRMED' | 'CANCELLED';
  loadedConfirmedAt?: string | null;
  updateResult?: QueryResult;
}) {
  const status = input?.status ?? 'TENTATIVE';
  const loadedConfirmedAt =
    input && Object.prototype.hasOwnProperty.call(input, 'loadedConfirmedAt')
      ? input.loadedConfirmedAt ?? null
      : status === 'CONFIRMED'
        ? '2026-07-30T00:00:00.000Z'
        : null;
  const load = selectQuery({
    data: [
      eventRow(
        status,
        loadedConfirmedAt,
      ),
    ],
    error: null,
  });
  const update = updateQuery(
    input?.updateResult ?? {
      data: {
        id: SITE_VISIT_UUID,
        status: 'CONFIRMED',
        confirmed_at: '2026-07-30T01:00:00.000Z',
        updated_at: '2026-07-30T01:00:00.000Z',
      },
      error: null,
    },
  );
  const queries = input?.status === 'CONFIRMED' || input?.status === 'CANCELLED'
    ? [load]
    : [load, update];
  mocks.from.mockImplementation((table: string) => {
    if (table !== 'site_visit_events') throw new Error(`Unexpected table ${table}`);
    const next = queries.shift();
    if (!next) throw new Error('Unexpected site_visit_events query');
    return next;
  });
  return { load, update };
}

function request() {
  return new Request('http://localhost/site-visit/confirm', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ siteVisitEventId: SITE_VISIT_ID }),
  });
}

async function invoke() {
  return POST(request(), {
    params: Promise.resolve({ projectId: PROJECT_ID }),
  });
}

describe('confirm site visit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-30T02:00:00.000Z'));
    mocks.requireStaffContext.mockReset().mockResolvedValue({
      ok: true,
      supabase: { from: mocks.from },
    });
    mocks.runEvent.mockReset().mockResolvedValue(undefined);
    mocks.recordMarketingConversionEvent.mockReset().mockResolvedValue(undefined);
    mocks.from.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('confirms TENTATIVE with a compare-and-swap before recording the authoritative occurrence', async () => {
    const { update } = configureQueries();

    const response = await invoke();

    expect(response.status).toBe(200);
    expect(update.update).toHaveBeenCalledWith({ status: 'CONFIRMED' });
    expect(update.eq).toHaveBeenNthCalledWith(1, 'project_id', PROJECT_UUID);
    expect(update.eq).toHaveBeenNthCalledWith(2, 'id', SITE_VISIT_UUID);
    expect(update.eq).toHaveBeenNthCalledWith(3, 'status', 'TENTATIVE');
    expect(update.select).toHaveBeenCalledWith('id, status, confirmed_at');
    expect(mocks.recordMarketingConversionEvent).toHaveBeenCalledWith({
      type: 'marketing.site_visit_booked',
      projectId: PROJECT_UUID,
      payload: {
        status: 'CONFIRMED',
        scheduledStart: SCHEDULED_START,
        scheduledEnd: SCHEDULED_END,
      },
      occurredAt: '2026-07-30T01:00:00.000Z',
    });
    expect(update.update.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.recordMarketingConversionEvent.mock.invocationCallOrder[0],
    );
    expect(mocks.runEvent).toHaveBeenCalledOnce();
    expect(JSON.stringify(update.update.mock.calls)).not.toContain('customer_notified');
  });

  it('returns a persistence failure without emitting automation or conversion events', async () => {
    configureQueries({
      updateResult: {
        data: null,
        error: { message: 'database unavailable' },
      },
    });

    const response = await invoke();

    expect(response.status).toBe(500);
    expect(mocks.recordMarketingConversionEvent).not.toHaveBeenCalled();
    expect(mocks.runEvent).not.toHaveBeenCalled();
  });

  it('fails a lost TENTATIVE compare-and-swap without emitting events', async () => {
    configureQueries({
      updateResult: { data: null, error: null },
    });

    const response = await invoke();

    expect(response.status).toBe(409);
    expect(mocks.recordMarketingConversionEvent).not.toHaveBeenCalled();
    expect(mocks.runEvent).not.toHaveBeenCalled();
  });

  it('fails closed when a confirmed write has no immutable confirmation time', async () => {
    configureQueries({
      updateResult: {
        data: {
          id: SITE_VISIT_UUID,
          status: 'CONFIRMED',
          confirmed_at: null,
        },
        error: null,
      },
    });

    const response = await invoke();

    expect(response.status).toBe(500);
    expect(mocks.recordMarketingConversionEvent).not.toHaveBeenCalled();
    expect(mocks.runEvent).not.toHaveBeenCalled();
  });

  it('repairs a recent confirmed replay with the persisted confirmation time', async () => {
    configureQueries({
      status: 'CONFIRMED',
      loadedConfirmedAt: '2026-07-30T00:30:00.000Z',
    });

    const response = await invoke();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      alreadyConfirmed: true,
      trackingReplayed: true,
    });
    expect(mocks.recordMarketingConversionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        occurredAt: '2026-07-30T00:30:00.000Z',
      }),
    );
    expect(mocks.runEvent).toHaveBeenCalledOnce();
  });

  it('does not create a fresh conversion for an old confirmed replay', async () => {
    configureQueries({
      status: 'CONFIRMED',
      loadedConfirmedAt: '2026-07-20T00:00:00.000Z',
    });

    const response = await invoke();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      alreadyConfirmed: true,
      trackingReplayed: false,
    });
    expect(mocks.recordMarketingConversionEvent).not.toHaveBeenCalled();
    expect(mocks.runEvent).not.toHaveBeenCalled();
  });

  it('rejects a non-confirmable status without mutating or emitting events', async () => {
    const { update } = configureQueries({ status: 'CANCELLED' });

    const response = await invoke();

    expect(response.status).toBe(409);
    expect(update.update).not.toHaveBeenCalled();
    expect(mocks.recordMarketingConversionEvent).not.toHaveBeenCalled();
    expect(mocks.runEvent).not.toHaveBeenCalled();
  });
});
