import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  deliverAcceptedDepositInvoiceById: vi.fn(),
  reconcileQuoteOutcomeCadence: vi.fn(),
  insertCommercialAuditEvent: vi.fn(),
  rpc: vi.fn(),
  invoiceSingle: vi.fn(),
  taskDelete: vi.fn(),
  taskProjectEq: vi.fn(),
  taskKeyEq: vi.fn(),
  supabaseServiceRole: {
    from: vi.fn(),
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

function acceptanceRow(alreadyAccepted = false) {
  return [{
    quote_version_id: QUOTE_VERSION_UUID,
    already_accepted: alreadyAccepted,
    invoice_id: INVOICE_UUID,
    invoice_created: !alreadyAccepted,
  }];
}

describe('accepted quote project-work reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.supabaseServiceRole.rpc.mockImplementation(mocks.rpc);
    mocks.rpc.mockResolvedValue({
      data: acceptanceRow(),
      error: null,
    });
    mocks.invoiceSingle.mockResolvedValue({
      data: {
        id: INVOICE_UUID,
        invoice_ref: 'INV-1001',
        project_id: PROJECT_UUID,
      },
      error: null,
    });
    mocks.taskKeyEq.mockResolvedValue({ data: null, error: null });
    mocks.taskProjectEq.mockReturnValue({ eq: mocks.taskKeyEq });
    mocks.taskDelete.mockReturnValue({ eq: mocks.taskProjectEq });
    mocks.supabaseServiceRole.from.mockImplementation((table: string) => {
      if (table === 'deposit_invoices') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ single: mocks.invoiceSingle })),
          })),
        };
      }
      if (table === 'project_task_checks') {
        return { delete: mocks.taskDelete };
      }
      throw new Error(`Unexpected table ${table}`);
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

  it('reconciles an authoritative acceptance and skips legacy task cleanup for V2', async () => {
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
    expect(mocks.taskDelete).not.toHaveBeenCalled();
  });

  it('preserves legacy invoice-paid cleanup for an unmarked project', async () => {
    mocks.reconcileQuoteOutcomeCadence.mockResolvedValueOnce({
      status: 'not_applicable',
      workModel: 'legacy',
      commandId: 'command-id',
    });

    await acceptQuoteAndEnsureDepositInvoice({
      quoteVersionUuid: QUOTE_VERSION_UUID,
      actor: 'staff@example.test',
    });

    expect(mocks.taskDelete).toHaveBeenCalledOnce();
    expect(mocks.taskProjectEq).toHaveBeenCalledWith(
      'project_id',
      PROJECT_UUID,
    );
    expect(mocks.taskKeyEq).toHaveBeenCalledWith('task_key', 'invoice_paid');
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
    expect(mocks.taskDelete).not.toHaveBeenCalled();
  });

  it('retries reconciliation on an authoritative acceptance replay', async () => {
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
  });
});
