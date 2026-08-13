import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  deliverAcceptedDepositInvoiceById: vi.fn(),
  reconcileQuoteOutcomeCadence: vi.fn(),
  insertCommercialAuditEvent: vi.fn(),
  recordMarketingConversionEvent: vi.fn(),
  rpc: vi.fn(),
  supabaseServiceRole: {
    rpc: vi.fn(),
  },
}));

vi.mock('../invoices/server', () => ({
  deliverAcceptedDepositInvoiceById:
    mocks.deliverAcceptedDepositInvoiceById,
}));

vi.mock('../projects/workItems/quoteCadenceReconciliation', () => ({
  reconcileQuoteOutcomeCadence: mocks.reconcileQuoteOutcomeCadence,
}));

vi.mock('../marketingAttribution/server', () => ({
  recordMarketingConversionEvent: mocks.recordMarketingConversionEvent,
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

vi.mock('../supabaseClient', () => ({
  supabaseServiceRole: mocks.supabaseServiceRole,
}));

vi.mock('./audit', () => ({
  insertCommercialAuditEvent: mocks.insertCommercialAuditEvent,
}));

import { acceptQuoteAndEnsureDepositInvoice } from './acceptQuote';

const PROJECT_UUID = '11111111-1111-4111-8111-111111111111';
const QUOTE_VERSION_UUID = '22222222-2222-4222-8222-222222222222';
const INVOICE_UUID = '33333333-3333-4333-8333-333333333333';
const INVOICE_CREATED_AT = '2026-07-30T01:00:00.000Z';

function acceptanceRow(alreadyAccepted = false) {
  return [{
    quote_version_id: QUOTE_VERSION_UUID,
    already_accepted: alreadyAccepted,
    invoice_id: INVOICE_UUID,
    invoice_ref: 'INV-1001',
    invoice_project_id: PROJECT_UUID,
    invoice_quote_id: '44444444-4444-4444-8444-444444444444',
    invoice_quote_total_inc_gst_cents: 120000,
    invoice_created_at: INVOICE_CREATED_AT,
    invoice_created: !alreadyAccepted,
  }];
}

describe('accepted quote project-work reconciliation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-07-30T02:00:00.000Z');
    vi.clearAllMocks();
    mocks.supabaseServiceRole.rpc.mockImplementation(mocks.rpc);
    mocks.rpc.mockResolvedValue({
      data: acceptanceRow(),
      error: null,
    });
    mocks.deliverAcceptedDepositInvoiceById.mockResolvedValue({
      sent: true,
      sendError: null,
      deliveryState: 'sent',
    });
    mocks.reconcileQuoteOutcomeCadence.mockResolvedValue({
      status: 'reconciled',
      workModel: 'v2',
      replayed: false,
      commandId: 'command-id',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reconciles an authoritative acceptance', async () => {
    const result = await acceptQuoteAndEnsureDepositInvoice({
      quoteVersionUuid: QUOTE_VERSION_UUID,
      actor: 'staff@example.test',
    });

    expect(result.invoice.sent).toBe(true);
    expect(mocks.reconcileQuoteOutcomeCadence).toHaveBeenCalledWith({
      serviceClient: mocks.supabaseServiceRole,
      projectId: PROJECT_UUID,
      quoteVersionId: QUOTE_VERSION_UUID,
      outcome: 'ACCEPTED',
    });
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.reconcileQuoteOutcomeCadence.mock.invocationCallOrder[0],
    );
    expect(mocks.recordMarketingConversionEvent).toHaveBeenCalledWith({
      type: 'marketing.quote_accepted',
      projectId: PROJECT_UUID,
      primaryId: QUOTE_VERSION_UUID,
      occurredAt: INVOICE_CREATED_AT,
      payload: {
        quoteVersionId: QUOTE_VERSION_UUID,
        quoteId: '44444444-4444-4444-8444-444444444444',
        valueIncGstCents: 120000,
      },
    });
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.recordMarketingConversionEvent.mock.invocationCallOrder[0],
    );
  });

  it('returns the accepted result when reconciliation needs repair', async () => {
    mocks.reconcileQuoteOutcomeCadence.mockResolvedValueOnce({
      status: 'repair_required',
      workModel: 'unknown',
      commandId: 'command-id',
      message: 'marker unavailable',
    });

    await expect(
      acceptQuoteAndEnsureDepositInvoice({
        quoteVersionUuid: QUOTE_VERSION_UUID,
        actor: 'staff@example.test',
      }),
    ).resolves.toMatchObject({
      quoteVersionUuid: QUOTE_VERSION_UUID,
      invoice: { id: INVOICE_UUID, sent: true },
    });
  });

  it('uses the locked command snapshot without a follow-up financial read', async () => {
    const result = await acceptQuoteAndEnsureDepositInvoice({
      quoteVersionUuid: QUOTE_VERSION_UUID,
      actor: 'staff@example.test',
    });

    expect(result.invoice.invoiceRef).toBe('INV-1001');
    expect(mocks.supabaseServiceRole).not.toHaveProperty('from');
  });

  it('does not report acceptance as failed when a post-commit follow-up throws', async () => {
    mocks.recordMarketingConversionEvent.mockRejectedValueOnce(
      new Error('conversion unavailable'),
    );
    mocks.reconcileQuoteOutcomeCadence.mockRejectedValueOnce(
      new Error('work reconciliation unavailable'),
    );

    await expect(
      acceptQuoteAndEnsureDepositInvoice({
        quoteVersionUuid: QUOTE_VERSION_UUID,
        actor: 'staff@example.test',
      }),
    ).resolves.toMatchObject({
      quoteVersionUuid: QUOTE_VERSION_UUID,
      invoice: { id: INVOICE_UUID, sent: true },
    });
    expect(mocks.deliverAcceptedDepositInvoiceById).toHaveBeenCalledOnce();
  });

  it('repairs reconciliation and the idempotent conversion on an authoritative acceptance replay', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: acceptanceRow(true),
      error: null,
    });

    const result = await acceptQuoteAndEnsureDepositInvoice({
      quoteVersionUuid: QUOTE_VERSION_UUID,
      actor: 'staff@example.test',
    });

    expect(result.alreadyAccepted).toBe(true);
    expect(mocks.reconcileQuoteOutcomeCadence).toHaveBeenCalledOnce();
    expect(mocks.insertCommercialAuditEvent).not.toHaveBeenCalled();
    expect(mocks.recordMarketingConversionEvent).toHaveBeenCalledWith({
      type: 'marketing.quote_accepted',
      projectId: PROJECT_UUID,
      primaryId: QUOTE_VERSION_UUID,
      occurredAt: INVOICE_CREATED_AT,
      payload: {
        quoteVersionId: QUOTE_VERSION_UUID,
        quoteId: '44444444-4444-4444-8444-444444444444',
        valueIncGstCents: 120000,
      },
    });
  });

  it('does not create a fresh conversion when an old acceptance is replayed', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{
        ...acceptanceRow(true)[0],
        invoice_created_at: '2026-07-26T01:00:00.000Z',
      }],
      error: null,
    });

    const result = await acceptQuoteAndEnsureDepositInvoice({
      quoteVersionUuid: QUOTE_VERSION_UUID,
      actor: 'staff@example.test',
    });

    expect(result.alreadyAccepted).toBe(true);
    expect(mocks.reconcileQuoteOutcomeCadence).toHaveBeenCalledOnce();
    expect(mocks.recordMarketingConversionEvent).not.toHaveBeenCalled();
  });
});
