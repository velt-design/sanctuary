// @vitest-environment node

import { Webhook } from 'svix';
import { describe, expect, it } from 'vitest';

import {
  ResendWebhookVerificationError,
  verifyResendWebhook,
  type ResendWebhookHeaders,
} from './index';

const JOB_ID = '11111111-1111-4111-8111-111111111111';
const EFFECT_REF = 'a'.repeat(64);
const EVENT_ID = 'event_test_1';
const OCCURRED_AT = new Date().toISOString();
const SECRET = `whsec_${Buffer.from('email-provider-webhook-test-secret').toString('base64')}`;

function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'email.sent',
    created_at: OCCURRED_AT,
    data: {
      email_id: 'provider-message-1',
      from: 'private@example.test',
      to: ['customer@example.test'],
      subject: 'Private subject',
      tags: { job_id: JOB_ID, effect_ref: EFFECT_REF },
    },
    ...overrides,
  };
}

function signedInput(
  value: Record<string, unknown>,
  options: { eventId?: string; secret?: string } = {},
) {
  const rawBody = JSON.stringify(value);
  const eventId = options.eventId ?? EVENT_ID;
  const signingSecret = options.secret ?? SECRET;
  const signedAt = new Date();
  const signature = new Webhook(signingSecret).sign(eventId, signedAt, rawBody);
  const headers: ResendWebhookHeaders = {
    id: eventId,
    timestamp: String(Math.floor(signedAt.getTime() / 1_000)),
    signature,
  };
  return { rawBody, headers, webhookSecret: signingSecret };
}

function expectWebhookCode(fn: () => unknown, code: string): void {
  try {
    fn();
    throw new Error('Expected webhook verification to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(ResendWebhookVerificationError);
    expect(error).toMatchObject({ code, message: code });
  }
}

describe('verifyResendWebhook', () => {
  it('verifies raw signed email.sent input and returns only safe correlation fields', () => {
    const result = verifyResendWebhook(signedInput(payload()));
    expect(result).toEqual({
      outcome: 'verified',
      provider: 'resend',
      eventType: 'email.sent',
      eventId: EVENT_ID,
      jobId: JOB_ID,
      effectRef: EFFECT_REF,
      messageId: 'provider-message-1',
      occurredAt: new Date(OCCURRED_AT).toISOString(),
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('private@example.test');
    expect(serialized).not.toContain('customer@example.test');
    expect(serialized).not.toContain('Private subject');
  });

  it('returns the same event identity for duplicate deliveries so persistence can deduplicate it', () => {
    const input = signedInput(payload());
    expect(verifyResendWebhook(input)).toEqual(verifyResendWebhook(input));
  });

  it('returns a safe ignored result for other valid signed event types', () => {
    const result = verifyResendWebhook(
      signedInput(payload({ type: 'email.delivered' }), { eventId: 'event_test_2' }),
    );
    expect(result).toEqual({
      outcome: 'ignored',
      provider: 'resend',
      eventType: 'email.delivered',
      eventId: 'event_test_2',
      occurredAt: new Date(OCCURRED_AT).toISOString(),
    });
  });

  it.each([
    ['missing tags', { email_id: 'provider-message-1' }],
    ['empty tags', { email_id: 'provider-message-1', tags: {} }],
    ['unrelated legacy tags', { email_id: 'provider-message-1', tags: { campaign: 'legacy' } }],
  ])('acknowledges a signed legacy email.sent event with %s', (_name, data) => {
    const result = verifyResendWebhook(signedInput(payload({ data })));
    expect(result).toEqual({
      outcome: 'ignored',
      provider: 'resend',
      eventType: 'email.sent',
      eventId: EVENT_ID,
      occurredAt: new Date(OCCURRED_AT).toISOString(),
    });
  });

  it('rejects a mutated body with a safe signature error', () => {
    const input = signedInput(payload());
    expectWebhookCode(
      () => verifyResendWebhook({ ...input, rawBody: `${input.rawBody} ` }),
      'RESEND_WEBHOOK_SIGNATURE_INVALID',
    );
  });

  it.each([
    [
      'partial durable tags',
      payload({ data: { email_id: 'provider-message-1', tags: { job_id: JOB_ID } } }),
    ],
    [
      'extra tags',
      payload({
        data: {
          email_id: 'provider-message-1',
          tags: { job_id: JOB_ID, effect_ref: EFFECT_REF, customer: 'private' },
        },
      }),
    ],
    [
      'invalid job id',
      payload({
        data: {
          email_id: 'provider-message-1',
          tags: { job_id: 'customer@example.test', effect_ref: EFFECT_REF },
        },
      }),
    ],
    [
      'invalid effect ref',
      payload({
        data: {
          email_id: 'provider-message-1',
          tags: { job_id: JOB_ID, effect_ref: 'not-a-hash' },
        },
      }),
    ],
    [
      'invalid provider id',
      payload({
        data: {
          email_id: 'provider id with spaces',
          tags: { job_id: JOB_ID, effect_ref: EFFECT_REF },
        },
      }),
    ],
    ['missing provider id on an untagged send', payload({ data: {} })],
    [
      'invalid provider id on an untagged send',
      payload({ data: { email_id: 'provider id with spaces' } }),
    ],
    ['invalid timestamp', payload({ created_at: 'not-a-date' })],
    ['invalid event type', payload({ type: 'Email Sent' })],
  ])('rejects signed but malformed $name input with no private detail in the error', (_name, value) => {
    expectWebhookCode(
      () => verifyResendWebhook(signedInput(value)),
      'RESEND_WEBHOOK_SCHEMA_INVALID',
    );
  });

  it('rejects malformed headers and signing configuration with safe codes', () => {
    const input = signedInput(payload());
    expectWebhookCode(
      () => verifyResendWebhook({ ...input, headers: { ...input.headers, id: 'bad id' } }),
      'RESEND_WEBHOOK_HEADERS_INVALID',
    );
    expectWebhookCode(
      () => verifyResendWebhook({ ...input, webhookSecret: '' }),
      'RESEND_WEBHOOK_SECRET_INVALID',
    );
  });
});
