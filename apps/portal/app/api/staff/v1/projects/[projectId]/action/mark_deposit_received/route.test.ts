import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffContext: vi.fn(), rpc: vi.fn(), runEvent: vi.fn(), conversion: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/api/staffApi', () => ({
  requireStaffContext: (...args: unknown[]) => mocks.requireStaffContext(...args),
  parseJsonBody: async (request: Request) => ({ ok: true as const, body: await request.json() }),
  jsonError: (message: string, status = 400) => Response.json({ error: message }, { status }),
  jsonOk: (payload: object, status = 200) => Response.json(payload, { status }),
}));
vi.mock('@/lib/supabase/mappers', () => ({ uuidFromAppId: () => 'project-uuid' }));
vi.mock('@/lib/automation/AutomationRunner', () => ({ automationRunner: { runEvent: (...args: unknown[]) => mocks.runEvent(...args) } }));
vi.mock('@/lib/marketingAttribution/server', () => ({
  recordMarketingConversionEvent: (...args: unknown[]) => mocks.conversion(...args),
  normalizeMarketingConversionOccurredAt: (value: unknown) => typeof value === 'string' ? new Date(value).toISOString() : null,
  recentMarketingConversionOccurrence: (value: unknown) => typeof value === 'string' && new Date(value).getTime() > Date.now() - 72 * 60 * 60 * 1000 ? value : null,
}));

function request(paidDate: string) {
  return new Request('http://localhost/action', { method: 'POST', body: JSON.stringify({ paidDate }) });
}

async function invoke(paidDate = '2026-07-30') {
  const { POST } = await import('./route');
  return POST(request(paidDate), { params: Promise.resolve({ projectId: 'proj_1' }) });
}

function commandRow(changed = true, occurredAt: string | null = '2026-07-30T00:00:00.000Z') {
  return [{
    changed, previous_stage: changed ? 'SENT' : 'DEPOSIT', paid_date: '2026-07-30',
    occurred_at: occurredAt, invoice_id: 'invoice-uuid', quote_version_id: 'version-uuid',
    quote_total_inc_gst_cents: 120_000,
  }];
}

describe('mark deposit received commercial projection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-07-30T01:00:00.000Z');
    vi.clearAllMocks();
    mocks.requireStaffContext.mockResolvedValue({ ok: true, supabase: { rpc: mocks.rpc } });
    mocks.rpc.mockResolvedValue({ data: commandRow(), error: null });
    mocks.runEvent.mockResolvedValue(undefined);
    mocks.conversion.mockResolvedValue(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it('rejects invalid dates before invoking commercial truth', async () => {
    expect((await invoke('2026-02-30')).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('commits through the locked command before conversion and automation', async () => {
    const response = await invoke();
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('commercial_mark_project_deposit_received', {
      p_project_id: 'project-uuid', p_expected_paid_date: '2026-07-30',
    });
    expect(mocks.conversion).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-uuid', occurredAt: '2026-07-30T00:00:00.000Z',
      payload: expect.objectContaining({ depositInvoiceId: 'invoice-uuid', valueIncGstCents: 120_000 }),
    }));
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(mocks.conversion.mock.invocationCallOrder[0]);
    expect(mocks.runEvent).toHaveBeenCalledTimes(2);
  });

  it('rejects a typed date that does not match the paid invoice', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Deposit paid date must match the paid invoice date' } });
    const response = await invoke();
    expect(response.status).toBe(409);
    expect(mocks.conversion).not.toHaveBeenCalled();
  });

  it('repairs recent replay side effects without repeating the state change', async () => {
    mocks.rpc.mockResolvedValue({ data: commandRow(false), error: null });
    const response = await invoke();
    await expect(response.json()).resolves.toMatchObject({ replayed: true });
    expect(mocks.conversion).toHaveBeenCalledOnce();
  });

  it('fails visibly when a new transition has no immutable occurrence time', async () => {
    mocks.rpc.mockResolvedValue({ data: commandRow(true, null), error: null });
    expect((await invoke()).status).toBe(500);
    expect(mocks.conversion).not.toHaveBeenCalled();
  });
});
