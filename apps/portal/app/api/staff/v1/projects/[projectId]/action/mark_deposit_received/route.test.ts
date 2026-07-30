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
    if (
      prefix === 'proj'
      && value === 'proj_11111111-1111-4111-8111-111111111111'
    ) {
      return '11111111-1111-4111-8111-111111111111';
    }
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
  normalizeMarketingConversionOccurredAt: (value: unknown) => {
    if (typeof value !== 'string') return null;
    const parsed = new Date(value);
    return Number.isFinite(parsed.valueOf()) ? parsed.toISOString() : null;
  },
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

type QueryResult = {
  data: Record<string, unknown> | null;
  error: { message?: string } | null;
};

function query(result: QueryResult) {
  const builder: Record<string, any> = {
    select: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  for (const method of ['select', 'update', 'eq', 'order', 'limit']) {
    builder[method].mockReturnValue(builder);
  }
  return builder;
}

const PROJECT_ID = 'proj_11111111-1111-4111-8111-111111111111';
const PROJECT_UUID = '11111111-1111-4111-8111-111111111111';
const INVOICE_ID = '22222222-2222-4222-8222-222222222222';
const QUOTE_VERSION_ID = '33333333-3333-4333-8333-333333333333';

function request(body: unknown) {
  return new Request('http://localhost/mark-deposit-received', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function configureQueries(input?: {
  stage?: string;
  depositPaidDate?: string | null;
  depositReceivedAt?: string | null;
  projectUpdatedAt?: string;
  invoice?: QueryResult;
  quote?: QueryResult;
  update?: QueryResult;
}) {
  const stage = input?.stage ?? 'SENT';
  const depositReceivedAt = Object.prototype.hasOwnProperty.call(
    input ?? {},
    'depositReceivedAt',
  )
    ? input?.depositReceivedAt ?? null
    : stage === 'DEPOSIT'
      ? '2026-07-29T23:00:00.000Z'
      : null;
  const projectLoad = query({
    data: {
      id: PROJECT_UUID,
      pipeline_stage: stage,
      deposit_paid_date: input?.depositPaidDate ?? null,
      deposit_received_at: depositReceivedAt,
      updated_at: input?.projectUpdatedAt ?? '2026-07-29T23:00:00.000Z',
    },
    error: null,
  });
  const projectUpdate = query(
    input?.update ?? {
      data: {
        id: PROJECT_UUID,
        pipeline_stage: 'DEPOSIT',
        deposit_paid_date: '2026-07-30',
        deposit_received_at: '2026-07-30T00:00:00.000Z',
        updated_at: '2026-07-30T00:30:00.000Z',
      },
      error: null,
    },
  );
  const invoice = query(
    input?.invoice ?? {
      data: {
        id: INVOICE_ID,
        quote_version_id: QUOTE_VERSION_ID,
        created_at: '2026-07-29T12:00:00.000Z',
      },
      error: null,
    },
  );
  const quoteVersion = query(
    input?.quote ?? {
      data: {
        id: QUOTE_VERSION_ID,
        status: 'ACCEPTED',
        accepted_at: '2026-07-29T12:00:00.000Z',
      },
      error: null,
    },
  );
  const projectQueries = [projectLoad, projectUpdate];

  mocks.from.mockImplementation((table: string) => {
    if (table === 'projects') {
      const next = projectQueries.shift();
      if (!next) throw new Error('Unexpected projects query');
      return next;
    }
    if (table === 'deposit_invoices') return invoice;
    if (table === 'quote_versions') return quoteVersion;
    throw new Error(`Unexpected table ${table}`);
  });

  return { projectLoad, projectUpdate, invoice, quoteVersion };
}

async function invoke(body: unknown) {
  const { POST } = await import('./route');
  return POST(request(body), {
    params: Promise.resolve({ projectId: PROJECT_ID }),
  });
}

describe('mark deposit received', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-30T01:00:00.000Z'));
    mocks.requireStaffContext.mockReset();
    mocks.runEvent.mockReset();
    mocks.recordMarketingConversionEvent.mockReset();
    mocks.from.mockReset();
    mocks.requireStaffContext.mockResolvedValue({
      ok: true,
      supabase: { from: mocks.from },
    });
    mocks.runEvent.mockResolvedValue(undefined);
    mocks.recordMarketingConversionEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects missing and impossible paid dates before reading commercial state', async () => {
    for (const paidDate of [undefined, '', '30-07-2026', '2026-02-30']) {
      const response = await invoke({ paidDate });
      expect(response.status).toBe(400);
    }
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('requires an open deposit invoice backed by an accepted quote', async () => {
    configureQueries({
      invoice: { data: null, error: null },
    });

    const missingInvoice = await invoke({ paidDate: '2026-07-30' });
    expect(missingInvoice.status).toBe(409);
    expect(await missingInvoice.json()).toEqual({
      error: 'No open deposit invoice found',
    });
    expect(mocks.recordMarketingConversionEvent).not.toHaveBeenCalled();

    mocks.from.mockReset();
    configureQueries({
      quote: {
        data: {
          id: QUOTE_VERSION_ID,
          status: 'SENT',
          accepted_at: null,
        },
        error: null,
      },
    });

    const unacceptedQuote = await invoke({ paidDate: '2026-07-30' });
    expect(unacceptedQuote.status).toBe(409);
    expect(await unacceptedQuote.json()).toEqual({
      error: 'The deposit invoice quote has not been accepted',
    });
    expect(mocks.recordMarketingConversionEvent).not.toHaveBeenCalled();
  });

  it('atomically records the paid date and SENT-to-DEPOSIT transition before side effects', async () => {
    const { projectUpdate } = configureQueries();

    const response = await invoke({ paidDate: '2026-07-30' });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      paidDate: '2026-07-30',
      replayed: false,
    });
    expect(projectUpdate.update).toHaveBeenCalledWith({
      pipeline_stage: 'DEPOSIT',
      deposit_paid_date: '2026-07-30',
    });
    expect(projectUpdate.eq).toHaveBeenNthCalledWith(1, 'id', PROJECT_UUID);
    expect(projectUpdate.eq).toHaveBeenNthCalledWith(2, 'pipeline_stage', 'SENT');
    expect(projectUpdate.select).toHaveBeenCalledWith(
      'id, pipeline_stage, deposit_paid_date, deposit_received_at',
    );
    expect(mocks.recordMarketingConversionEvent).toHaveBeenCalledWith({
      type: 'marketing.deposit_received',
      projectId: PROJECT_UUID,
      occurredAt: '2026-07-30T00:00:00.000Z',
      payload: {
        paidDate: '2026-07-30',
        depositInvoiceId: INVOICE_ID,
        quoteVersionId: QUOTE_VERSION_ID,
      },
    });
    expect(projectUpdate.update.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.recordMarketingConversionEvent.mock.invocationCallOrder[0],
    );
    expect(mocks.runEvent).toHaveBeenCalledTimes(2);
  });

  it('fails a lost stage compare-and-swap without emitting events', async () => {
    configureQueries({
      update: { data: null, error: null },
    });

    const response = await invoke({ paidDate: '2026-07-30' });

    expect(response.status).toBe(409);
    expect(mocks.recordMarketingConversionEvent).not.toHaveBeenCalled();
    expect(mocks.runEvent).not.toHaveBeenCalled();
  });

  it('fails visibly when the database does not return a new immutable occurrence time', async () => {
    configureQueries({
      update: {
        data: {
          id: PROJECT_UUID,
          pipeline_stage: 'DEPOSIT',
          deposit_paid_date: '2026-07-30',
          deposit_received_at: null,
          updated_at: '2026-07-30T00:30:00.000Z',
        },
        error: null,
      },
    });

    const response = await invoke({ paidDate: '2026-07-30' });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Deposit was recorded but its occurrence time is unavailable',
    });
    expect(mocks.recordMarketingConversionEvent).not.toHaveBeenCalled();
    expect(mocks.runEvent).not.toHaveBeenCalled();
  });

  it('repairs recent DEPOSIT replays using the persisted occurrence time', async () => {
    const { projectUpdate } = configureQueries({
      stage: 'DEPOSIT',
      depositPaidDate: '2026-07-30',
      depositReceivedAt: '2026-07-29T23:30:00.000Z',
      projectUpdatedAt: '2026-07-29T23:30:00.000Z',
    });

    const response = await invoke({ paidDate: '2026-07-30' });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      paidDate: '2026-07-30',
      replayed: true,
    });
    expect(projectUpdate.update).not.toHaveBeenCalled();
    expect(mocks.recordMarketingConversionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'marketing.deposit_received',
        projectId: PROJECT_UUID,
        occurredAt: '2026-07-29T23:30:00.000Z',
      }),
    );
    expect(mocks.runEvent).toHaveBeenCalledTimes(2);
  });

  it('does not let an unrelated recent updated_at make an old deposit occurrence look new', async () => {
    const { projectLoad } = configureQueries({
      stage: 'DEPOSIT',
      depositPaidDate: '2026-07-20',
      depositReceivedAt: '2026-07-20T00:00:00.000Z',
      projectUpdatedAt: '2026-07-30T00:30:00.000Z',
    });

    const response = await invoke({ paidDate: '2026-07-20' });

    expect(response.status).toBe(200);
    expect(projectLoad.select).toHaveBeenCalledWith(
      'id, pipeline_stage, deposit_paid_date, deposit_received_at',
    );
    expect(mocks.recordMarketingConversionEvent).not.toHaveBeenCalled();
    expect(mocks.runEvent).not.toHaveBeenCalled();
  });

  it('fails closed when a legacy DEPOSIT row has no immutable occurrence time', async () => {
    configureQueries({
      stage: 'DEPOSIT',
      depositPaidDate: '2026-07-30',
      depositReceivedAt: null,
      projectUpdatedAt: '2026-07-30T00:30:00.000Z',
    });

    const response = await invoke({ paidDate: '2026-07-30' });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      paidDate: '2026-07-30',
      replayed: true,
    });
    expect(mocks.recordMarketingConversionEvent).not.toHaveBeenCalled();
    expect(mocks.runEvent).not.toHaveBeenCalled();
  });

  it('does not let a replay rewrite the canonical paid date', async () => {
    configureQueries({
      stage: 'DEPOSIT',
      depositPaidDate: '2026-07-29',
    });

    const response = await invoke({ paidDate: '2026-07-30' });

    expect(response.status).toBe(409);
    expect(mocks.recordMarketingConversionEvent).not.toHaveBeenCalled();
    expect(mocks.runEvent).not.toHaveBeenCalled();
  });
});
