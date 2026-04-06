import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffSession = vi.fn();
const formatSupabaseError = vi.fn();
const appIdFromUuid = vi.fn();
const normalizeProjectStatus = vi.fn();

const selectCalls = vi.fn();
let queryPlans: Array<{ unscheduledRes: any; eventsRes: any }> = [];
let variantIndexBySelect = new Map<string, number>();

function makeQueryBuilder(variantIndex: number) {
  let kind: 'unscheduled' | 'events' | null = null;

  const builder: any = {
    eq(column: string, value: unknown) {
      if (column === 'status' && value === 'UNSCHEDULED') {
        kind = 'unscheduled';
      }
      return builder;
    },
    in(column: string) {
      if (column === 'status') kind = 'events';
      return builder;
    },
    not() {
      return builder;
    },
    gte() {
      return builder;
    },
    lte() {
      return builder;
    },
    then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
      const plan = queryPlans[variantIndex];
      if (!plan) {
        return Promise.reject(new Error(`Missing query plan for variant ${variantIndex}`)).then(resolve, reject);
      }
      const result = kind === 'unscheduled' ? plan.unscheduledRes : kind === 'events' ? plan.eventsRes : null;
      if (!result) {
        return Promise.reject(new Error(`Query kind was not resolved for variant ${variantIndex}`)).then(resolve, reject);
      }
      return Promise.resolve(result).then(resolve, reject);
    },
  };

  return builder;
}

vi.mock('@/lib/api/staffApi', () => ({
  jsonError: (error: string, status: number) => new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } }),
  jsonOk: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  requireStaffSession,
}));

vi.mock('@/lib/supabase/apiErrors', () => ({
  formatSupabaseError,
}));

vi.mock('@/lib/supabase/mappers', () => ({
  appIdFromUuid,
}));

vi.mock('@/lib/types/project', () => ({
  normalizeProjectStatus,
}));

vi.mock('@/src/config/salesPeople', () => ({
  SALES_PEOPLE: [{ id: 'bruce', label: 'Bruce' }],
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServer: {
    from: (table: string) => {
      if (table !== 'site_visit_events') throw new Error(`Unexpected table ${table}`);
      return {
        select: (select: string) => {
          selectCalls(select);
          let variantIndex = variantIndexBySelect.get(select);
          if (typeof variantIndex === 'undefined') {
            variantIndex = variantIndexBySelect.size;
            variantIndexBySelect.set(select, variantIndex);
          }
          return makeQueryBuilder(variantIndex);
        },
      };
    },
  },
}));

describe('GET /api/staff/v1/site-visits', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffSession.mockReset();
    formatSupabaseError.mockReset();
    appIdFromUuid.mockReset();
    normalizeProjectStatus.mockReset();
    selectCalls.mockReset();
    queryPlans = [];
    variantIndexBySelect = new Map();

    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'staff' });
    formatSupabaseError.mockReturnValue({ status: 503, message: 'site visits unavailable' });
    appIdFromUuid.mockImplementation((prefix: string, uuid: string) => `${prefix}:${uuid}`);
    normalizeProjectStatus.mockImplementation((value: string | null | undefined) => ({
      status: String(value ?? '').toUpperCase() === 'SITE_VISIT' ? 'SITE_VISIT' : 'NEW',
    }));
  });

  it('returns 401 when no staff session exists', async () => {
    requireStaffSession.mockResolvedValue(null);

    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/staff/v1/site-visits?from=2026-04-01&to=2026-04-30'));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 when from or to are missing or invalid', async () => {
    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/staff/v1/site-visits?from=bad'));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'from and to are required (ISO)' });
  });

  it('returns mapped site-visit payloads and filters non-site-visit projects', async () => {
    queryPlans = [
      {
        unscheduledRes: {
          data: [
            {
              id: 'sv-1',
              project_id: 'proj-1',
              status: 'UNSCHEDULED',
              scheduled_start: null,
              scheduled_end: null,
              assigned_sales_owner_id: 'bruce',
              notes: 'Bring plans',
              customer_notified: true,
              last_notified_at: null,
              cancel_reason: null,
              created_at: '2026-04-01T00:00:00.000Z',
              updated_at: '2026-04-01T00:00:00.000Z',
              projects: {
                id: 'proj-1',
                name: 'Pergola A',
                region: 'North',
                site_address: '123 Lane',
                pipeline_stage: 'SITE_VISIT',
                site_visit_priority_tier: 2,
                contact_id: 'ct-1',
                contacts: { id: 'ct-1', name: 'Jamie', email: 'jamie@example.com', phone: '021' },
              },
            },
            {
              id: 'sv-2',
              project_id: 'proj-2',
              status: 'UNSCHEDULED',
              scheduled_start: null,
              scheduled_end: null,
              projects: {
                id: 'proj-2',
                name: 'Ignore Me',
                pipeline_stage: 'QUOTING',
                contacts: { id: 'ct-2', name: 'Skip', email: null, phone: null },
              },
            },
          ],
          error: null,
        },
        eventsRes: {
          data: [
            {
              id: 'sv-3',
              project_id: 'proj-3',
              status: 'CONFIRMED',
              scheduled_start: '2026-04-10T01:00:00.000Z',
              scheduled_end: '2026-04-10T02:00:00.000Z',
              assigned_sales_owner_id: 'bruce',
              notes: 'On site',
              customer_notified: false,
              last_notified_at: '2026-04-09T00:00:00.000Z',
              cancel_reason: null,
              created_at: '2026-04-02T00:00:00.000Z',
              updated_at: '2026-04-02T00:00:00.000Z',
              projects: {
                id: 'proj-3',
                name: 'Pergola B',
                region: 'South',
                site_address: '45 Drive',
                pipeline_stage: 'SITE_VISIT',
                site_visit_priority_tier: 1,
                contact_id: 'ct-3',
                contacts: { id: 'ct-3', name: 'Taylor', email: 'taylor@example.com', phone: '022' },
              },
            },
            {
              id: 'sv-4',
              project_id: 'proj-4',
              status: 'CONFIRMED',
              scheduled_start: '2026-04-11T01:00:00.000Z',
              scheduled_end: '2026-04-11T02:00:00.000Z',
              projects: {
                id: 'proj-4',
                name: 'Not Site Visit',
                pipeline_stage: 'DEPOSIT',
                contacts: { id: 'ct-4', name: 'Skip', email: null, phone: null },
              },
            },
          ],
          error: null,
        },
      },
    ];

    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/staff/v1/site-visits?from=2026-04-01&to=2026-04-30'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      generatedAt: expect.any(String),
      salesPeople: [{ id: 'bruce', label: 'Bruce' }],
      unscheduled: [
        expect.objectContaining({
          id: 'sv:sv-1',
          projectId: 'proj:proj-1',
          salespersonId: 'bruce',
          priorityTier: 2,
          project: expect.objectContaining({
            id: 'proj:proj-1',
            name: 'Pergola A',
            pipelineStage: 'SITE_VISIT',
          }),
          contact: expect.objectContaining({
            id: 'ct:ct-1',
            name: 'Jamie',
          }),
        }),
      ],
      events: [
        expect.objectContaining({
          id: 'sv:sv-3',
          projectId: 'proj:proj-3',
          scheduledStart: '2026-04-10T01:00:00.000Z',
          priorityTier: 1,
          project: expect.objectContaining({
            id: 'proj:proj-3',
            name: 'Pergola B',
          }),
        }),
      ],
    });
  });

  it('falls back to a later select variant after a missing-column error', async () => {
    queryPlans = [
      {
        unscheduledRes: { data: null, error: { code: 'PGRST204', message: "'region' column missing" } },
        eventsRes: { data: null, error: { code: 'PGRST204', message: "'region' column missing" } },
      },
      {
        unscheduledRes: { data: [], error: null },
        eventsRes: { data: [], error: null },
      },
    ];

    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/staff/v1/site-visits?from=2026-04-01&to=2026-04-30'));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      generatedAt: expect.any(String),
      unscheduled: [],
      events: [],
      salesPeople: [{ id: 'bruce', label: 'Bruce' }],
    });
    expect(selectCalls).toHaveBeenCalledTimes(4);
    expect(formatSupabaseError).not.toHaveBeenCalled();
  });

  it('formats and returns non-missing-column query failures', async () => {
    const err = { code: 'XX000', message: 'database offline' };
    queryPlans = [
      {
        unscheduledRes: { data: null, error: err },
        eventsRes: { data: [], error: null },
      },
    ];

    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/staff/v1/site-visits?from=2026-04-01&to=2026-04-30'));

    expect(formatSupabaseError).toHaveBeenCalledWith('site_visit_events', err);
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: 'site visits unavailable' });
  });
});
