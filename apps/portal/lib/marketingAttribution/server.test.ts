import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  supabaseServiceRole: {
    from: vi.fn(),
  },
}));

vi.mock('../supabaseClient', () => ({
  supabaseServiceRole: h.supabaseServiceRole,
}));

type Row = Record<string, any>;

function makeSupabase(seed: { enquiryRequests?: Row[]; auditEvents?: Row[] } = {}) {
  const db = {
    enquiry_requests: [...(seed.enquiryRequests ?? [])],
    audit_events: [...(seed.auditEvents ?? [])],
  };

  class Query {
    private filters: Array<{ column: string; value: unknown }> = [];
    private payload: Row | null = null;

    constructor(private readonly table: keyof typeof db) {}

    select() {
      return this;
    }

    eq(column: string, value: unknown) {
      this.filters.push({ column, value });
      return this;
    }

    order() {
      return this;
    }

    limit() {
      return this;
    }

    maybeSingle() {
      const rows = db[this.table].filter((row) => this.filters.every((filter) => row[filter.column] === filter.value));
      return Promise.resolve({ data: rows[0] ?? null, error: null });
    }

    insert(payload: Row) {
      this.payload = payload;
      db[this.table].push(payload);
      return Promise.resolve({ data: null, error: null });
    }
  }

  return {
    db,
    client: {
      from: vi.fn((table: keyof typeof db) => new Query(table)),
    },
  };
}

describe('marketing attribution conversion helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    h.supabaseServiceRole.from.mockReset();
  });

  it('normalizes UTM and Google click identifiers without keeping unknown payload fields', async () => {
    const { normalizeMarketingAttributionInput } = await import('./server');

    expect(
      normalizeMarketingAttributionInput(
        {
          utm: { UTM_Source: ' Google ', nope: 'ignored' },
          clickIds: { gclid: ' g-123 ', gbraid: 'gb-456', email: 'do-not-keep@example.com' },
          landingPage: ' https://example.test/?gclid=g-123 ',
          referrer: ' https://google.test ',
          analyticsClientId: '1022420085.1772518636',
          consent: {
            analytics: true,
            marketing: false,
            capturedAt: '2026-07-30T00:00:00.000Z',
          },
        },
        { utm: { utm_campaign: 'Fallback' }, page: '/contact', source: 'website' },
      ),
    ).toEqual({
      source: 'website',
      page: '/contact',
      utm: { utm_campaign: 'Fallback', utm_source: 'Google' },
      clickIds: { gclid: 'g-123', gbraid: 'gb-456' },
      landingPage: 'https://example.test/?gclid=g-123',
      referrer: 'https://google.test',
      analyticsClientId: '1022420085.1772518636',
      consent: {
        analytics: true,
        marketing: false,
        capturedAt: '2026-07-30T00:00:00.000Z',
      },
    });
  });

  it('drops GA identity when analytics consent is absent or denied', async () => {
    const { normalizeMarketingAttributionInput } = await import('./server');

    expect(
      normalizeMarketingAttributionInput({
        analyticsClientId: '1022420085.1772518636',
        consent: { analytics: false, marketing: true },
      }),
    ).toMatchObject({
      analyticsClientId: null,
      consent: { analytics: false, marketing: true },
    });
    expect(
      normalizeMarketingAttributionInput({
        analyticsClientId: '1022420085.1772518636',
      }),
    ).toMatchObject({
      analyticsClientId: null,
      consent: null,
    });
  });

  it('records an idempotent conversion audit event with linked enquiry attribution', async () => {
    const fake = makeSupabase({
      enquiryRequests: [
        {
          id: 'enq-1',
          project_id: 'proj-1',
          source: 'website',
          page: '/contact',
          utm: { utm_source: 'google' },
          raw_payload: {
            attribution: {
              clickIds: { gclid: 'g-123' },
              landingPage: 'https://example.test/contact?gclid=g-123',
              analyticsClientId: '1022420085.1772518636',
              consent: {
                analytics: true,
                marketing: true,
                capturedAt: '2026-06-01T00:00:00.000Z',
              },
            },
          },
          created_at: '2026-06-01T00:00:00.000Z',
        },
      ],
    });
    const { recordMarketingConversionEvent } = await import('./server');

    await recordMarketingConversionEvent({
      type: 'marketing.quote_accepted',
      projectId: 'proj-1',
      primaryId: 'qv-1',
      payload: { quoteVersionId: 'qv-1', valueIncGstCents: 120000 },
      supabase: fake.client as any,
    });

    expect(fake.db.audit_events).toHaveLength(1);
    expect(fake.db.audit_events[0]).toMatchObject({
      project_id: 'proj-1',
      type: 'marketing.quote_accepted',
      idempotency_key: 'marketing:marketing.quote_accepted:proj-1:qv-1',
      payload: {
        projectId: 'proj-1',
        quoteVersionId: 'qv-1',
        valueIncGstCents: 120000,
        attribution: {
          enquiryRequestId: 'enq-1',
          source: 'website',
          page: '/contact',
          utm: { utm_source: 'google' },
          clickIds: { gclid: 'g-123' },
          analyticsClientId: '1022420085.1772518636',
          consent: {
            analytics: true,
            marketing: true,
            capturedAt: '2026-06-01T00:00:00.000Z',
          },
        },
      },
    });
    expect(JSON.stringify(fake.db.audit_events[0])).not.toContain('do-not-keep@example.com');
  });
});
