import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffSession = vi.fn();
const formatSupabaseError = vi.fn();
const appIdFromUuid = vi.fn();
const normalizeProjectStatus = vi.fn();
const fromMock = vi.fn();
const selectCalls: string[] = [];

let plan: { unscheduledRes: any; eventsRes: any } | null = null;

function makeQueryBuilder(kind: 'unscheduled' | 'events' | null = null) {
  let resolvedKind = kind;
  const builder: any = {
    eq(column: string, value: unknown) {
      if (column === 'status' && value === 'UNSCHEDULED') resolvedKind = 'unscheduled';
      return builder;
    },
    in(column: string) {
      if (column === 'status') resolvedKind = 'events';
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
      if (!plan) return Promise.reject(new Error('Missing query plan')).then(resolve, reject);
      const result = resolvedKind === 'unscheduled' ? plan.unscheduledRes : plan.eventsRes;
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return builder;
}

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi');
  return {
    ...actual,
    requireStaffSession,
  };
});

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
  supabaseServiceRole: {
    from: (table: string) => {
      fromMock(table);
      if (table !== 'site_visit_events') throw new Error(`Unexpected table ${table}`);
      return {
        select: (select: string) => {
          selectCalls.push(select);
          return makeQueryBuilder();
        },
      };
    },
  },
}));

describe('GET /api/staff/v1/site-visits diagnostics', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffSession.mockReset();
    formatSupabaseError.mockReset();
    appIdFromUuid.mockReset();
    normalizeProjectStatus.mockReset();
    fromMock.mockReset();
    selectCalls.length = 0;
    plan = null;

    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'staff' });
    formatSupabaseError.mockReturnValue({ status: 503, message: 'site visits unavailable' });
    appIdFromUuid.mockImplementation((prefix: string, uuid: string) => `${prefix}:${uuid}`);
    normalizeProjectStatus.mockImplementation((value: string | null | undefined) => ({
      status: String(value ?? '').toUpperCase() === 'SITE_VISIT' ? 'SITE_VISIT' : 'NEW',
    }));
  });

  it('returns diagnostics headers on success', async () => {
    plan = {
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
            customer_notified: false,
            last_notified_at: null,
            cancel_reason: null,
            created_at: '2026-04-01T00:00:00.000Z',
            updated_at: '2026-04-01T00:00:00.000Z',
            projects: {
              id: 'proj-1',
              name: 'Pergola A',
              pipeline_stage: 'SITE_VISIT',
              site_visit_priority_tier: 2,
              contact_id: 'ct-1',
              contacts: { id: 'ct-1', name: 'Jamie', email: 'jamie@example.com', phone: '021' },
            },
          },
        ],
        error: null,
      },
      eventsRes: { data: [], error: null },
    };

    const mod = await import('./route');
    const res = await mod.GET(
      new Request('http://localhost/api/staff/v1/site-visits?from=2026-04-01&to=2026-04-30', {
        headers: { 'x-request-id': 'req_site_visits_ok' },
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      generatedAt: expect.any(String),
      salesPeople: [{ id: 'bruce', label: 'Bruce' }],
      unscheduled: [expect.objectContaining({ id: 'sv:sv-1', projectId: 'proj:proj-1' })],
      events: [],
    });
    expect(fromMock).toHaveBeenCalledTimes(2);
    expect(selectCalls).toHaveLength(2);
    expect(selectCalls[0]).toContain('assigned_sales_owner_id');
    expect(selectCalls[0]).toContain('region');
    expect(selectCalls[0]).toContain('site_visit_priority_tier');
    expect(res.headers.get('x-portal-request-id')).toBe('req_site_visits_ok');
    expect(res.headers.get('server-timing')).toContain('total;dur=');
  });

  it('returns diagnostics headers on formatted Supabase errors', async () => {
    plan = {
      unscheduledRes: { data: null, error: { code: 'XX000', message: 'db down' } },
      eventsRes: { data: null, error: null },
    };

    const mod = await import('./route');
    const res = await mod.GET(
      new Request('http://localhost/api/staff/v1/site-visits?from=2026-04-01&to=2026-04-30', {
        headers: { 'x-request-id': 'req_site_visits_err' },
      }),
    );

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: 'site visits unavailable' });
    expect(res.headers.get('x-portal-request-id')).toBe('req_site_visits_err');
    expect(res.headers.get('server-timing')).toContain('total;dur=');
  });

  it('fails explicitly when the supported site-visits schema is missing', async () => {
    plan = {
      unscheduledRes: {
        data: null,
        error: {
          code: 'PGRST204',
          message: "Could not find the 'site_visit_priority_tier' column of 'projects' in the schema cache",
        },
      },
      eventsRes: { data: null, error: null },
    };

    const mod = await import('./route');
    const res = await mod.GET(
      new Request('http://localhost/api/staff/v1/site-visits?from=2026-04-01&to=2026-04-30', {
        headers: { 'x-request-id': 'req_site_visits_schema' },
      }),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: 'Unsupported database schema for "site_visit_events": missing required column "site_visit_priority_tier". Apply the current portal schema.',
    });
    expect(formatSupabaseError).not.toHaveBeenCalled();
    expect(res.headers.get('x-portal-request-id')).toBe('req_site_visits_schema');
    expect(res.headers.get('server-timing')).toContain('total;dur=');
  });
});
