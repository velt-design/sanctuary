import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffContext: vi.fn(),
  runEvent: vi.fn(),
  recordMarketingConversionEvent: vi.fn(),
  loadProjectAndContact: vi.fn(),
  from: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/api/staffApi', () => ({
  requireStaffContext: (...args: unknown[]) => mocks.requireStaffContext(...args),
  parseJsonBody: async (request: Request) => ({
    ok: true as const,
    body: await request.json(),
  }),
  jsonError: (message: string, status = 400) =>
    Response.json({ error: message }, { status }),
  jsonOk: (payload: Record<string, unknown>, status = 200) =>
    Response.json(payload, { status }),
}));

vi.mock('@/lib/api/siteVisitsServer', () => ({
  isMissingColumnError: () => false,
  loadProjectAndContact: (...args: unknown[]) =>
    mocks.loadProjectAndContact(...args),
  missingColumnFromError: () => null,
  parseIso: (value: unknown) => {
    if (typeof value !== 'string' || !value.trim()) return null;
    const parsed = new Date(value);
    return Number.isFinite(parsed.valueOf()) ? parsed.toISOString() : null;
  },
  salespersonSchemaMismatchMessage: () => null,
}));

vi.mock('@/lib/supabase/mappers', () => ({
  appIdFromUuid: (prefix: string, value: string) => `${prefix}_${value}`,
  uuidFromAppId: (value: string, prefix: string) => {
    const expectedPrefix = `${prefix}_`;
    if (!value.startsWith(expectedPrefix)) throw new Error('Invalid app id');
    return value.slice(expectedPrefix.length);
  },
}));

vi.mock('@/lib/types/project', () => ({
  normalizeProjectStatus: () => ({ status: 'SITE_VISIT' }),
}));

vi.mock('@/src/config/salesPeople', () => ({
  SALES_PEOPLE: [{ id: 'jordan', name: 'Jordan' }],
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
    const ageMs = Date.now() - parsed.valueOf();
    return Number.isFinite(parsed.valueOf())
      && ageMs >= -5 * 60 * 1000
      && ageMs <= 72 * 60 * 60 * 1000
      ? parsed.toISOString()
      : null;
  },
}));

import { POST } from './route';

const PROJECT_UUID = '11111111-1111-4111-8111-111111111111';
const EVENT_UUID = '22222222-2222-4222-8222-222222222222';
const PROJECT_ID = `proj_${PROJECT_UUID}`;
const START = '2026-07-30T03:00:00.000Z';
const END = '2026-07-30T04:00:00.000Z';
const CONFIRMED_AT = '2026-07-30T02:00:00.000Z';

function query(result: { data: unknown; error: unknown }) {
  const builder: Record<string, any> = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
    upsert: vi.fn(),
  };
  for (const method of ['select', 'eq', 'upsert']) {
    builder[method].mockReturnValue(builder);
  }
  return builder;
}

function configureQueries(writeResult?: { data: unknown; error: unknown }) {
  const project = query({
    data: { id: PROJECT_UUID, pipeline_stage: 'SITE_VISIT' },
    error: null,
  });
  const write = query(
    writeResult ?? {
      data: {
        id: EVENT_UUID,
        status: 'CONFIRMED',
        confirmed_at: CONFIRMED_AT,
      },
      error: null,
    },
  );
  const queries = [project, write];
  mocks.from.mockImplementation((table: string) => {
    const next = queries.shift();
    if (!next) throw new Error(`Unexpected ${table} query`);
    return next;
  });
  return { project, write };
}

function request(tentative: boolean) {
  return new Request('http://localhost/site-visit/book', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      start: START,
      end: END,
      salespersonId: 'jordan',
      notes: 'Bring colour samples',
      tentative,
    }),
  });
}

async function invoke(tentative: boolean) {
  return POST(request(tentative), {
    params: Promise.resolve({ projectId: PROJECT_ID }),
  });
}

describe('book site visit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-30T02:30:00.000Z'));
    mocks.requireStaffContext.mockReset().mockResolvedValue({
      ok: true,
      supabase: { from: mocks.from },
    });
    mocks.runEvent.mockReset().mockResolvedValue(undefined);
    mocks.recordMarketingConversionEvent.mockReset().mockResolvedValue(undefined);
    mocks.loadProjectAndContact.mockReset().mockResolvedValue({
      projectName: 'QA Project',
    });
    mocks.from.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('records a confirmed conversion only after the authoritative write returns confirmed_at', async () => {
    const { write } = configureQueries();

    const response = await invoke(false);

    expect(response.status).toBe(200);
    expect(write.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: PROJECT_UUID,
        status: 'CONFIRMED',
        scheduled_start: START,
        scheduled_end: END,
      }),
      { onConflict: 'project_id' },
    );
    expect(JSON.stringify(write.upsert.mock.calls)).not.toContain('confirmed_at');
    expect(JSON.stringify(write.upsert.mock.calls)).not.toContain('customer_notified');
    expect(write.select).toHaveBeenCalledWith('id, status, confirmed_at');
    expect(mocks.recordMarketingConversionEvent).toHaveBeenCalledWith({
      type: 'marketing.site_visit_booked',
      projectId: PROJECT_UUID,
      payload: {
        status: 'CONFIRMED',
        scheduledStart: START,
        scheduledEnd: END,
      },
      occurredAt: CONFIRMED_AT,
    });
    expect(write.upsert.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.recordMarketingConversionEvent.mock.invocationCallOrder[0],
    );
    expect(mocks.recordMarketingConversionEvent.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.runEvent.mock.invocationCallOrder[0],
    );
  });

  it('does not emit conversion or automation after a failed confirmed write', async () => {
    configureQueries({
      data: null,
      error: { message: 'write failed' },
    });

    const response = await invoke(false);

    expect(response.status).toBe(500);
    expect(mocks.recordMarketingConversionEvent).not.toHaveBeenCalled();
    expect(mocks.runEvent).not.toHaveBeenCalled();
  });

  it('persists a tentative visit without emitting a conversion', async () => {
    const { write } = configureQueries({
      data: {
        id: EVENT_UUID,
        status: 'TENTATIVE',
        confirmed_at: null,
      },
      error: null,
    });

    const response = await invoke(true);

    expect(response.status).toBe(200);
    expect(write.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'TENTATIVE' }),
      { onConflict: 'project_id' },
    );
    expect(mocks.recordMarketingConversionEvent).not.toHaveBeenCalled();
    expect(mocks.runEvent).not.toHaveBeenCalled();
  });
});
