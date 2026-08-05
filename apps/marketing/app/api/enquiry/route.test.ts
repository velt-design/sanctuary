import { beforeEach, describe, expect, it, vi } from 'vitest';

type TableName = 'audit_events' | 'contacts' | 'enquiry_requests' | 'estimates' | 'projects';
type Row = Record<string, any>;
const SUBMISSION_ID = 'ad5e5929-32f8-4af9-989a-4de73a4dc5a2';
const UPLOAD_SESSION_TOKEN = 'valid-upload-session-token';

const h = vi.hoisted(() => ({
  createClient: vi.fn(),
  calculateCostV1: vi.fn(() => ({
    materials: { lines: [], totals: { materials_ex_gst: 0 } },
    install: { actions: [], totals: { crew_minutes: 0, crew_hours: 0, install_ex_gst: 0 } },
    overhead: { method: 'job_rollup', ops_ex_gst: 0, sales_ex_gst: 0, total_ex_gst: 0 },
    totals: { cost_inc_gst: 10000, cost_ex_gst: 8695, warnings: [], notes_and_warnings: [] },
    warnings: [],
    pergolas: [],
  })),
  priceAllBlinds: vi.fn((_items: unknown[]) => ({ totals: { totalIncCents: 0 } })),
  getPublishedCostingConfiguration: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: h.createClient,
}));

vi.mock('@sp/costing', () => ({
  calculateCostV1: h.calculateCostV1,
  calculateSiteCostV1: vi.fn(),
  isCommercialPolicyV2Enabled: vi.fn(() => false),
  autoSplitByMaxWidth: vi.fn(),
  getBlindSystemLimits: vi.fn(() => ({ maxWidthMm: 5000, maxCoverLengthMm: 3000 })),
  priceAllBlinds: h.priceAllBlinds,
}));

vi.mock('../../../lib/publishedCostingConfiguration.server', () => ({
  getPublishedCostingConfiguration: h.getPublishedCostingConfiguration,
}));

vi.mock('@/lib/enquiryBudgets', () => ({
  buildEnquiryBudgets: vi.fn((params: { baseTrueCostIncGst: number | null }) => ({
    baseRange: params.baseTrueCostIncGst ? { lowIncGst: 12000, highIncGst: 12000 } : null,
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
  const intakeBySubmission = new Map<string, {
    contact_id: string;
    project_id: string;
    enquiry_request_id: string;
  }>();

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

    upsert(payload: Row) {
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
        // Tolerate tables outside the seeded set (e.g. email_outbox,
        // email_templates) so best-effort upsert logging does not throw.
        const idPool = (ids as Record<string, string[]>)[this.table];
        const store = ((db as Record<string, Row[]>)[this.table] ??= []);
        const row = {
          id: idPool?.shift() ?? `${this.table}-${store.length + 1}`,
          ...this.payload,
        };
        store.push(row);
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
    rpc: vi.fn(async (name: string, args: Record<string, any>) => {
      if (name === 'marketing_public_rate_limit_take') {
        return { data: [{ allowed: true, retry_after_seconds: 0 }], error: null };
      }
      if (name === 'marketing_enquiry_intake') {
        const existing = intakeBySubmission.get(args.p_submission_id);
        if (existing) return { data: [{ ...existing, already_existed: true }], error: null };
        const input = args.p_payload;
        const contact = {
          id: 'contact-1',
          name: input.name,
          email: input.email || null,
          phone: input.phone,
        };
        const project = {
          id: 'project-1',
          contact_id: contact.id,
          name: `${input.name} - ${input.suburb || 'Project'}`,
        };
        const enquiry = {
          id: 'enquiry-1',
          submission_id: args.p_submission_id,
          contact_id: contact.id,
          project_id: project.id,
          raw_payload: input.rawPayload,
          files: input.files,
        };
        db.contacts.push(contact);
        db.projects.push(project);
        db.enquiry_requests.push(enquiry);
        const result = {
          contact_id: contact.id,
          project_id: project.id,
          enquiry_request_id: enquiry.id,
        };
        intakeBySubmission.set(args.p_submission_id, result);
        return { data: [{ ...result, already_existed: false }], error: null };
      }
      return { data: null, error: new Error(`Unexpected RPC: ${name}`) };
    }),
    from: vi.fn((table: TableName) => new Query(table)),
    storage: {
      from: vi.fn(() => ({
        download: vi.fn(async () => ({
          data: { arrayBuffer: async () => new TextEncoder().encode('%PDF-test').buffer },
          error: null,
        })),
        createSignedUrl: vi.fn(async (path: string) => ({
          data: { signedUrl: `https://signed.test/${path}` },
          error: null,
        })),
      })),
    },
  };

  return { client, db };
}

describe('POST /api/enquiry attribution', () => {
  beforeEach(() => {
    vi.resetModules();
    h.createClient.mockReset();
    h.calculateCostV1.mockClear();
    h.priceAllBlinds.mockClear();
    h.getPublishedCostingConfiguration.mockReset();
    h.getPublishedCostingConfiguration.mockResolvedValue({
      config: { marker: 'published-v1' },
      provenance: {
        schemaVersion: 'costing-provenance.v1',
        source: 'published',
        versionId: '11111111-1111-4111-8111-111111111111',
        versionNumber: 1,
        contentHash: 'published-v1-hash',
        baseManifestVersion: 'costing-v1',
      },
    });
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
          submissionId: SUBMISSION_ID,
          enquiryType: 'residential',
          name: 'Taylor',
          email: 'taylor@example.test',
          phone: '021000000',
          suburb: 'Mangere',
          dimensions: { widthM: 5, depthM: 3, heightM: 2.4 },
          style: 'pitched',
          roofMaterials: ['acrylic'],
          addOns: { blinds: true },
          source: 'website',
          page: '/contact',
          enquiryContext: {
            enquiry_type: 'commercial',
            source_path: '/projects/warkworth-outdoor-room',
            source_component: 'project_cta',
            source_project: 'warkworth-outdoor-room',
            source_product: 'unknown-product',
            source_experience: 'guided-home-v1',
            source_pathway: 'residential-cover',
            source_focus: 'daylight',
            email: 'must-not-be-kept@example.test',
          },
          utm: { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'winter' },
          attribution: {
            utm: { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'winter' },
            clickIds: { gclid: 'g-123', gbraid: 'gb-456', wbraid: 'wb-789' },
            landingPage: 'https://www.sanctuarypergolas.co.nz/contact?gclid=g-123',
            referrer: 'https://www.google.com/',
            consent: {
              analytics: false,
              marketing: true,
              capturedAt: '2026-07-30T00:00:00.000Z',
            },
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
      landingPage: 'https://www.sanctuarypergolas.co.nz/contact',
    });
    expect(db.enquiry_requests[0]?.raw_payload.enquiryContext).toEqual({
      enquiry_type: 'residential',
      source_path: '/projects/warkworth-outdoor-room',
      source_component: 'project_cta',
      source_project: 'warkworth-outdoor-room',
      source_experience: 'guided-home-v1',
      source_pathway: 'residential-cover',
      source_focus: 'daylight',
    });
    const leadEvents = db.audit_events.filter((event) => event.type === 'marketing.lead_submitted');
    expect(leadEvents).toHaveLength(1);
    expect(leadEvents[0]).toMatchObject({
      project_id: 'project-1',
      type: 'marketing.lead_submitted',
      idempotency_key: 'marketing:marketing.lead_submitted:project-1:enquiry-1',
      payload: {
        projectId: 'project-1',
        enquiryRequestId: 'enquiry-1',
         enquiryType: 'residential',
          source_path: '/projects/warkworth-outdoor-room',
          source_component: 'project_cta',
          source_project: 'warkworth-outdoor-room',
        attribution: {
          enquiryRequestId: 'enquiry-1',
          clickIds: { gclid: 'g-123', gbraid: 'gb-456', wbraid: 'wb-789' },
        },
      },
    });
    expect(JSON.stringify(leadEvents)).not.toContain('Taylor');
    expect(JSON.stringify(leadEvents)).not.toContain('must-not-be-kept');
    expect(h.priceAllBlinds).toHaveBeenCalledTimes(1);
    expect(h.priceAllBlinds.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rollCover: 'NONE' }),
      ]),
    );
    expect(db.estimates[0]?.inputs.blinds.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rollCover: 'NONE' }),
      ]),
    );
    expect(h.calculateCostV1).toHaveBeenCalledTimes(1);
    expect(h.calculateCostV1).toHaveBeenCalledWith(
      expect.objectContaining({ post_count: 2 }),
      { marker: 'published-v1' },
    );
    expect(db.estimates[0]?.configVersions.costingControl).toMatchObject({ versionNumber: 1 });
    expect(db.estimates[0]?.inputs.modules[0]?.postCount).toBe('2');
    expect(db.estimates[0]?.outputs.totals.cost_inc_gst).toBe(10000);
  });

  it.each(['residential', 'commercial', 'professional'] as const)(
    'inlines small %s uploads as autoresponder attachments',
    async (enquiryType) => {
      const { client } = makeDb();
      h.createClient.mockReturnValue(client);
      const { POST } = await import('./route');
      const { sendCustomerAutoresponder } = await import('@/lib/email/sendCustomerAutoresponder');
      (sendCustomerAutoresponder as any).mockClear();

      const response = await POST(
        new Request('http://localhost/api/enquiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            submissionId: SUBMISSION_ID,
            uploadSessionToken: UPLOAD_SESSION_TOKEN,
            enquiryType,
            name: 'Pat',
            email: 'pat@example.com',
            phone: '021000000',
            suburb: 'Ponsonby',
            company: enquiryType === 'professional' ? 'BuildCo' : undefined,
            ...(enquiryType === 'professional'
              ? {}
              : {
                  dimensions: { widthM: 5, depthM: 3, heightM: 2.4 },
                  style: 'pitched',
                  roofMaterials: ['acrylic'],
                }),
            files: [{
              path: `pending/${SUBMISSION_ID}/0-plan.pdf`,
              name: 'plan.pdf',
              size: 9,
              type: 'application/pdf',
            }],
            source: 'website',
            page: '/contact',
            honeypot: '',
          }),
        }),
      );

      expect(response.status).toBe(200);
      expect(sendCustomerAutoresponder).toHaveBeenCalledTimes(1);
      const [enquiry, options] = (sendCustomerAutoresponder as any).mock.calls[0];
      expect(enquiry).toMatchObject({
        enquiryType,
        filesReceivedCount: 1,
      });
      expect(options).toEqual({
        attachments: [{ filename: 'plan.pdf', content: Buffer.from('%PDF-test').toString('base64') }],
        idempotencyKey: 'website:autoresponder:enquiry-1',
      });
      expect(h.calculateCostV1).toHaveBeenCalledTimes(
        enquiryType === 'professional' ? 0 : 1,
      );
    },
  );

  it('sends the residential confirmation without an estimate when dimensions are omitted', async () => {
    const { client, db } = makeDb();
    h.createClient.mockReturnValue(client);
    const { POST } = await import('./route');
    const { sendCustomerAutoresponder } = await import('@/lib/email/sendCustomerAutoresponder');
    (sendCustomerAutoresponder as any).mockClear();

    const response = await POST(
      new Request('http://localhost/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: SUBMISSION_ID,
          uploadSessionToken: UPLOAD_SESSION_TOKEN,
          enquiryType: 'residential',
          name: 'Pat',
          email: 'pat@example.com',
          phone: '021000000',
          suburb: 'Ponsonby',
          source: 'website',
          page: '/contact',
          files: [{
            path: `pending/${SUBMISSION_ID}/0-plan.pdf`,
            name: 'plan.pdf',
            size: 9,
            type: 'application/pdf',
          }],
          honeypot: '',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(h.calculateCostV1).not.toHaveBeenCalled();
    expect(sendCustomerAutoresponder).toHaveBeenCalledTimes(1);
    expect((sendCustomerAutoresponder as any).mock.calls[0]?.[0]).toMatchObject({
      enquiryType: 'residential',
      widthM: 0,
      depthM: 0,
      heightM: 0,
    });
    expect((sendCustomerAutoresponder as any).mock.calls[0]?.[0]).not.toHaveProperty(
      'baseRange',
    );
    expect((sendCustomerAutoresponder as any).mock.calls[0]?.[1]).toEqual({
      attachments: [{
        filename: 'plan.pdf',
        content: Buffer.from('%PDF-test').toString('base64'),
      }],
      idempotencyKey: 'website:autoresponder:enquiry-1',
    });
    expect((db as Record<string, Row[]>).email_outbox).toEqual([
      expect.objectContaining({
        status: 'SENT',
        template_id: 'EMAIL_WEBSITE_AUTORESPONDER_RES_V1',
      }),
    ]);
  });

  it('accepts the enquiry and saves unavailable pricing when the single costing attempt fails', async () => {
    const { client, db } = makeDb();
    h.createClient.mockReturnValue(client);
    h.calculateCostV1.mockImplementationOnce(() => { throw new Error('Costing unavailable'); });
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/enquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submissionId: SUBMISSION_ID,
        enquiryType: 'residential',
        name: 'Alex',
        email: 'alex@example.test',
        phone: '021000000',
        suburb: 'Takapuna',
        dimensions: { widthM: 5, depthM: 3, heightM: 2.4 },
        style: 'pitched',
        roofMaterials: ['acrylic'],
        addOns: {},
        source: 'website',
        honeypot: '',
      }),
    }));

    expect(response.status).toBe(200);
    expect(h.calculateCostV1).toHaveBeenCalledTimes(1);
    expect(db.estimates[0]?.inputs.modules[0]?.postCount).toBe('2');
    expect(db.estimates[0]?.outputs.totals.cost_inc_gst).toBe(0);
    expect(db.estimates[0]?.derived.pricingMode).toBe('indicative_fallback');
  });

  it('never falls back to package pricing when the published version is unavailable', async () => {
    const { client, db } = makeDb();
    h.createClient.mockReturnValue(client);
    h.getPublishedCostingConfiguration.mockRejectedValueOnce(new Error('No publication'));
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/enquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submissionId: SUBMISSION_ID,
        enquiryType: 'residential',
        name: 'Alex',
        email: 'alex@example.test',
        phone: '021000000',
        suburb: 'Takapuna',
        dimensions: { widthM: 5, depthM: 3, heightM: 2.4 },
        style: 'pitched',
        roofMaterials: ['acrylic'],
        addOns: {},
        source: 'website',
        honeypot: '',
      }),
    }));

    expect(response.status).toBe(200);
    expect(h.calculateCostV1).not.toHaveBeenCalled();
    expect(client.rpc).toHaveBeenCalledWith(
      'marketing_enquiry_intake',
      expect.objectContaining({
        p_payload: expect.objectContaining({ baseBudgetLowIncGst: null }),
      }),
    );
    expect(db.estimates[0]?.configVersions).toBeNull();
  });

  it('returns the original result on a retry without duplicating side effects', async () => {
    const { client, db } = makeDb();
    h.createClient.mockReturnValue(client);
    const { POST } = await import('./route');
    const body = JSON.stringify({
      submissionId: SUBMISSION_ID,
      enquiryType: 'residential',
      name: 'Retry User',
      email: 'retry@example.test',
      phone: '021000000',
      suburb: 'Albany',
      dimensions: { widthM: 5, depthM: 3, heightM: 2.4 },
      style: 'pitched',
      roofMaterials: ['acrylic'],
      addOns: {},
      source: 'website',
      honeypot: '',
    });

    const first = await POST(new Request('http://localhost/api/enquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }));
    const retry = await POST(new Request('http://localhost/api/enquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }));

    expect(first.status).toBe(200);
    expect(await retry.json()).toMatchObject({
      ok: true,
      contactId: 'contact-1',
      projectId: 'project-1',
      enquiryRequestId: 'enquiry-1',
      idempotentReplay: true,
    });
    expect(db.contacts).toHaveLength(1);
    expect(db.projects).toHaveLength(1);
    expect(db.enquiry_requests).toHaveLength(1);
    expect(db.estimates).toHaveLength(1);
    expect(db.audit_events.filter((event) => event.type === 'marketing.lead_submitted')).toHaveLength(1);
    expect(db.audit_events.filter((event) => event.type === 'email_sent')).toHaveLength(1);
  });

  it('does not expose internal database failures to public clients', async () => {
    const { client } = makeDb();
    const defaultRpc = client.rpc;
    client.rpc = vi.fn(async (name: string, args: Record<string, any>) => {
      if (name === 'marketing_enquiry_intake') {
        return {
          data: null,
          error: new Error('duplicate key violates confidential_internal_constraint'),
        };
      }
      return defaultRpc(name, args);
    });
    h.createClient.mockReturnValue(client);
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/enquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submissionId: SUBMISSION_ID,
        enquiryType: 'professional',
        name: 'Safe Error',
        email: 'safe@example.test',
        phone: '021000000',
        source: 'website',
        honeypot: '',
      }),
    }));
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).toContain('Unable to save enquiry');
    expect(body).not.toContain('confidential_internal_constraint');
    expect(body).not.toContain('duplicate key');
  });

  it('rejects cross-origin submission attempts before database access', async () => {
    const { client } = makeDb();
    h.createClient.mockReturnValue(client);
    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost/api/enquiry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://attacker.example',
      },
      body: JSON.stringify({}),
    }));

    expect(response.status).toBe(403);
    expect(h.createClient).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: 'a missing email',
      values: { email: '', phone: '021 000 0000' },
      error: 'Email is required',
    },
    {
      label: 'an invalid email',
      values: { email: 'not-an-email', phone: '021 000 0000' },
      error: 'Invalid email',
    },
    {
      label: 'an implausible phone',
      values: { email: 'test@example.test', phone: 'x' },
      error: 'Invalid phone',
    },
  ])('rejects $label before database access', async ({ values, error }) => {
    const { client } = makeDb();
    h.createClient.mockReturnValue(client);
    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost/api/enquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submissionId: SUBMISSION_ID,
        enquiryType: 'residential',
        name: 'Validation Test',
        ...values,
      }),
    }));

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ ok: false, error });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('accepts a direct form-encoded fallback with a stable submission UUID', async () => {
    const { client } = makeDb();
    h.createClient.mockReturnValue(client);
    const { POST } = await import('./route');
    const body = new URLSearchParams({
      submissionId: SUBMISSION_ID,
      enquiryType: 'residential',
      name: 'No Script Customer',
      email: 'customer@example.test',
      phone: '+61 2 9374 4000',
      suburb: 'Auckland',
      message: 'Please contact me about a pergola.',
    });
    const response = await POST(new Request('http://localhost/api/enquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
    expect(client.rpc).toHaveBeenCalledWith(
      'marketing_enquiry_intake',
      expect.objectContaining({ p_submission_id: SUBMISSION_ID }),
    );
  });
});
