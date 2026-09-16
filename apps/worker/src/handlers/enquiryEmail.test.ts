import { describe, expect, it, vi } from 'vitest';
import { normalizeEmailMessage, type ResendEmailGateway } from '@sp/email-provider';
import type { BackgroundJobWorkerEffect } from '@sp/jobs';
import type { BackgroundJobHandler, BackgroundJobHandlerRpc } from '../runtime/contracts';
import { createEnquiryEmailHandler } from './enquiryEmail';

function fixture() {
  let effects: BackgroundJobWorkerEffect[] = [];
  const message = normalizeEmailMessage({ from: 'info@example.test', to: 'customer@example.test', subject: 'Received', html: '<p>Saved</p>' });
  const domain = {
    readEnquiryDelivery: vi.fn(async () => message),
    finaliseEnquiryDelivery: vi.fn(async () => {}),
  };
  const gateway: ResendEmailGateway = {
    dispatchLegacy: vi.fn(),
    dispatchDurable: vi.fn(async () => ({ outcome: 'accepted', code: 'RESEND_ACCEPTED', provider: 'resend', messageId: 'provider-1', statusCode: 200, durationMs: 1 } as const)),
  };
  const rpc: BackgroundJobHandlerRpc = {
    progress: vi.fn(),
    refreshEffects: vi.fn(async () => effects),
    recordEffectCheckpoint: vi.fn(async input => {
      const next: BackgroundJobWorkerEffect = {
        ...input, providerName: input.providerName ?? null,
        providerIdempotencyKey: input.providerIdempotencyKey ?? null,
        providerIdempotencyExpiresAt: input.providerIdempotencyExpiresAt ?? null,
        providerMessageId: input.providerMessageId ?? effects[0]?.providerMessageId ?? null,
        safeMetadata: input.safeMetadata ?? {},
      };
      effects = [next];
      return next;
    }),
  };
  const context: Parameters<BackgroundJobHandler>[0] = {
    claim: { jobId: '11111111-1111-4111-8111-111111111111', kind: 'email_outbox_deliver', contractVersion: 1,
      status: 'running', currentPhase: 'running', attemptNumber: 1, maxAttempts: 5, queueMessageId: 1,
      leaseToken: '22222222-2222-4222-8222-222222222222', leaseExpiresAt: '2026-09-14T12:00:00Z',
      cancellationRequestedAt: null, rolloutMode: 'worker_cohort', executionOwner: 'worker' },
    payload: { contractVersion: 1, payloadHash: 'a'.repeat(64), payload: { workflow: 'website_enquiry', outboxId: '33333333-3333-4333-8333-333333333333' } },
    effects, rpc, signal: new AbortController().signal,
    clock: { now: () => Date.parse('2026-09-14T10:00:00Z'), sleep: vi.fn() },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  };
  const handler = createEnquiryEmailHandler({ workerId: 'worker', rpc: domain, gateway });
  return { domain, gateway, context, handler, run: () => handler({ ...context, effects }), effects: () => effects };
}

describe('website enquiry email delivery', () => {
  it('sends the saved message and finalises the outbox once', async () => {
    const f = fixture();
    await f.run();
    expect(f.effects()[0].state).toBe('finalised');
    expect(f.domain.finaliseEnquiryDelivery).toHaveBeenCalledWith({ jobId: f.context.claim.jobId, workerId: 'worker', leaseToken: f.context.claim.leaseToken, providerMessageId: 'provider-1' });
    await f.run();
    expect(f.gateway.dispatchDurable).toHaveBeenCalledTimes(1);
    expect(f.gateway.dispatchLegacy).not.toHaveBeenCalled();
    expect(f.domain.finaliseEnquiryDelivery).toHaveBeenCalledTimes(1);
  });
  it('resumes finalisation after acceptance without sending again', async () => {
    const f = fixture();
    f.domain.finaliseEnquiryDelivery.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(f.run()).rejects.toThrow('database unavailable');
    expect(f.effects()[0].state).toBe('provider_accepted');
    await f.run();
    expect(f.gateway.dispatchDurable).toHaveBeenCalledTimes(1);
    expect(f.domain.finaliseEnquiryDelivery).toHaveBeenCalledTimes(2);
    expect(f.effects()[0].state).toBe('finalised');
  });
  it('does not send when the lease-protected message cannot be read', async () => {
    const f = fixture();
    f.domain.readEnquiryDelivery.mockRejectedValueOnce(new Error('lease lost'));
    await expect(f.run()).rejects.toThrow('lease lost');
    expect(f.gateway.dispatchDurable).not.toHaveBeenCalled();
  });
  it('rejects a different workflow before reading private email', async () => {
    const f = fixture();
    await expect(f.handler({ ...f.context, payload: { ...f.context.payload, payload: { workflow: 'quote' } } }))
      .rejects.toMatchObject({ code: 'ENQUIRY_EMAIL_PAYLOAD_INVALID' });
    expect(f.domain.readEnquiryDelivery).not.toHaveBeenCalled();
  });
});
