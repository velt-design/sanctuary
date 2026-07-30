import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffContext: vi.fn(),
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
  isUniqueViolation: () => false,
  loadEmailTemplateSubject: vi.fn(),
  loadProjectAndContact: vi.fn(),
  makeIdempotencyKey: (parts: string[]) => parts.join(':'),
  missingColumnFromError: () => null,
  parseIso: (value: unknown) => {
    if (typeof value !== 'string' || !value.trim()) return null;
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
  },
  salespersonSchemaMismatchMessage: () => null,
}));

vi.mock('@/lib/supabase/mappers', () => ({
  uuidFromAppId: (value: string, prefix: string) => {
    const expectedPrefix = `${prefix}_`;
    if (!value.startsWith(expectedPrefix)) throw new Error('Invalid app id');
    return value.slice(expectedPrefix.length);
  },
}));

vi.mock('@/src/config/salesPeople', () => ({
  SALES_PEOPLE: [{ id: 'jordan', name: 'Jordan' }],
}));

import { POST } from './route';

const PROJECT_UUID = '11111111-1111-4111-8111-111111111111';
const EVENT_UUID = '22222222-2222-4222-8222-222222222222';

function selectQuery() {
  const builder: Record<string, any> = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn().mockResolvedValue({
      data: [{
        id: EVENT_UUID,
        status: 'TENTATIVE',
        scheduled_start: '2026-08-01T00:00:00.000Z',
        notes: 'Old note',
        updated_at: '2026-07-30T00:00:00.000Z',
      }],
      error: null,
    }),
  };
  for (const method of ['select', 'eq', 'order']) {
    builder[method].mockReturnValue(builder);
  }
  return builder;
}

function updateQuery() {
  const result = { data: null, error: null };
  const builder: Record<string, any> = {
    update: vi.fn(),
    eq: vi.fn(),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  for (const method of ['update', 'eq']) {
    builder[method].mockReturnValue(builder);
  }
  return builder;
}

describe('reschedule site visit', () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.requireStaffContext.mockReset().mockResolvedValue({
      ok: true,
      supabase: { from: mocks.from },
    });
  });

  it('persists trimmed modal notes with the date, time, and salesperson', async () => {
    const load = selectQuery();
    const update = updateQuery();
    const queries = [load, update];
    mocks.from.mockImplementation((table: string) => {
      if (table !== 'site_visit_events') throw new Error(`Unexpected table ${table}`);
      const next = queries.shift();
      if (!next) throw new Error('Unexpected site_visit_events query');
      return next;
    });

    const response = await POST(
      new Request('http://localhost/site-visit/reschedule', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          siteVisitEventId: `sv_${EVENT_UUID}`,
          start: '2026-08-02T00:00:00.000Z',
          end: '2026-08-02T01:00:00.000Z',
          salespersonId: 'jordan',
          notes: '  Bring updated colour samples  ',
          notifyCustomer: false,
        }),
      }),
      {
        params: Promise.resolve({ projectId: `proj_${PROJECT_UUID}` }),
      },
    );

    expect(response.status).toBe(200);
    expect(update.update).toHaveBeenCalledWith({
      scheduled_start: '2026-08-02T00:00:00.000Z',
      scheduled_end: '2026-08-02T01:00:00.000Z',
      status: 'TENTATIVE',
      assigned_sales_owner_id: 'jordan',
      assigned_sales_owner: 'jordan',
      notes: 'Bring updated colour samples',
    });
  });
});
