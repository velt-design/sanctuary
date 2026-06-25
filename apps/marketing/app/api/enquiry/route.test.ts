import { beforeEach, describe, expect, it, vi } from 'vitest';

type TableName = 'audit_events' | 'contacts' | 'enquiry_requests' | 'estimates' | 'projects';
type Row = Record<string, any>;

const h = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: h.createClient,
}));

vi.mock('@sp/costing', () => ({
  calculateCostV1: vi.fn(() => ({
    materials: { lines: [], totals: { materials_ex_gst: 0 } },
    install: { actions: [], totals: { crew_minutes: 0, crew_hours: 0, install_ex_gst: 0 } },
    overhead: { method: 'job_rollup', ops_ex_gst: 0, sales_ex_gst: 0, total_ex_gst: 0 },
    totals: { cost_inc_gst: 10000, cost_ex_gst: 8695, warnings: [], notes_and_warnings: [] },
    warnings: [],
    pergolas: [],
  })),
  autoSplitByMaxWidth: vi.fn(),
  getBlindSystemLimits: vi.fn(() => ({ maxWidthMm: 5000, maxCoverLengthMm: 3000 })),
  priceAllBlinds: vi.fn(() => ({ totals: { totalIncCents: 0 } })),
}));

vi.mock('@/lib/enquiryBudgets', () => ({
  buildEnquiryBudgets: vi.fn(() => ({
    baseRange: { lowIncGst: 12000, highIncGst: 12000 },
    blindsRange: null,
    budgetBasis: 'test',
  })),
}));

vi.mock('../../../../../apps/portal/lib/estimates/persistence', () => ({
  buildEstimateDbPayload: vi.fn((payload) => payload),
}));

vi.mock('@/lib/email/sendCustomerAutoresponder', () => ({
  sendCustomerAutoresponder: vi.fn(),
}));

function makeDb() {
  const db: Record<TableName, Row[]> = {
    audit_events: [],
    contacts: [],
    enquiry_requests: [],
    estimates: [],
    projects: [],
  };
  const ids: Record<TableName, string[]> = {
    audit_events: ['audit-1'],
    contacts: ['contact-1'],
    enquiry_requests: ['enquiry-1'],
    estimates: ['estimate-1'],
    projects: ['project-1'],
  };

  class Query {
    private op: 'select' | 'insert' = 'select';
    private payload: Row | null = null;
    private filters: Array<{ column: string; value: unknown; mode: 'eq' | 'ilike' }> = [];

    constructor(private readonly table: TableName) {}

    select() {
      return this;
    }

    eq(column: string, value: unknown) {
      this.filters.push({ column, value, mode: 'eq' });
      return this;
    }

    ilike(column: string, value: unknown) {
      this.filters.push({ column, value, mode: 'ilike' });
      return this;
    }

    limit() {
      return this;
    }

    order() {
      return this;
    }

    insert(payload: Row) {
      this.op = 'insert';
      this.payload = payload;
      return this;
    }

    single() {
      return this.execute(true);
    }

    maybeSingle() {
      return this.execute(true);
    }

    then<TResult1 = any, TResult2 = never>(
      onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      return this.execute(false).then(onfulfilled, onrejected);
    }

    private execute(single: boolean) {
      if (this.op === 'insert') {
        const row = {
          id: ids[this.table].shift() ?? `${this.table}-${db[this.table].length + 1}`,
          ...this.payload,
        };
        db[this.table].push(row);
        return Promise.resolve({ data: single ? row : [row], error: null });
      }

      const rows = db[this.table].filter((row) =>
        this.filters.every((filter) => {
          if (filter.mode === 'ilike') return String(row[filter.column] ?? '').toLowerCase() === String(filter.value ?? '').toLowerCase();
          return row[filter.column] === filter.value;
        }),
      );
      return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null });
    }
  }

  const client = {
    from: vi.fn((table: TableName) => new Query(table)),
  };

  return { client, db };
}

describe('POST /api/enquiry attribution', () => {
  beforeEach(() => {
    vi.resetModules();
    h.createClient.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  });

  it('persists Google click attribution and records one lead-submitted audit event', async () => {
    const { client, db } = makeDb();
    h.createClient.mockReturnValue(client);
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enquiryType: 'residential',
          name: 'Taylor',
          phone: '021000000',
          suburb: 'Mangere',
          dimensions: { widthM: 5, depthM: 3, heightM: 2.4 },
          style: 'pitched',
          roofMaterials: ['acrylic'],
          addOns: {},
          source: 'website',
          page: '/contact',
          utm: { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'winter' },
          attribution: {
            utm: { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'winter' },
            clickIds: { gclid: 'g-123', gbraid: 'gb-456', wbraid: 'wb-789' },
            landingPage: 'https://www.sanctuarypergolas.co.nz/contact?gclid=g-123',
            referrer: 'https://www.google.com/',
          },
          honeypot: '',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      contactId: 'contact-1',
      projectId: 'project-1',
      enquiryRequestId: 'enquiry-1',
    });
    expect(db.enquiry_requests[0]?.raw_payload.attribution).toMatchObject({
      clickIds: { gclid: 'g-123', gbraid: 'gb-456', wbraid: 'wb-789' },
      landingPage: 'https://www.sanctuarypergolas.co.nz/contact?gclid=g-123',
    });
    expect(db.audit_events).toHaveLength(1);
    expect(db.audit_events[0]).toMatchObject({
      project_id: 'project-1',
      type: 'marketing.lead_submitted',
      idempotency_key: 'marketing:marketing.lead_submitted:project-1:enquiry-1',
      payload: {
        projectId: 'project-1',
        enquiryRequestId: 'enquiry-1',
        enquiryType: 'residential',
        attribution: {
          enquiryRequestId: 'enquiry-1',
          clickIds: { gclid: 'g-123', gbraid: 'gb-456', wbraid: 'wb-789' },
        },
      },
    });
    expect(JSON.stringify(db.audit_events)).not.toContain('Taylor');
  });
});
