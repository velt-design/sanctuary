import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();

vi.mock('../supabaseClient', () => ({
  supabaseServiceRole: { rpc },
}));

const intentRow = {
  id: '11111111-1111-4111-8111-111111111111',
  intent_key: 'quote-send:subject:intent',
  kind: 'quote_send',
  subject_id: '22222222-2222-4222-8222-222222222222',
  project_id: '33333333-3333-4333-8333-333333333333',
  payload_hash: 'a'.repeat(64),
  protected_payload: { subject: 'Frozen quote' },
  status: 'prepared',
  provider_name: 'resend',
  provider_idempotency_key: 'commercial-email/provider-key',
  provider_idempotency_expires_at: '2026-07-29T00:00:00.000Z',
  provider_message_id: null,
  attempt_count: 0,
  last_error_code: null,
  created_at: '2026-07-28T00:00:00.000Z',
  updated_at: '2026-07-28T00:00:00.000Z',
};

describe('commercial email intents', () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it('hashes equivalent frozen payloads identically regardless of key order', async () => {
    const { commercialEmailPayloadHash } = await import('./emailIntent');

    expect(
      commercialEmailPayloadHash({
        to: ['customer@example.com'],
        nested: { b: 2, a: 1 },
      }),
    ).toBe(
      commercialEmailPayloadHash({
        nested: { a: 1, b: 2 },
        to: ['customer@example.com'],
      }),
    );
    expect(
      commercialEmailPayloadHash({ subject: 'Quote A' }),
    ).not.toBe(commercialEmailPayloadHash({ subject: 'Quote B' }));
  });

  it('classifies a missing commercial RPC as schema not ready', async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: 'PGRST202',
        message:
          'Could not find the function public.commercial_email_read_unfinished',
      },
    });

    const {
      CommercialWorkflowSchemaNotReadyError,
      findUnfinishedCommercialEmailIntent,
    } = await import('./emailIntent');

    await expect(
      findUnfinishedCommercialEmailIntent(
        'quote_send',
        intentRow.subject_id,
      ),
    ).rejects.toBeInstanceOf(CommercialWorkflowSchemaNotReadyError);
  });

  it('lets read-only quote detail degrade when the recovery RPC is absent', async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: 'PGRST202',
        message:
          'Could not find the function public.commercial_email_read_unfinished',
      },
    });

    const { inspectUnfinishedCommercialEmailIntent } = await import(
      './emailIntent'
    );

    await expect(
      inspectUnfinishedCommercialEmailIntent(
        'quote_send',
        intentRow.subject_id,
      ),
    ).resolves.toEqual({
      schemaReady: false,
      intent: null,
    });
  });

  it('returns the winning frozen intent after a concurrent unique-key race', async () => {
    const {
      commercialEmailPayloadHash,
      prepareCommercialEmailIntent,
    } = await import('./emailIntent');
    const protectedPayload = { subject: 'Frozen quote' };
    rpc
      .mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate key' },
      })
      .mockResolvedValueOnce({
        data: [
          {
            ...intentRow,
            payload_hash: commercialEmailPayloadHash(protectedPayload),
            protected_payload: protectedPayload,
          },
        ],
        error: null,
      });

    const intent = await prepareCommercialEmailIntent({
      intentKey: intentRow.intent_key,
      kind: 'quote_send',
      subjectId: intentRow.subject_id,
      projectId: intentRow.project_id,
      protectedPayload,
      nowMs: Date.parse('2026-07-28T00:00:00.000Z'),
    });

    expect(intent.id).toBe(intentRow.id);
    expect(intent.protectedPayload).toEqual({ subject: 'Frozen quote' });
    expect(rpc).toHaveBeenNthCalledWith(2, 'commercial_email_read_by_key', {
      p_intent_key: intentRow.intent_key,
    });
  });

  it('rejects a reused intent key when the frozen payload differs', async () => {
    rpc
      .mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate key' },
      })
      .mockResolvedValueOnce({ data: [intentRow], error: null });

    const { prepareCommercialEmailIntent } = await import('./emailIntent');
    await expect(
      prepareCommercialEmailIntent({
        intentKey: intentRow.intent_key,
        kind: 'quote_send',
        subjectId: intentRow.subject_id,
        projectId: intentRow.project_id,
        protectedPayload: { subject: 'Different quote' },
        nowMs: Date.parse('2026-07-28T00:00:00.000Z'),
      }),
    ).rejects.toThrow('different frozen content');
  });

  it('prepares the frozen quote intent and reserves its revision in one RPC', async () => {
    rpc
      .mockResolvedValueOnce({
        data: [{ intent_id: intentRow.id }],
        error: null,
      })
      .mockResolvedValueOnce({ data: [intentRow], error: null });

    const { prepareQuoteDeliveryEmailIntent } = await import('./emailIntent');
    await prepareQuoteDeliveryEmailIntent({
      quoteVersionId: intentRow.subject_id,
      expectedCommercialRevision: 7,
      intentKey: intentRow.intent_key,
      kind: 'quote_send',
      subjectId: intentRow.subject_id,
      projectId: intentRow.project_id,
      protectedPayload: intentRow.protected_payload,
      nowMs: Date.parse('2026-07-28T00:00:00.000Z'),
    });

    expect(rpc).toHaveBeenNthCalledWith(
      1,
      'commercial_quote_prepare_delivery_email',
      expect.objectContaining({
        p_quote_version_id: intentRow.subject_id,
        p_expected_commercial_revision: 7,
        p_intent_key: intentRow.intent_key,
      }),
    );
  });

  it('separates retryable provider uncertainty from staff-attention failures', async () => {
    const { commercialEmailFailure } = await import('./emailIntent');

    expect(
      commercialEmailFailure({
        code: 'EMAIL_PROVIDER_TIMEOUT',
        outcome: 'uncertain',
      }),
    ).toEqual({
      code: 'EMAIL_PROVIDER_TIMEOUT',
      needsAttention: false,
    });
    expect(
      commercialEmailFailure({
        code: 'EMAIL_PROVIDER_REJECTED',
        outcome: 'terminal_rejection',
      }),
    ).toEqual({
      code: 'EMAIL_PROVIDER_REJECTED',
      needsAttention: true,
    });
    expect(
      commercialEmailFailure({
        code: 'EMAIL_PROVIDER_NOT_CONFIGURED',
        outcome: 'configuration_error',
      }),
    ).toEqual({
      code: 'EMAIL_PROVIDER_NOT_CONFIGURED',
      needsAttention: false,
    });
  });
});
