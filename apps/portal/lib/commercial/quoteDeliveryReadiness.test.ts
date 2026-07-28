import { beforeEach, describe, expect, it, vi } from 'vitest';

const inspectUnfinishedCommercialEmailIntent = vi.fn();

vi.mock('./emailIntent', () => ({
  inspectUnfinishedCommercialEmailIntent,
}));

describe('quote delivery readiness', () => {
  beforeEach(() => {
    inspectUnfinishedCommercialEmailIntent.mockReset();
  });

  it('keeps quote review available when the commercial migration is absent', async () => {
    inspectUnfinishedCommercialEmailIntent.mockResolvedValueOnce({
      schemaReady: false,
      intent: null,
    });

    const { loadQuoteDeliveryReadiness } = await import(
      './quoteDeliveryReadiness'
    );

    await expect(
      loadQuoteDeliveryReadiness(
        '22222222-2222-4222-8222-222222222222',
        Date.parse('2026-07-28T12:00:00.000Z'),
      ),
    ).resolves.toEqual({
      commercialWorkflowReady: false,
      unfinishedDelivery: null,
    });
    expect(inspectUnfinishedCommercialEmailIntent).toHaveBeenCalledTimes(1);
  });

  it('returns an exact retryable delivery when the migration is ready', async () => {
    inspectUnfinishedCommercialEmailIntent
      .mockResolvedValueOnce({
        schemaReady: true,
        intent: {
          kind: 'quote_send',
          status: 'failed',
          providerIdempotencyExpiresAt: '2026-07-29T00:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({
        schemaReady: true,
        intent: null,
      });

    const { loadQuoteDeliveryReadiness } = await import(
      './quoteDeliveryReadiness'
    );

    await expect(
      loadQuoteDeliveryReadiness(
        '22222222-2222-4222-8222-222222222222',
        Date.parse('2026-07-28T12:00:00.000Z'),
      ),
    ).resolves.toEqual({
      commercialWorkflowReady: true,
      unfinishedDelivery: {
        mode: 'send',
        status: 'failed',
        canRetry: true,
      },
    });
  });

  it('does not offer automatic retry for staff-attention deliveries', async () => {
    inspectUnfinishedCommercialEmailIntent
      .mockResolvedValueOnce({
        schemaReady: true,
        intent: null,
      })
      .mockResolvedValueOnce({
        schemaReady: true,
        intent: {
          kind: 'quote_resend',
          status: 'needs_attention',
          providerIdempotencyExpiresAt: '2026-07-29T00:00:00.000Z',
        },
      });

    const { loadQuoteDeliveryReadiness } = await import(
      './quoteDeliveryReadiness'
    );

    await expect(
      loadQuoteDeliveryReadiness(
        '22222222-2222-4222-8222-222222222222',
        Date.parse('2026-07-28T12:00:00.000Z'),
      ),
    ).resolves.toEqual({
      commercialWorkflowReady: true,
      unfinishedDelivery: {
        mode: 'resend',
        status: 'needs_attention',
        canRetry: false,
      },
    });
  });
});
