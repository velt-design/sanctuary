import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  isProjectWorkModelV2: vi.fn(),
  reconcileProjectWork: vi.fn(),
  setQuoteCadenceRepairSignal: vi.fn(),
}));

vi.mock('./modelBoundary', () => ({
  isProjectWorkModelV2: dependencies.isProjectWorkModelV2,
}));

vi.mock('./commands', () => ({
  reconcileProjectWork: dependencies.reconcileProjectWork,
  setQuoteCadenceRepairSignal: dependencies.setQuoteCadenceRepairSignal,
}));

import {
  quoteDeliveryCadenceCommandId,
  quoteOutcomeCadenceCommandId,
  reconcileQuoteDeliveryCadence,
  reconcileQuoteOutcomeCadence,
} from './quoteCadenceReconciliation';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const QUOTE_VERSION_ID = '22222222-2222-4222-8222-222222222222';
const NEXT_QUOTE_VERSION_ID = '33333333-3333-4333-8333-333333333333';
const serviceClient = { rpc: vi.fn(), from: vi.fn() } as any;

describe('quote cadence reconciliation adapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    dependencies.isProjectWorkModelV2.mockReset().mockResolvedValue(true);
    dependencies.reconcileProjectWork.mockReset().mockResolvedValue({
      replayed: false,
    });
    dependencies.setQuoteCadenceRepairSignal.mockReset().mockResolvedValue({
      replayed: false,
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('uses a stable UUID scoped to the delivery intent and exact quote version', () => {
    const first = quoteDeliveryCadenceCommandId({
      event: 'QUOTE_SENT',
      quoteVersionId: QUOTE_VERSION_ID,
      deliveryIntentId: 'delivery-intent-1',
    });

    expect(first).toBe(
      quoteDeliveryCadenceCommandId({
        event: 'QUOTE_SENT',
        quoteVersionId: QUOTE_VERSION_ID,
        deliveryIntentId: 'delivery-intent-1',
      }),
    );
    expect(first).not.toBe(
      quoteDeliveryCadenceCommandId({
        event: 'QUOTE_RESENT',
        quoteVersionId: QUOTE_VERSION_ID,
        deliveryIntentId: 'delivery-intent-1',
      }),
    );
    expect(first).not.toBe(
      quoteDeliveryCadenceCommandId({
        event: 'QUOTE_SENT',
        quoteVersionId: NEXT_QUOTE_VERSION_ID,
        deliveryIntentId: 'delivery-intent-1',
      }),
    );
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('reconciles a durable send with the narrow RPC payload', async () => {
    const result = await reconcileQuoteDeliveryCadence({
      serviceClient,
      projectId: PROJECT_ID,
      quoteVersionId: QUOTE_VERSION_ID,
      deliveryIntentId: 'delivery-intent-1',
      event: 'QUOTE_SENT',
    });

    expect(result).toMatchObject({
      status: 'reconciled',
      workModel: 'v2',
      replayed: false,
    });
    expect(dependencies.reconcileProjectWork).toHaveBeenCalledWith(
      serviceClient,
      {
        projectId: PROJECT_ID,
        commandId: quoteDeliveryCadenceCommandId({
          event: 'QUOTE_SENT',
          quoteVersionId: QUOTE_VERSION_ID,
          deliveryIntentId: 'delivery-intent-1',
        }),
        event: 'QUOTE_SENT',
        payload: { quote_version_id: QUOTE_VERSION_ID },
      },
    );
    expect(dependencies.setQuoteCadenceRepairSignal).toHaveBeenCalledWith(
      serviceClient,
      {
        projectId: PROJECT_ID,
        commandId: quoteDeliveryCadenceCommandId({
          event: 'QUOTE_SENT',
          quoteVersionId: QUOTE_VERSION_ID,
          deliveryIntentId: 'delivery-intent-1',
        }),
        event: 'QUOTE_SENT',
        quoteVersionId: QUOTE_VERSION_ID,
        action: 'RESOLVE',
      },
    );
  });

  it('does not call the service-only RPC for a legacy project', async () => {
    dependencies.isProjectWorkModelV2.mockResolvedValueOnce(false);

    await expect(
      reconcileQuoteDeliveryCadence({
        serviceClient,
        projectId: PROJECT_ID,
        quoteVersionId: QUOTE_VERSION_ID,
        deliveryIntentId: 'delivery-intent-1',
        event: 'QUOTE_SENT',
      }),
    ).resolves.toMatchObject({
      status: 'not_applicable',
      workModel: 'legacy',
    });
    expect(dependencies.reconcileProjectWork).not.toHaveBeenCalled();
    expect(dependencies.setQuoteCadenceRepairSignal).not.toHaveBeenCalled();
  });

  it('preserves legacy behaviour before the model-marker schema is installed', async () => {
    dependencies.isProjectWorkModelV2.mockRejectedValueOnce(
      Object.assign(
        new Error('relation project_work_model_versions does not exist'),
        { code: '42P01' },
      ),
    );

    await expect(
      reconcileQuoteOutcomeCadence({
        serviceClient,
        projectId: PROJECT_ID,
        quoteVersionId: QUOTE_VERSION_ID,
        outcome: 'ACCEPTED',
      }),
    ).resolves.toMatchObject({
      status: 'not_applicable',
      workModel: 'legacy',
    });
    expect(dependencies.reconcileProjectWork).not.toHaveBeenCalled();
    expect(dependencies.setQuoteCadenceRepairSignal).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('returns repair-required instead of rejecting after a marker or RPC failure', async () => {
    dependencies.isProjectWorkModelV2.mockRejectedValueOnce(
      new Error('marker unavailable'),
    );
    await expect(
      reconcileQuoteDeliveryCadence({
        serviceClient,
        projectId: PROJECT_ID,
        quoteVersionId: QUOTE_VERSION_ID,
        deliveryIntentId: 'delivery-intent-1',
        event: 'QUOTE_SENT',
      }),
    ).resolves.toMatchObject({
      status: 'repair_required',
      workModel: 'unknown',
      message: 'marker unavailable',
    });

    dependencies.reconcileProjectWork.mockRejectedValueOnce(
      new Error('calendar unavailable'),
    );
    await expect(
      reconcileQuoteDeliveryCadence({
        serviceClient,
        projectId: PROJECT_ID,
        quoteVersionId: QUOTE_VERSION_ID,
        deliveryIntentId: 'delivery-intent-2',
        event: 'QUOTE_RESENT',
      }),
    ).resolves.toMatchObject({
      status: 'repair_required',
      workModel: 'v2',
      message: 'calendar unavailable',
      repairRecorded: true,
    });
    expect(dependencies.setQuoteCadenceRepairSignal).toHaveBeenLastCalledWith(
      serviceClient,
      expect.objectContaining({
        projectId: PROJECT_ID,
        event: 'QUOTE_RESENT',
        quoteVersionId: QUOTE_VERSION_ID,
        action: 'OPEN',
        errorCode: 'QUOTE_CADENCE_RECONCILIATION_FAILED',
        errorMessage: 'Quote follow-up work is out of sync and needs repair.',
      }),
    );
  });

  it('reports a repair when successful reconciliation cannot clear durable repair state', async () => {
    dependencies.setQuoteCadenceRepairSignal.mockRejectedValueOnce(
      new Error('repair state unavailable'),
    );

    await expect(
      reconcileQuoteOutcomeCadence({
        serviceClient,
        projectId: PROJECT_ID,
        quoteVersionId: QUOTE_VERSION_ID,
        outcome: 'DECLINED',
      }),
    ).resolves.toMatchObject({
      status: 'repair_required',
      workModel: 'v2',
      message: 'Quote follow-up repair state could not be cleared',
      repairRecorded: false,
    });
  });

  it.each(['ACCEPTED', 'DECLINED'] as const)(
    'reconciles %s against the exact quote version',
    async (outcome) => {
      const result = await reconcileQuoteOutcomeCadence({
        serviceClient,
        projectId: PROJECT_ID,
        quoteVersionId: QUOTE_VERSION_ID,
        outcome,
      });

      expect(result.status).toBe('reconciled');
      expect(dependencies.reconcileProjectWork).toHaveBeenCalledWith(
        serviceClient,
        {
          projectId: PROJECT_ID,
          commandId: quoteOutcomeCadenceCommandId({
            outcome,
            quoteVersionId: QUOTE_VERSION_ID,
          }),
          event: 'QUOTE_OUTCOME',
          payload: {
            quote_version_id: QUOTE_VERSION_ID,
            outcome,
          },
        },
      );
    },
  );

  it('keys supersession by both old and new versions but sends only the RPC contract fields', async () => {
    await reconcileQuoteOutcomeCadence({
      serviceClient,
      projectId: PROJECT_ID,
      quoteVersionId: QUOTE_VERSION_ID,
      supersedingQuoteVersionId: NEXT_QUOTE_VERSION_ID,
      outcome: 'SUPERSEDED',
    });

    const commandId = quoteOutcomeCadenceCommandId({
      outcome: 'SUPERSEDED',
      quoteVersionId: QUOTE_VERSION_ID,
      supersedingQuoteVersionId: NEXT_QUOTE_VERSION_ID,
    });
    expect(commandId).not.toBe(
      quoteOutcomeCadenceCommandId({
        outcome: 'SUPERSEDED',
        quoteVersionId: QUOTE_VERSION_ID,
        supersedingQuoteVersionId: PROJECT_ID,
      }),
    );
    expect(dependencies.reconcileProjectWork).toHaveBeenCalledWith(
      serviceClient,
      {
        projectId: PROJECT_ID,
        commandId,
        event: 'QUOTE_OUTCOME',
        payload: {
          quote_version_id: QUOTE_VERSION_ID,
          outcome: 'SUPERSEDED',
        },
      },
    );
  });
});
