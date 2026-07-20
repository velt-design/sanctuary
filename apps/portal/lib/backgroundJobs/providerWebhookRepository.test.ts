import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabaseClient', () => ({
  supabaseServiceRole: { rpc },
}));

const input = {
  provider: 'resend' as const,
  eventId: 'evt_123',
  eventType: 'email.sent' as const,
  providerMessageId: 'email_123',
  occurredAt: '2026-07-20T01:02:03.000Z',
  taggedJobId: '018f8f52-22f2-7f4d-8e13-0d1ccb612345',
  taggedEffectRef: 'a'.repeat(64),
};

describe('provider webhook repository', () => {
  beforeEach(() => {
    vi.resetModules();
    rpc.mockReset();
  });

  it.each(['accepted', 'reconciled', 'already_accepted', 'duplicate', 'unmatched', 'conflict'] as const)(
    'accepts the exact safe %s RPC outcome',
    async (outcome) => {
      rpc.mockResolvedValue({ data: outcome, error: null });
      const { reconcileVerifiedProviderAcceptance } = await import('./providerWebhookRepository');

      await expect(reconcileVerifiedProviderAcceptance(input)).resolves.toBe(outcome);
      expect(rpc).toHaveBeenCalledWith(
        'background_job_reconcile_verified_provider_acceptance',
        {
          p_provider_name: 'resend',
          p_provider_event_id: 'evt_123',
          p_provider_event_type: 'email.sent',
          p_provider_message_id: 'email_123',
          p_provider_created_at: '2026-07-20T01:02:03.000Z',
          p_tagged_job_id: '018f8f52-22f2-7f4d-8e13-0d1ccb612345',
          p_tagged_effect_ref: 'a'.repeat(64),
        },
      );
    },
  );

  it.each([
    ['23505', 'PROVIDER_RECONCILIATION_CONFLICT'],
    ['22023', 'PROVIDER_RECONCILIATION_REJECTED'],
    ['08006', 'PROVIDER_RECONCILIATION_FAILED'],
  ] as const)('maps database code %s without exposing provider or database detail', async (code, expected) => {
    rpc.mockResolvedValue({ data: null, error: { code, message: 'sensitive database detail' } });
    const { reconcileVerifiedProviderAcceptance } = await import('./providerWebhookRepository');

    await expect(reconcileVerifiedProviderAcceptance(input)).rejects.toMatchObject({
      name: 'ProviderWebhookRepositoryError',
      code: expected,
      message: expected,
    });
  });

  it('rejects a malformed RPC response', async () => {
    rpc.mockResolvedValue({ data: { outcome: 'accepted' }, error: null });
    const { reconcileVerifiedProviderAcceptance } = await import('./providerWebhookRepository');

    await expect(reconcileVerifiedProviderAcceptance(input)).rejects.toMatchObject({
      code: 'PROVIDER_RECONCILIATION_INVALID_RESPONSE',
    });
  });
});
