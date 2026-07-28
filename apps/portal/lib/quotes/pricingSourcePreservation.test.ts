import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;
type TableName =
  | 'audit_events'
  | 'deposit_invoices'
  | 'estimates'
  | 'file_artifacts'
  | 'job_pack_generations'
  | 'projects'
  | 'quote_line_items'
  | 'quote_send_logs'
  | 'quote_versions'
  | 'quotes';

type DbState = Record<TableName, Row[]>;

const h = vi.hoisted(() => ({
  recordMarketingConversionEvent: vi.fn(),
  acceptQuoteAndEnsureDepositInvoice: vi.fn(),
  supabaseServiceRole: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServiceRole: h.supabaseServiceRole,
}));

vi.mock('@/lib/marketingAttribution/server', () => ({
  recordMarketingConversionEvent: h.recordMarketingConversionEvent,
}));

vi.mock('../commercial/acceptQuote', () => ({
  acceptQuoteAndEnsureDepositInvoice: h.acceptQuoteAndEnsureDepositInvoice,
}));

vi.mock('@/lib/estimates/server', () => ({
  buildVersionLabelMap: (rows: Array<{ id: string }>) => new Map(rows.map((row, index) => [row.id, `V${index + 1}`])),
}));

vi.mock('./pdf', () => ({
  generateQuotePdfBytes: vi.fn(async () => new Uint8Array([37, 80, 68, 70])),
  quotePdfFilename: (quoteRef: string, version: number) => `${quoteRef}-v${version}.pdf`,
}));

vi.mock('../invoices/server', () => ({
  ensureDepositInvoiceForAcceptedQuote: vi.fn(),
  voidOpenDepositInvoiceForQuote: vi.fn(),
}));

const ids = {
  project: '11111111-1111-4111-8111-111111111111',
  quote: '22222222-2222-4222-8222-222222222222',
  estimateWorkbench: '33333333-3333-4333-8333-333333333333',
  estimateCalculator: '44444444-4444-4444-8444-444444444444',
  quoteVersionCreated: '55555555-5555-4555-8555-555555555555',
  quoteVersionSent: '66666666-6666-4666-8666-666666666666',
  quoteVersionDraft: '77777777-7777-4777-8777-777777777777',
  quoteVersionRevision: '88888888-8888-4888-8888-888888888888',
  invoice: '99999999-9999-4999-8999-999999999999',
  jobPack: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};

const appId = (prefix: string, uuid: string) => `${prefix}_${uuid}`;

let db: DbState;
let insertIds: Partial<Record<TableName, string[]>>;
let generatedCounter = 1;
const ops: Array<{ table: TableName; action: string; payload?: unknown; select?: string | null }> = [];

function emptyDb(): DbState {
  return {
    audit_events: [],
    deposit_invoices: [],
    estimates: [],
    file_artifacts: [],
    job_pack_generations: [],
    projects: [],
    quote_line_items: [],
    quote_send_logs: [],
    quote_versions: [],
    quotes: [],
  };
}

function nextUuid(): string {
  const tail = String(generatedCounter++).padStart(12, '0');
  return `00000000-0000-4000-8000-${tail}`;
}

function idForInsert(table: TableName): string {
  return insertIds[table]?.shift() ?? nextUuid();
}

function resetDb(seed: Partial<DbState> = {}, queuedIds: Partial<Record<TableName, string[]>> = {}) {
  db = emptyDb();
  for (const [table, rows] of Object.entries(seed) as Array<[TableName, Row[]]>) {
    db[table] = rows.map((row) => ({ ...row }));
  }
  insertIds = Object.fromEntries(Object.entries(queuedIds).map(([table, values]) => [table, [...(values ?? [])]]));
  generatedCounter = 1;
  ops.length = 0;
    h.supabaseServiceRole.from.mockImplementation((table: TableName) => new FakeQuery(table));
    h.supabaseServiceRole.rpc.mockImplementation(
      async (name: string, args: Record<string, any> = {}) => {
        if (name === 'next_quote_ref') {
          return { data: 'Q-1001', error: null };
        }
        if (name === 'commercial_quote_create_draft') {
          for (const row of db.quote_versions) {
            if (row.quote_id === args.p_quote_id && row.status === 'DRAFT') {
              row.is_current_draft = false;
            }
          }
          const id = idForInsert('quote_versions');
          const versionNumber =
            Math.max(
              0,
              ...db.quote_versions
                .filter((row) => row.quote_id === args.p_quote_id)
                .map((row) => Number(row.version_number ?? 0)),
            ) + 1;
          const row = {
            id,
            quote_id: args.p_quote_id,
            version_number: versionNumber,
            status: 'DRAFT',
            is_current_draft: true,
            client_intent_id: args.p_client_intent_id,
            source_estimate_version_id: args.p_source_estimate_version_id,
            revised_from_quote_version_id:
              args.p_revised_from_quote_version_id,
            created_by: args.p_actor,
            customer_name: args.p_customer_name,
            reference: args.p_reference,
            intro_text: args.p_intro_text,
            terms_text: args.p_terms_text,
            deposit_percent: args.p_deposit_percent,
            expires_at: args.p_expires_at,
            total_inc_gst_cents: args.p_total_inc_gst_cents,
            total_ex_gst_cents: args.p_total_ex_gst_cents,
            gst_cents: args.p_gst_cents,
            pricing_source: args.p_pricing_source,
            pricing_source_metadata: args.p_pricing_source_metadata,
            created_at: '2026-05-04T00:00:00.000Z',
            updated_at: '2026-05-04T00:00:00.000Z',
          };
          db.quote_versions.push(row);
          for (const line of args.p_line_items ?? []) {
            db.quote_line_items.push({
              id: idForInsert('quote_line_items'),
              quote_version_id: id,
              ...line,
            });
          }
          return { data: [row], error: null };
        }
        if (name === 'commercial_quote_update_draft') {
          const row = db.quote_versions.find(
            (item) => item.id === args.p_quote_version_id,
          );
          if (!row) return { data: null, error: { message: 'Quote not found' } };
          Object.assign(row, {
            reference: args.p_reference,
            intro_text: args.p_intro_text,
            terms_text: args.p_terms_text,
            deposit_percent: args.p_deposit_percent,
            expires_at: args.p_expires_at,
            source_estimate_version_id: args.p_source_estimate_version_id,
            total_inc_gst_cents: args.p_total_inc_gst_cents,
            total_ex_gst_cents: args.p_total_ex_gst_cents,
            gst_cents: args.p_gst_cents,
            pricing_source: args.p_pricing_source,
            pricing_source_metadata: args.p_pricing_source_metadata,
            updated_at: '2026-05-04T00:00:01.000Z',
          });
          db.quote_line_items = db.quote_line_items.filter(
            (line) => line.quote_version_id !== row.id,
          );
          for (const line of args.p_line_items ?? []) {
            db.quote_line_items.push({
              id: idForInsert('quote_line_items'),
              quote_version_id: row.id,
              ...line,
            });
          }
          return { data: [row], error: null };
        }
        return { data: null, error: null };
      },
    );
    h.recordMarketingConversionEvent.mockReset();
    h.acceptQuoteAndEnsureDepositInvoice.mockReset();
}

function attachRelations(table: TableName, row: Row, selectArg: string | null): Row {
  if (table === 'quote_versions' && selectArg?.includes('quotes')) {
    const quote = db.quotes.find((item) => item.id === row.quote_id) ?? null;
    return quote ? { ...row, quotes: { id: quote.id, project_id: quote.project_id, quote_ref: quote.quote_ref } } : { ...row };
  }
  if (table === 'projects' && selectArg?.includes('contacts')) {
    return { ...row, contacts: row.contacts ?? { name: row.contact_name ?? 'Taylor', email: row.contact_email ?? 'taylor@example.com' } };
  }
  return { ...row };
}

class FakeQuery {
  private selectArg: string | null = null;
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: any;
  private filters: Array<{ kind: 'eq' | 'is' | 'in'; column: string; value: any }> = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private limitCount: number | null = null;

  constructor(private readonly table: TableName) {}

  select(value = '*') {
    this.selectArg = value;
    return this;
  }

  insert(value: any) {
    this.op = 'insert';
    this.payload = value;
    ops.push({ table: this.table, action: 'insert', payload: value });
    return this;
  }

  update(value: any) {
    this.op = 'update';
    this.payload = value;
    ops.push({ table: this.table, action: 'update', payload: value });
    return this;
  }

  delete() {
    this.op = 'delete';
    ops.push({ table: this.table, action: 'delete' });
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ kind: 'eq', column, value });
    return this;
  }

  is(column: string, value: any) {
    this.filters.push({ kind: 'is', column, value });
    return this;
  }

  in(column: string, value: any[]) {
    this.filters.push({ kind: 'in', column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending !== false };
    return this;
  }

  limit(value: number) {
    this.limitCount = value;
    return this;
  }

  maybeSingle() {
    return this.execute(true);
  }

  single() {
    return this.execute(true);
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute(false).then(onfulfilled, onrejected);
  }

  private matchingRows(): Row[] {
    let rows = db[this.table].filter((row) =>
      this.filters.every((filter) => {
        if (filter.kind === 'eq') return row[filter.column] === filter.value;
        if (filter.kind === 'is') return row[filter.column] === filter.value;
        if (filter.kind === 'in') return filter.value.includes(row[filter.column]);
        return true;
      }),
    );
    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      rows = [...rows].sort((left, right) => {
        const result = String(left[column] ?? '').localeCompare(String(right[column] ?? ''));
        return ascending ? result : -result;
      });
    }
    if (this.limitCount !== null) rows = rows.slice(0, this.limitCount);
    return rows.map((row) => attachRelations(this.table, row, this.selectArg));
  }

  private async execute(single: boolean) {
    ops.push({ table: this.table, action: this.op === 'select' ? 'select' : `${this.op}:execute`, select: this.selectArg });

    if (this.op === 'insert') {
      const values = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted = values.map((value) => {
        const row = {
          id: value.id ?? idForInsert(this.table),
          created_at: value.created_at ?? '2026-05-04T00:00:00.000Z',
          updated_at: value.updated_at ?? '2026-05-04T00:00:00.000Z',
          ...value,
        };
        db[this.table].push(row);
        return attachRelations(this.table, row, this.selectArg);
      });
      return { data: single ? inserted[0] ?? null : inserted, error: null };
    }

    if (this.op === 'update') {
      const updated: Row[] = [];
      for (const row of db[this.table]) {
        const matches = this.filters.every((filter) => {
          if (filter.kind === 'eq') return row[filter.column] === filter.value;
          if (filter.kind === 'is') return row[filter.column] === filter.value;
          if (filter.kind === 'in') return filter.value.includes(row[filter.column]);
          return true;
        });
        if (!matches) continue;
        Object.assign(row, this.payload, { updated_at: '2026-05-04T00:00:00.000Z' });
        updated.push(attachRelations(this.table, row, this.selectArg));
      }
      return { data: single ? updated[0] ?? null : updated, error: null };
    }

    if (this.op === 'delete') {
      const before = db[this.table].length;
      db[this.table] = db[this.table].filter((row) => !this.matchingRows().some((match) => match.id === row.id));
      return { data: [], count: before - db[this.table].length, error: null };
    }

    const rows = this.matchingRows();
    return { data: single ? rows[0] ?? null : rows, error: null };
  }
}

function makeProject(): Row {
  return {
    id: ids.project,
    name: 'Garden project',
    site_address: '1 Test Street',
    pipeline_stage: 'ESTIMATE',
    contacts: { name: 'Taylor Client', email: 'taylor@example.com', phone: '021' },
  };
}

function makeQuote(): Row {
  return {
    id: ids.quote,
    project_id: ids.project,
    quote_ref: 'Q-1001',
  };
}

function makeEstimate(args: {
  id: string;
  source: 'calculator_live' | 'workbench_solved';
  costExGst: number;
  metadata: Record<string, unknown>;
}): Row {
  return {
    id: args.id,
    project_id: ids.project,
    status: 'draft',
    created_at: '2026-05-04T00:00:00.000Z',
    updated_at: '2026-05-04T00:00:00.000Z',
    pricing_source: args.source,
    pricing_source_metadata: args.metadata,
    commercial_design_input: { raw: 'must-not-copy' },
    inputs: {
      schemaVersion: 'v2',
      projectName: 'Garden project',
      access: 'normal',
      height: 'single_storey',
      travelExGst: '0',
      extrasAllowanceExGst: '0',
      quoteDiscountPct: '0',
      pergolas: [{ id: 'pergola-1', label: 'Pergola 1' }],
      modules: [
        {
          pergolaId: 'pergola-1',
          pergolaStyle: 'pitched',
          roofMaterial: 'acrylic',
          extrusionColour: 'Black',
          roofPitchDeg: '',
          postCount: '4',
          lengthM: '6',
          projectionM: '3',
          houseConnectionType: 'soffit',
          postConnectionType: 'deck_bracket',
        },
      ],
      blinds: { items: [] },
    },
    outputs: {
      materials: { lines: [], totals: { materials_ex_gst: 0 } },
      install: { actions: [], totals: { crew_minutes: 0, crew_hours: 0, install_ex_gst: 0 } },
      overhead: { method: 'job_rollup', ops_ex_gst: 0, sales_ex_gst: 0, total_ex_gst: 0 },
      totals: { cost_ex_gst: args.costExGst, cost_inc_gst: args.costExGst * 1.15, warnings: [], notes_and_warnings: [] },
      warnings: [],
      cost_snapshot_version: 'v2',
      pergolas: [{ id: 'pergola-1', label: 'Pergola 1', totals: { cost_ex_gst: args.costExGst } }],
      configVersions: { pricebook: 'v1', installActions: 'v1', overheads: 'v1', rules: 'v1', manifest: 'v1' },
    },
    warnings: [],
  };
}

function makeQuoteVersion(overrides: Row = {}): Row {
  return {
    id: ids.quoteVersionSent,
    quote_id: ids.quote,
    version_number: 1,
    status: 'SENT',
    is_current_draft: true,
    updated_at: '2026-05-04T00:00:00.000Z',
    source_estimate_version_id: ids.estimateWorkbench,
    revised_from_quote_version_id: null,
    created_by: 'ops@example.com',
    customer_name: 'Taylor Client',
    intro_text: 'Intro',
    terms_text: 'Terms',
    deposit_percent: 50,
    total_inc_gst_cents: 14375,
    total_ex_gst_cents: 12500,
    gst_cents: 1875,
    pricing_source: 'workbench_solved',
    pricing_source_metadata: {
      selectedSource: 'workbench_solved',
      commercialInputHash: 'hash-commercial',
      sourceMetadataHash: 'hash-source',
      commercial_design_input: { raw: true },
    },
    ...overrides,
  };
}

function makeLine(quoteVersionId: string, cents: number, id = nextUuid()): Row {
  return {
    id,
    quote_version_id: quoteVersionId,
    sort_order: 0,
    description: 'Pergola 1',
    qty: 1,
    unit_price_inc_gst_cents: cents,
    line_total_inc_gst_cents: cents,
  };
}

function expectNoRawCommercialPayload(value: unknown) {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain('commercial_design_input');
  expect(serialized).not.toContain('oversizedCommercialPayload');
  expect(serialized).not.toContain('raw-pricing-source-metadata');
}

describe('quote pricing source preservation in domain helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    resetDb();
  });

  it('creates quote versions with compact source metadata and mapped totals only', async () => {
    resetDb(
      {
        estimates: [
          makeEstimate({
            id: ids.estimateWorkbench,
            source: 'workbench_solved',
            costExGst: 100,
            metadata: {
              selectedSource: 'workbench_solved',
              commercialInputHash: 'hash-commercial',
              trustSummary: { status: 'ready', blockingDiagnostics: 0, commercial_design_input: { raw: true } },
              oversizedCommercialPayload: { raw: 'raw-pricing-source-metadata' },
            },
          }),
        ],
        projects: [makeProject()],
        quotes: [makeQuote()],
      },
      {
        quote_versions: [ids.quoteVersionCreated],
        file_artifacts: [nextUuid()],
      },
    );

    const { createQuoteFromEstimate } = await import('./serverCore');
    const detail = await createQuoteFromEstimate(appId('proj', ids.project), appId('est', ids.estimateWorkbench), 'ops@example.com');

    const stored = db.quote_versions.find((row) => row.id === ids.quoteVersionCreated);
    expect(detail.totals.totalIncGstCents).toBe(14375);
    expect(stored).toMatchObject({
      total_inc_gst_cents: 14375,
      total_ex_gst_cents: 12500,
      gst_cents: 1875,
      pricing_source: 'workbench_solved',
    });
    expect(stored?.pricing_source_metadata).toMatchObject({
      selectedSource: 'workbench_solved',
      commercialInputHash: 'hash-commercial',
      copyReason: 'quote_created',
      copiedBy: 'ops@example.com',
      sourceEstimateVersionId: ids.estimateWorkbench,
    });
    expectNoRawCommercialPayload(stored?.pricing_source_metadata);

    const audit = db.audit_events.find((row) => row.type === 'quote.created')?.payload;
    expect(audit).toMatchObject({
      quoteVersionId: ids.quoteVersionCreated,
      estimateVersionId: ids.estimateWorkbench,
      copiedBy: 'ops@example.com',
      copyReason: 'quote_created',
      pricingSource: 'workbench_solved',
    });
    expect(audit).toHaveProperty('sourceMetadataHash');
    expectNoRawCommercialPayload(audit);
  });

  it('refreshes only draft quotes with calculator rollback metadata and leaves historical versions unchanged', async () => {
    const historical = makeQuoteVersion({ id: ids.quoteVersionSent, status: 'SENT', total_inc_gst_cents: 14375 });
    const draft = makeQuoteVersion({
      id: ids.quoteVersionDraft,
      status: 'DRAFT',
      version_number: 2,
      total_inc_gst_cents: 15000,
      total_ex_gst_cents: 13043,
      gst_cents: 1957,
    });
    resetDb(
      {
        estimates: [
          makeEstimate({
            id: ids.estimateCalculator,
            source: 'calculator_live',
            costExGst: 200,
            metadata: {
              selectedSource: 'calculator_live',
              rollbackProvenance: 'manual rollback',
              blockingGateCodes: ['WORKBENCH_PARITY_BLOCKED'],
              commercialInputHash: 'hash-calculator',
              oversizedCommercialPayload: { raw: 'raw-pricing-source-metadata' },
            },
          }),
        ],
        projects: [makeProject()],
        quotes: [makeQuote()],
        quote_versions: [historical, draft],
        quote_line_items: [makeLine(ids.quoteVersionSent, 14375), makeLine(ids.quoteVersionDraft, 15000)],
      },
      { file_artifacts: [nextUuid()] },
    );

    const { refreshDraftQuoteVersionFromEstimate } = await import('./serverCore');
    await refreshDraftQuoteVersionFromEstimate(
      appId('qv', ids.quoteVersionDraft),
      appId('est', ids.estimateCalculator),
      'ops@example.com',
    );

    expect(db.quote_versions.find((row) => row.id === ids.quoteVersionSent)).toMatchObject(historical);
    expect(db.quote_line_items.find((row) => row.quote_version_id === ids.quoteVersionSent)?.line_total_inc_gst_cents).toBe(14375);

    const refreshed = db.quote_versions.find((row) => row.id === ids.quoteVersionDraft);
    expect(refreshed).toMatchObject({
      source_estimate_version_id: ids.estimateCalculator,
      total_inc_gst_cents: 28750,
      total_ex_gst_cents: 25000,
      gst_cents: 3750,
      pricing_source: 'calculator_live',
    });
    expect(refreshed?.pricing_source_metadata).toMatchObject({
      selectedSource: 'calculator_live',
      rollbackProvenance: 'manual rollback',
      blockingGateCodes: ['WORKBENCH_PARITY_BLOCKED'],
      commercialInputHash: 'hash-calculator',
      copyReason: 'quote_refreshed_from_estimate',
    });
    expectNoRawCommercialPayload(refreshed?.pricing_source_metadata);

    const draftLines = db.quote_line_items.filter((row) => row.quote_version_id === ids.quoteVersionDraft);
    expect(draftLines).toHaveLength(1);
    expect(draftLines[0]?.line_total_inc_gst_cents).toBe(28750);

    const audit = db.audit_events.find((row) => row.type === 'quote.refreshed_from_estimate')?.payload;
    expect(audit).toMatchObject({
      quoteVersionId: ids.quoteVersionDraft,
      estimateVersionId: ids.estimateCalculator,
      pricingSource: 'calculator_live',
      copyReason: 'quote_refreshed_from_estimate',
    });
    expectNoRawCommercialPayload(audit);
  });

  it('revises from compact quote metadata without repricing the historical version', async () => {
    resetDb(
      {
        estimates: [
          makeEstimate({
            id: ids.estimateWorkbench,
            source: 'workbench_solved',
            costExGst: 999,
            metadata: { selectedSource: 'workbench_solved', commercialInputHash: 'raw-would-change-price' },
          }),
        ],
        projects: [makeProject()],
        quotes: [makeQuote()],
        quote_versions: [makeQuoteVersion({ id: ids.quoteVersionSent, status: 'ACCEPTED', total_inc_gst_cents: 14375 })],
        quote_line_items: [makeLine(ids.quoteVersionSent, 14375)],
      },
      {
        quote_versions: [ids.quoteVersionRevision],
        file_artifacts: [nextUuid()],
      },
    );

    const { reviseQuoteVersion } = await import('./serverCore');
    await reviseQuoteVersion(appId('qv', ids.quoteVersionSent), 'ops@example.com');

    const original = db.quote_versions.find((row) => row.id === ids.quoteVersionSent);
    const revision = db.quote_versions.find((row) => row.id === ids.quoteVersionRevision);
    expect(original?.total_inc_gst_cents).toBe(14375);
    expect(revision).toMatchObject({
      status: 'DRAFT',
      revised_from_quote_version_id: ids.quoteVersionSent,
      source_estimate_version_id: ids.estimateWorkbench,
      total_inc_gst_cents: 14375,
      pricing_source: 'workbench_solved',
    });
    expect(revision?.pricing_source_metadata).toMatchObject({
      selectedSource: 'workbench_solved',
      commercialInputHash: 'hash-commercial',
      copyReason: 'quote_revised',
      revisedFromQuoteVersionId: ids.quoteVersionSent,
    });
    expectNoRawCommercialPayload(revision?.pricing_source_metadata);
    expect(db.quote_line_items.find((row) => row.quote_version_id === ids.quoteVersionRevision)?.line_total_inc_gst_cents).toBe(14375);
    expect(ops.some((op) => op.table === 'estimates' && op.select?.includes('pricing_source, pricing_source_metadata'))).toBe(false);
  });

  it('records a marketing conversion event when a sent quote is accepted', async () => {
    resetDb({
      estimates: [
        makeEstimate({
          id: ids.estimateWorkbench,
          source: 'workbench_solved',
          costExGst: 100,
          metadata: { selectedSource: 'workbench_solved' },
        }),
      ],
      projects: [makeProject()],
      quotes: [makeQuote()],
      quote_versions: [makeQuoteVersion({ id: ids.quoteVersionSent, status: 'SENT', total_inc_gst_cents: 14375 })],
      quote_line_items: [makeLine(ids.quoteVersionSent, 14375)],
    });
    h.acceptQuoteAndEnsureDepositInvoice.mockResolvedValue({
      quoteVersionUuid: ids.quoteVersionSent,
      alreadyAccepted: false,
      invoice: {
        id: ids.invoice,
        invoiceRef: 'INV-1001',
        created: true,
        sent: false,
        sendError: null,
        deliveryState: 'retry_available',
      },
    });

    const { markQuoteAccepted } = await import('./serverCore');
    await markQuoteAccepted(appId('qv', ids.quoteVersionSent), 'ops@example.com');

    expect(h.recordMarketingConversionEvent).toHaveBeenCalledWith({
      type: 'marketing.quote_accepted',
      projectId: ids.project,
      primaryId: ids.quoteVersionSent,
      payload: {
        quoteVersionId: ids.quoteVersionSent,
        quoteId: ids.quote,
        valueIncGstCents: 14375,
      },
    });
    expect(JSON.stringify(h.recordMarketingConversionEvent.mock.calls)).not.toContain('Taylor Client');
  });

  it.each([
    ['status locked', 'SENT', {}],
    ['accepted locked', 'ACCEPTED', {}],
    ['declined locked', 'DECLINED', {}],
    ['invoice backed', 'DRAFT', { deposit_invoices: [{ id: ids.invoice, quote_version_id: ids.quoteVersionDraft }] }],
    ['job-pack backed', 'DRAFT', { job_pack_generations: [{ id: ids.jobPack, quote_version_id: ids.quoteVersionDraft }] }],
  ] as const)('blocks protected quote refresh before mutation: %s', async (_label, status, extraSeed) => {
    resetDb({
      estimates: [
        makeEstimate({
          id: ids.estimateCalculator,
          source: 'calculator_live',
          costExGst: 200,
          metadata: { selectedSource: 'calculator_live' },
        }),
      ],
      projects: [makeProject()],
      quotes: [makeQuote()],
      quote_versions: [makeQuoteVersion({ id: ids.quoteVersionDraft, status })],
      quote_line_items: [makeLine(ids.quoteVersionDraft, 14375)],
      ...extraSeed,
    } as Partial<DbState>);

    const { refreshDraftQuoteVersionFromEstimate } = await import('./serverCore');
    await expect(
      refreshDraftQuoteVersionFromEstimate(appId('qv', ids.quoteVersionDraft), appId('est', ids.estimateCalculator), 'ops@example.com'),
    ).rejects.toThrow('Quote is locked');

    expect(ops.filter((op) => ['quote_versions', 'quote_line_items'].includes(op.table) && op.action !== 'select')).toEqual([]);
    expect(db.quote_versions.find((row) => row.id === ids.quoteVersionDraft)?.total_inc_gst_cents).toBe(14375);
    expect(db.quote_line_items.find((row) => row.quote_version_id === ids.quoteVersionDraft)?.line_total_inc_gst_cents).toBe(14375);
  });
});
