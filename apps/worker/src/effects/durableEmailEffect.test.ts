import { createHash } from 'node:crypto';

import {
  RESEND_PROVIDER_NAME,
  createDurableResendEmailDispatch,
  createResendIdempotencyExpiresAt,
  type DurableResendEmailDispatch,
  type EmailMessageInput,
  type ResendDispatchOutcome,
  type ResendEmailGateway,
} from '@sp/email-provider';
import type { BackgroundJobWorkerEffect } from '@sp/jobs';
import { describe, expect, it, vi } from 'vitest';

import type { BackgroundJobHandlerRpc, RuntimeClock } from '../runtime/contracts';
import {
  DURABLE_EMAIL_PROVIDER_TIMEOUT_MS,
  dispatchDurableEmailEffect,
  finaliseDurableEmailEffect,
} from './durableEmailEffect';

const NOW = Date.parse('2026-07-20T01:02:03.000Z');
const JOB_ID = '11111111-1111-4111-8111-111111111111';
const EFFECT_KEY = 'commercial-email:quote-42';
const PROVIDER_MESSAGE_ID = 'resend-message-42';
const EXPIRY = createResendIdempotencyExpiresAt(NOW);

const MESSAGE = Object.freeze({
  from: 'Sanctuary <quotes@sanctuary.example>',
  to: ['customer@example.com'],
  cc: ['accounts@example.com'],
  replyTo: ['reply@example.com'],
  subject: 'Your Sanctuary quote',
  html: '<p>Quote token: quote-token-42</p>',
  text: 'Quote token: quote-token-42',
  attachments: [
    {
      filename: 'quote.pdf',
      content: new Uint8Array([37, 80, 68, 70, 45, 49]),
      contentType: 'application/pdf',
    },
  ],
}) satisfies EmailMessageInput;

const BASE_DISPATCH = createDurableResendEmailDispatch({
  jobId: JOB_ID,
  effectKey: EFFECT_KEY,
  idempotencyExpiresAt: EXPIRY,
  message: MESSAGE,
});

type CheckpointInput = Parameters<BackgroundJobHandlerRpc['recordEffectCheckpoint']>[0];

function clock(now = NOW): RuntimeClock {
  return {
    now: () => now,
    sleep: vi.fn(async () => undefined),
  };
}

function effect(
  dispatch: DurableResendEmailDispatch,
  state: BackgroundJobWorkerEffect['state'],
  overrides: Partial<BackgroundJobWorkerEffect> = {},
): BackgroundJobWorkerEffect {
  return {
    effectKey: dispatch.effectKey,
    effectKind: 'email_dispatch',
    state,
    payloadHash: dispatch.payloadHash,
    providerName: dispatch.provider,
    providerIdempotencyKey: dispatch.idempotencyKey,
    providerIdempotencyExpiresAt: dispatch.idempotencyExpiresAt,
    providerMessageId:
      state === 'provider_accepted' || state === 'finalised' ? PROVIDER_MESSAGE_ID : null,
    safeMetadata: {
      effectKind: 'email_dispatch',
      checkpoint: state,
      providerName: RESEND_PROVIDER_NAME,
    },
    ...overrides,
  };
}

type RpcFixtureOptions = Readonly<{
  onRefresh?: (
    callNumber: number,
    effects: readonly BackgroundJobWorkerEffect[],
  ) => readonly BackgroundJobWorkerEffect[] | undefined;
  onRecord?: (
    input: CheckpointInput,
    effects: readonly BackgroundJobWorkerEffect[],
  ) => BackgroundJobWorkerEffect | undefined | Promise<BackgroundJobWorkerEffect | undefined>;
}>;

function rpcFixture(
  initialEffects: readonly BackgroundJobWorkerEffect[] = [],
  options: RpcFixtureOptions = {},
) {
  let current = [...initialEffects];
  let refreshCount = 0;

  const recordEffectCheckpoint = vi.fn(async (input: CheckpointInput) => {
    const overridden = await options.onRecord?.(input, current);
    if (overridden) {
      current = [overridden];
      return overridden;
    }

    const previous = current.find((candidate) => candidate.effectKind === input.effectKind);
    const next: BackgroundJobWorkerEffect = {
      effectKey: input.effectKey,
      effectKind: input.effectKind,
      state: input.state,
      payloadHash: input.payloadHash,
      providerName: input.providerName ?? null,
      providerIdempotencyKey: input.providerIdempotencyKey ?? null,
      providerIdempotencyExpiresAt: input.providerIdempotencyExpiresAt ?? null,
      providerMessageId: input.providerMessageId ?? previous?.providerMessageId ?? null,
      safeMetadata: input.safeMetadata ?? {},
    };
    current = [next];
    return next;
  });

  const refreshEffects = vi.fn(async () => {
    refreshCount += 1;
    const refreshed = options.onRefresh?.(refreshCount, current);
    if (refreshed) current = [...refreshed];
    return current;
  });

  const rpc: BackgroundJobHandlerRpc = {
    progress: vi.fn(async () => {
      throw new Error('progress is outside the durable-email coordinator contract');
    }),
    recordEffectCheckpoint,
    refreshEffects,
  };

  return {
    rpc,
    recordEffectCheckpoint,
    refreshEffects,
    effects: () => current,
  };
}

function gatewayFixture(outcome: ResendDispatchOutcome) {
  const dispatchDurable = vi.fn(async () => outcome);
  const gateway: ResendEmailGateway = {
    dispatchDurable,
    dispatchLegacy: vi.fn(async () => {
      throw new Error('legacy dispatch must not be used');
    }),
  };
  return { gateway, dispatchDurable };
}

function acceptedOutcome(messageId = PROVIDER_MESSAGE_ID): ResendDispatchOutcome {
  return {
    outcome: 'accepted',
    code: 'RESEND_ACCEPTED',
    provider: RESEND_PROVIDER_NAME,
    messageId,
    statusCode: 200,
    durationMs: 11,
  };
}

function dispatchInput(input: Readonly<{
  rpc: BackgroundJobHandlerRpc;
  gateway: ResendEmailGateway;
  message?: EmailMessageInput;
  effects?: readonly BackgroundJobWorkerEffect[];
  signal?: AbortSignal;
  now?: number;
  timeoutMs?: number;
}>) {
  return {
    jobId: JOB_ID,
    effectKey: EFFECT_KEY,
    message: input.message ?? MESSAGE,
    effects: input.effects ?? [],
    rpc: input.rpc,
    gateway: input.gateway,
    clock: clock(input.now),
    signal: input.signal ?? new AbortController().signal,
    ...(input.timeoutMs === undefined ? {} : { timeoutMs: input.timeoutMs }),
  };
}

function recordedStates(fixture: ReturnType<typeof rpcFixture>) {
  return fixture.recordEffectCheckpoint.mock.calls.map(([input]) => input.state);
}

describe('durable email effect coordinator', () => {
  it('freezes one dispatch identity and checkpoints preparation, dispatch, and acceptance', async () => {
    const rpc = rpcFixture();
    const gateway = gatewayFixture(acceptedOutcome());

    const acceptance = await dispatchDurableEmailEffect(dispatchInput({
      rpc: rpc.rpc,
      gateway: gateway.gateway,
    }));

    expect(recordedStates(rpc)).toEqual(['prepared', 'dispatch_started', 'provider_accepted']);
    expect(gateway.dispatchDurable).toHaveBeenCalledOnce();
    expect(gateway.dispatchDurable).toHaveBeenCalledWith(
      BASE_DISPATCH,
      expect.objectContaining({ timeoutMs: DURABLE_EMAIL_PROVIDER_TIMEOUT_MS }),
    );
    expect(acceptance).toMatchObject({
      providerMessageId: PROVIDER_MESSAGE_ID,
      dispatch: {
        idempotencyKey: BASE_DISPATCH.idempotencyKey,
        payloadHash: BASE_DISPATCH.payloadHash,
        canonicalRequestBody: BASE_DISPATCH.canonicalRequestBody,
        tags: BASE_DISPATCH.tags,
      },
      effect: { state: 'provider_accepted' },
    });

    const identities = rpc.recordEffectCheckpoint.mock.calls.map(([input]) => ({
      effectKey: input.effectKey,
      payloadHash: input.payloadHash,
      providerName: input.providerName,
      providerIdempotencyKey: input.providerIdempotencyKey,
      providerIdempotencyExpiresAt: input.providerIdempotencyExpiresAt,
    }));
    expect(new Set(identities.map((identity) => JSON.stringify(identity))).size).toBe(1);
  });

  it('short-circuits an accepted effect without another provider call', async () => {
    const accepted = effect(BASE_DISPATCH, 'provider_accepted');
    const rpc = rpcFixture([accepted]);
    const gateway = gatewayFixture(acceptedOutcome('must-not-be-used'));

    const result = await dispatchDurableEmailEffect(dispatchInput({
      rpc: rpc.rpc,
      gateway: gateway.gateway,
      effects: [accepted],
    }));

    expect(result.effect).toBe(accepted);
    expect(result.providerMessageId).toBe(PROVIDER_MESSAGE_ID);
    expect(rpc.refreshEffects).toHaveBeenCalledOnce();
    expect(rpc.recordEffectCheckpoint).not.toHaveBeenCalled();
    expect(gateway.dispatchDurable).not.toHaveBeenCalled();
  });

  it('short-circuits a finalised effect in both dispatch and business finalisation', async () => {
    const finalised = effect(BASE_DISPATCH, 'finalised');
    const rpc = rpcFixture([finalised]);
    const gateway = gatewayFixture(acceptedOutcome('must-not-be-used'));
    const finalise = vi.fn(async () => 'must-not-run');

    const acceptance = await dispatchDurableEmailEffect(dispatchInput({
      rpc: rpc.rpc,
      gateway: gateway.gateway,
      effects: [finalised],
    }));
    const result = await finaliseDurableEmailEffect({
      acceptance,
      rpc: rpc.rpc,
      finalise,
    });

    expect(result).toEqual({ effect: finalised, alreadyFinalised: true, result: null });
    expect(finalise).not.toHaveBeenCalled();
    expect(rpc.recordEffectCheckpoint).not.toHaveBeenCalled();
    expect(gateway.dispatchDurable).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'rate-limited retryable rejection',
      outcome: {
        outcome: 'retryable_rejection',
        code: 'RESEND_RATE_LIMITED',
        provider: RESEND_PROVIDER_NAME,
        statusCode: 429,
        retryAfterMs: 500,
        durationMs: 4,
      } satisfies ResendDispatchOutcome,
      state: 'uncertain',
      code: 'RESEND_RATE_LIMITED',
      disposition: 'retry',
    },
    {
      name: 'provider idempotency still in progress',
      outcome: {
        outcome: 'retryable_rejection',
        code: 'RESEND_IDEMPOTENCY_IN_PROGRESS',
        provider: RESEND_PROVIDER_NAME,
        statusCode: 409,
        retryAfterMs: null,
        durationMs: 4,
      } satisfies ResendDispatchOutcome,
      state: 'uncertain',
      code: 'RESEND_IDEMPOTENCY_IN_PROGRESS',
      disposition: 'retry',
    },
    {
      name: 'uncertain transport result',
      outcome: {
        outcome: 'uncertain',
        code: 'RESEND_TIMEOUT',
        provider: RESEND_PROVIDER_NAME,
        statusCode: null,
        durationMs: 15_000,
      } satisfies ResendDispatchOutcome,
      state: 'uncertain',
      code: 'RESEND_TIMEOUT',
      disposition: 'retry',
    },
    {
      name: 'same-key payload conflict',
      outcome: {
        outcome: 'idempotency_conflict',
        code: 'RESEND_IDEMPOTENCY_PAYLOAD_CONFLICT',
        provider: RESEND_PROVIDER_NAME,
        statusCode: 409,
        durationMs: 3,
      } satisfies ResendDispatchOutcome,
      state: 'failed',
      code: 'RESEND_IDEMPOTENCY_PAYLOAD_CONFLICT',
      disposition: 'needs_attention',
    },
    {
      name: 'terminal provider rejection',
      outcome: {
        outcome: 'terminal_rejection',
        code: 'RESEND_VALIDATION_REJECTED',
        provider: RESEND_PROVIDER_NAME,
        statusCode: 422,
        durationMs: 3,
      } satisfies ResendDispatchOutcome,
      state: 'failed',
      code: 'RESEND_VALIDATION_REJECTED',
      disposition: 'needs_attention',
    },
    {
      name: 'expired provider key before dispatch',
      outcome: {
        outcome: 'not_dispatched',
        code: 'RESEND_IDEMPOTENCY_EXPIRED',
        provider: RESEND_PROVIDER_NAME,
        statusCode: null,
        durationMs: 0,
      } satisfies ResendDispatchOutcome,
      state: 'failed',
      code: 'EMAIL_IDEMPOTENCY_WINDOW_EXPIRED',
      disposition: 'needs_attention',
    },
    {
      name: 'abort reported before the provider request',
      outcome: {
        outcome: 'not_dispatched',
        code: 'RESEND_ABORTED_BEFORE_DISPATCH',
        provider: RESEND_PROVIDER_NAME,
        statusCode: null,
        durationMs: 0,
      } satisfies ResendDispatchOutcome,
      state: 'uncertain',
      code: 'RESEND_ABORTED_BEFORE_DISPATCH',
      disposition: 'retry',
    },
  ])('classifies $name', async ({ outcome, state, code, disposition }) => {
    const rpc = rpcFixture();
    const gateway = gatewayFixture(outcome);

    await expect(dispatchDurableEmailEffect(dispatchInput({
      rpc: rpc.rpc,
      gateway: gateway.gateway,
    }))).rejects.toMatchObject({ code, disposition });

    expect(recordedStates(rpc)).toEqual(['prepared', 'dispatch_started', state]);
  });

  it('marks an unexpected gateway throw uncertain and requests a retry', async () => {
    const rpc = rpcFixture();
    const dispatchDurable = vi.fn(async (): Promise<ResendDispatchOutcome> => {
      throw new Error('socket vanished');
    });
    const gateway: ResendEmailGateway = {
      dispatchDurable,
      dispatchLegacy: vi.fn(async () => {
        throw new Error('legacy dispatch must not be used');
      }),
    };

    await expect(dispatchDurableEmailEffect(dispatchInput({ rpc: rpc.rpc, gateway })))
      .rejects.toMatchObject({
        code: 'EMAIL_PROVIDER_GATEWAY_FAILED',
        disposition: 'retry',
      });
    expect(recordedStates(rpc)).toEqual(['prepared', 'dispatch_started', 'uncertain']);
  });

  it('preserves an abort reason returned after the gateway was entered', async () => {
    const controller = new AbortController();
    const abortReason = new Error('lease ownership lost');
    const rpc = rpcFixture();
    const gateway = gatewayFixture({
      outcome: 'not_dispatched',
      code: 'RESEND_ABORTED_BEFORE_DISPATCH',
      provider: RESEND_PROVIDER_NAME,
      statusCode: null,
      durationMs: 0,
    });
    gateway.dispatchDurable.mockImplementationOnce(async () => {
      controller.abort(abortReason);
      return {
        outcome: 'not_dispatched',
        code: 'RESEND_ABORTED_BEFORE_DISPATCH',
        provider: RESEND_PROVIDER_NAME,
        statusCode: null,
        durationMs: 0,
      };
    });

    await expect(dispatchDurableEmailEffect(dispatchInput({
      rpc: rpc.rpc,
      gateway: gateway.gateway,
      signal: controller.signal,
    }))).rejects.toBe(abortReason);
    expect(recordedStates(rpc)).toEqual(['prepared', 'dispatch_started', 'uncertain']);
  });

  it('refuses to send once the frozen idempotency window has expired', async () => {
    const expiredDispatch = createDurableResendEmailDispatch({
      jobId: JOB_ID,
      effectKey: EFFECT_KEY,
      idempotencyExpiresAt: new Date(NOW).toISOString(),
      message: MESSAGE,
    });
    const prepared = effect(expiredDispatch, 'prepared');
    const rpc = rpcFixture([prepared]);
    const gateway = gatewayFixture(acceptedOutcome());

    await expect(dispatchDurableEmailEffect(dispatchInput({
      rpc: rpc.rpc,
      gateway: gateway.gateway,
      effects: [prepared],
    }))).rejects.toMatchObject({
      code: 'EMAIL_IDEMPOTENCY_WINDOW_EXPIRED',
      disposition: 'needs_attention',
    });

    expect(rpc.recordEffectCheckpoint).not.toHaveBeenCalled();
    expect(gateway.dispatchDurable).not.toHaveBeenCalled();
  });

  const changedMessages: readonly Readonly<{
    name: string;
    message: EmailMessageInput;
  }>[] = [
    {
      name: 'recipients',
      message: { ...MESSAGE, to: ['different@example.com'] },
    },
    {
      name: 'subject',
      message: { ...MESSAGE, subject: 'A changed quote subject' },
    },
    {
      name: 'html',
      message: { ...MESSAGE, html: '<p>Changed HTML</p>' },
    },
    {
      name: 'text',
      message: { ...MESSAGE, text: 'Changed plain text' },
    },
    {
      name: 'attachments',
      message: {
        ...MESSAGE,
        attachments: [{
          filename: 'replacement.pdf',
          content: new Uint8Array([37, 80, 68, 70, 45, 50]),
          contentType: 'application/pdf',
        }],
      },
    },
    {
      name: 'token',
      message: {
        ...MESSAGE,
        html: '<p>Quote token: quote-token-replaced</p>',
        text: 'Quote token: quote-token-replaced',
      },
    },
    {
      name: 'attachment content',
      message: {
        ...MESSAGE,
        attachments: [{
          filename: 'quote.pdf',
          content: new Uint8Array([0, 1, 2, 3, 4, 5]),
          contentType: 'application/pdf',
        }],
      },
    },
  ];

  it.each(changedMessages)(
    'rejects changed $name under the same provider idempotency key',
    async ({ message }) => {
      const changedDispatch = createDurableResendEmailDispatch({
        jobId: JOB_ID,
        effectKey: EFFECT_KEY,
        idempotencyExpiresAt: EXPIRY,
        message,
      });
      expect(changedDispatch.idempotencyKey).toBe(BASE_DISPATCH.idempotencyKey);
      expect(changedDispatch.payloadHash).not.toBe(BASE_DISPATCH.payloadHash);

      const prepared = effect(BASE_DISPATCH, 'prepared');
      const rpc = rpcFixture([prepared]);
      const gateway = gatewayFixture(acceptedOutcome());

      await expect(dispatchDurableEmailEffect(dispatchInput({
        rpc: rpc.rpc,
        gateway: gateway.gateway,
        message,
        effects: [prepared],
      }))).rejects.toMatchObject({
        code: 'EMAIL_EFFECT_IDENTITY_MISMATCH',
        disposition: 'needs_attention',
      });
      expect(rpc.recordEffectCheckpoint).not.toHaveBeenCalled();
      expect(gateway.dispatchDurable).not.toHaveBeenCalled();
    },
  );

  it('rejects changed tags under the same provider idempotency key', async () => {
    const forgedBody = JSON.parse(BASE_DISPATCH.canonicalRequestBody) as {
      tags: Array<{ name: string; value: string }>;
    };
    forgedBody.tags[1] = { name: 'effect_ref', value: 'changed-effect-ref' };
    const forgedPayloadHash = createHash('sha256')
      .update(JSON.stringify(forgedBody), 'utf8')
      .digest('hex');
    const prepared = effect(BASE_DISPATCH, 'prepared', { payloadHash: forgedPayloadHash });
    const rpc = rpcFixture([prepared]);
    const gateway = gatewayFixture(acceptedOutcome());

    await expect(dispatchDurableEmailEffect(dispatchInput({
      rpc: rpc.rpc,
      gateway: gateway.gateway,
      effects: [prepared],
    }))).rejects.toMatchObject({
      code: 'EMAIL_EFFECT_IDENTITY_MISMATCH',
      disposition: 'needs_attention',
    });
    expect(prepared.providerIdempotencyKey).toBe(BASE_DISPATCH.idempotencyKey);
    expect(rpc.recordEffectCheckpoint).not.toHaveBeenCalled();
    expect(gateway.dispatchDurable).not.toHaveBeenCalled();
  });

  it('uses a reconciled webhook acceptance that wins the race before provider dispatch', async () => {
    const webhookAccepted = effect(BASE_DISPATCH, 'provider_accepted');
    const rpc = rpcFixture([], {
      onRefresh: () => [webhookAccepted],
    });
    const gateway = gatewayFixture(acceptedOutcome('must-not-be-used'));

    const acceptance = await dispatchDurableEmailEffect(dispatchInput({
      rpc: rpc.rpc,
      gateway: gateway.gateway,
    }));

    expect(acceptance.effect).toBe(webhookAccepted);
    expect(recordedStates(rpc)).toEqual(['prepared', 'dispatch_started']);
    expect(gateway.dispatchDurable).not.toHaveBeenCalled();
  });

  it('uses a same-message webhook acceptance that wins after the provider response', async () => {
    const webhookAccepted = effect(BASE_DISPATCH, 'provider_accepted');
    const rpc = rpcFixture([], {
      onRecord: (input) => input.state === 'provider_accepted' ? webhookAccepted : undefined,
    });
    const gateway = gatewayFixture(acceptedOutcome());

    const acceptance = await dispatchDurableEmailEffect(dispatchInput({
      rpc: rpc.rpc,
      gateway: gateway.gateway,
    }));

    expect(acceptance.effect).toBe(webhookAccepted);
    expect(recordedStates(rpc)).toEqual(['prepared', 'dispatch_started', 'provider_accepted']);
    expect(gateway.dispatchDurable).toHaveBeenCalledOnce();
  });

  it('uses webhook acceptance when it wins a rejected uncertain checkpoint write', async () => {
    const webhookAccepted = effect(BASE_DISPATCH, 'provider_accepted');
    const rpc = rpcFixture([], {
      onRecord: (input) => {
        if (input.state === 'uncertain') {
          throw new Error('effect transition lost the webhook race');
        }
        return undefined;
      },
      onRefresh: (callNumber) => callNumber === 2 ? [webhookAccepted] : undefined,
    });
    const gateway = gatewayFixture({
      outcome: 'uncertain',
      code: 'RESEND_TIMEOUT',
      provider: RESEND_PROVIDER_NAME,
      statusCode: null,
      durationMs: 15_000,
    });

    const acceptance = await dispatchDurableEmailEffect(dispatchInput({
      rpc: rpc.rpc,
      gateway: gateway.gateway,
    }));

    expect(acceptance.effect).toBe(webhookAccepted);
    expect(recordedStates(rpc)).toEqual(['prepared', 'dispatch_started', 'uncertain']);
    expect(rpc.refreshEffects).toHaveBeenCalledTimes(2);
  });

  it('uses webhook acceptance when an unexpected gateway throw loses the checkpoint race', async () => {
    const webhookAccepted = effect(BASE_DISPATCH, 'provider_accepted');
    const rpc = rpcFixture([], {
      onRecord: (input) => {
        if (input.state === 'uncertain') {
          throw new Error('effect transition lost the webhook race');
        }
        return undefined;
      },
      onRefresh: (callNumber) => callNumber === 2 ? [webhookAccepted] : undefined,
    });
    const gateway: ResendEmailGateway = {
      dispatchDurable: vi.fn(async () => {
        throw new Error('unexpected transport failure');
      }),
      dispatchLegacy: vi.fn(async () => {
        throw new Error('legacy dispatch must not be used');
      }),
    };

    const acceptance = await dispatchDurableEmailEffect(dispatchInput({ rpc: rpc.rpc, gateway }));

    expect(acceptance.effect).toBe(webhookAccepted);
    expect(recordedStates(rpc)).toEqual(['prepared', 'dispatch_started', 'uncertain']);
  });

  it('lets signed acceptance override a locally recorded terminal rejection', async () => {
    const webhookAccepted = effect(BASE_DISPATCH, 'provider_accepted');
    const rpc = rpcFixture([], {
      onRefresh: (callNumber) => callNumber === 2 ? [webhookAccepted] : undefined,
    });
    const gateway = gatewayFixture({
      outcome: 'terminal_rejection',
      code: 'RESEND_VALIDATION_REJECTED',
      provider: RESEND_PROVIDER_NAME,
      statusCode: 422,
      durationMs: 20,
    });

    const acceptance = await dispatchDurableEmailEffect(dispatchInput({
      rpc: rpc.rpc,
      gateway: gateway.gateway,
    }));

    expect(acceptance.effect).toBe(webhookAccepted);
    expect(recordedStates(rpc)).toEqual(['prepared', 'dispatch_started', 'failed']);
  });

  it.each([
    ['rejected failed-checkpoint write', true],
    ['post-write acceptance refresh', false],
  ] as const)(
    'preserves an idempotency conflict when webhook acceptance wins via %s',
    async (_case, rejectFailedCheckpoint) => {
      const webhookAccepted = effect(BASE_DISPATCH, 'provider_accepted');
      const rpc = rpcFixture([], {
        onRecord: (input) => {
          if (rejectFailedCheckpoint && input.state === 'failed') {
            throw new Error('effect transition lost the webhook race');
          }
          return undefined;
        },
        onRefresh: (callNumber) => callNumber === 2 ? [webhookAccepted] : undefined,
      });
      const gateway = gatewayFixture({
        outcome: 'idempotency_conflict',
        code: 'RESEND_IDEMPOTENCY_PAYLOAD_CONFLICT',
        provider: RESEND_PROVIDER_NAME,
        statusCode: 409,
        durationMs: 20,
      });

      await expect(dispatchDurableEmailEffect(dispatchInput({
        rpc: rpc.rpc,
        gateway: gateway.gateway,
      }))).rejects.toMatchObject({
        code: 'RESEND_IDEMPOTENCY_PAYLOAD_CONFLICT',
        disposition: 'needs_attention',
      });
      expect(rpc.effects()).toEqual([webhookAccepted]);
      expect(recordedStates(rpc)).toEqual(['prepared', 'dispatch_started', 'failed']);
    },
  );

  it('routes a webhook-first provider-message conflict through the atomic acceptance checkpoint', async () => {
    const controller = new AbortController();
    const webhookAccepted = effect(BASE_DISPATCH, 'provider_accepted', {
      providerMessageId: 'different-provider-message',
    });
    const rpc = rpcFixture([], {
      onRecord: (input) => input.state === 'provider_accepted' ? webhookAccepted : undefined,
      onRefresh: (callNumber) => {
        if (callNumber !== 2) return undefined;
        controller.abort(new Error('a pre-write refresh must not bypass the atomic checkpoint'));
        return [webhookAccepted];
      },
    });
    const gateway = gatewayFixture(acceptedOutcome());

    await expect(dispatchDurableEmailEffect(dispatchInput({
      rpc: rpc.rpc,
      gateway: gateway.gateway,
      signal: controller.signal,
    }))).rejects.toMatchObject({
      code: 'EMAIL_PROVIDER_MESSAGE_ID_CONFLICT',
      disposition: 'needs_attention',
    });
    expect(recordedStates(rpc)).toEqual(['prepared', 'dispatch_started', 'provider_accepted']);
    expect(rpc.refreshEffects).toHaveBeenCalledOnce();
  });

  it.each([
    ['checkpoint rejection', true],
    ['checkpoint return', false],
  ] as const)(
    'quarantines a different webhook message that wins the accepted-response %s race',
    async (_case, rejectCheckpoint) => {
      const controller = new AbortController();
      const webhookAccepted = effect(BASE_DISPATCH, 'provider_accepted', {
        providerMessageId: 'different-provider-message',
      });
      const rpc = rpcFixture([], {
        onRecord: (input) => {
          if (input.state !== 'provider_accepted') return undefined;
          if (rejectCheckpoint) {
            controller.abort(new Error('shutdown raced provider acceptance'));
            throw new Error('provider acceptance checkpoint lost the webhook race');
          }
          return webhookAccepted;
        },
        onRefresh: (callNumber) =>
          rejectCheckpoint && callNumber === 2 ? [webhookAccepted] : undefined,
      });
      const gateway = gatewayFixture(acceptedOutcome());

      await expect(dispatchDurableEmailEffect(dispatchInput({
        rpc: rpc.rpc,
        gateway: gateway.gateway,
        signal: controller.signal,
      }))).rejects.toMatchObject({
        code: 'EMAIL_PROVIDER_MESSAGE_ID_CONFLICT',
        disposition: 'needs_attention',
      });
    },
  );

  it('does not repeat the finalised checkpoint when a concurrent finaliser wins', async () => {
    const accepted = effect(BASE_DISPATCH, 'provider_accepted');
    const finalised = effect(BASE_DISPATCH, 'finalised');
    const rpc = rpcFixture([accepted], {
      onRefresh: () => [finalised],
    });
    const finalise = vi.fn(async () => ({ quoteId: 'quote-42' }));

    const result = await finaliseDurableEmailEffect({
      acceptance: {
        dispatch: BASE_DISPATCH,
        effect: accepted as BackgroundJobWorkerEffect & Readonly<{ state: 'provider_accepted' }>,
        providerMessageId: PROVIDER_MESSAGE_ID,
      },
      rpc: rpc.rpc,
      finalise,
    });

    expect(result).toEqual({
      effect: finalised,
      alreadyFinalised: true,
      result: { quoteId: 'quote-42' },
    });
    expect(finalise).toHaveBeenCalledOnce();
    expect(rpc.recordEffectCheckpoint).not.toHaveBeenCalled();
  });

  it('rejects a structurally forged acceptance before mutating business state', async () => {
    const accepted = effect(BASE_DISPATCH, 'provider_accepted');
    const rpc = rpcFixture([accepted]);
    const finalise = vi.fn(async () => ({ quoteId: 'quote-42' }));

    await expect(finaliseDurableEmailEffect({
      acceptance: {
        dispatch: BASE_DISPATCH,
        effect: accepted as BackgroundJobWorkerEffect & Readonly<{ state: 'provider_accepted' }>,
        providerMessageId: 'different-provider-message',
      },
      rpc: rpc.rpc,
      finalise,
    })).rejects.toMatchObject({
      code: 'EMAIL_PROVIDER_MESSAGE_ID_CONFLICT',
      disposition: 'needs_attention',
    });
    expect(finalise).not.toHaveBeenCalled();
    expect(rpc.recordEffectCheckpoint).not.toHaveBeenCalled();
  });
});
